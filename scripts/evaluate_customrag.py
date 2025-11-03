import json
import numpy as np
import sys
import os
import cohere
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from typing import List, Dict
from services.embedder import embedder  # your EmbeddingService
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("COHERE_API_KEY")
co = cohere.Client(api_key)

# -----------------------------
# Mock Custom RAG class
# -----------------------------
def cosine_similarity(a: List[float], b: List[float]) -> float:
    from numpy import dot
    from numpy.linalg import norm
    return dot(a, b) / (norm(a) * norm(b))

class MockCustomRAG:
    def __init__(self, mock_retrieval_file: str):
        # load mock resumes and github chunks
        with open(mock_retrieval_file, "r") as f:
            data = json.load(f)
        self.mock_resumes = data.get("resumes", [])
        self.mock_githubs = data.get("githubs", [])

    def query(self, query_text: str, top_k: int = 3, threshold: float = 0.3) -> List[Dict]:
        # 1️⃣ generate query embedding
        query_embedding = embedder.generate_embedding(query_text)

        # 2️⃣ calculate similarity (like supabase SQL)
        for doc in self.mock_resumes:
            if "embedding" not in doc:
                doc["embedding"] = embedder.generate_embedding(doc["resume_text"])
            doc["similarity"] = cosine_similarity(query_embedding, doc["embedding"])

        for doc in self.mock_githubs:
            if "embedding" not in doc:
                doc["embedding"] = embedder.generate_embedding(doc["chunk_text"])
            doc["similarity"] = cosine_similarity(query_embedding, doc["embedding"])

        # 3️⃣ filter by threshold and take extra top docs for reranking
        candidate_docs = [
            d for d in self.mock_resumes + self.mock_githubs if d["similarity"] >= threshold
        ]
        candidate_docs = sorted(candidate_docs, key=lambda x: x["similarity"], reverse=True)
        candidate_docs = candidate_docs[:top_k * 5]  # extra for reranker

        if not candidate_docs:
            return []

        # 4️⃣ rerank with cohere
        doc_texts = [
            d["resume_text"] if "resume_text" in d else d["chunk_text"] for d in candidate_docs
        ]
        response = co.rerank(
            model="rerank-english-v3.0",
            query=query_text,
            documents=doc_texts
        )

        # 5️⃣ merge rerank scores per student
        merged_candidates = {}
        for r in response.results:
            original_doc = candidate_docs[r.index]
            sid = original_doc["student_id"]
            if sid not in merged_candidates:
                merged_candidates[sid] = {
                    "student_id": sid,
                    "student_name": original_doc.get("student_name", "N/A"),
                    "resume_text": original_doc.get("resume_text"),
                    "combined_score": 0.0
                }
            merged_candidates[sid]["combined_score"] += r.relevance_score

        # 6️⃣ rank by combined_score
        ranked_candidates = sorted(
            merged_candidates.values(),
            key=lambda x: x["combined_score"],
            reverse=True
        )

        return ranked_candidates[:top_k]

# -----------------------------
# Evaluation functions
# -----------------------------
def recall_at_k(predicted, ground_truth, k=3):
    return len(set(predicted[:k]) & set(ground_truth)) / len(ground_truth)

def reciprocal_rank(predicted, ground_truth):
    for i, p in enumerate(predicted):
        if p in ground_truth:
            return 1 / (i + 1)
    return 0

# -----------------------------
# Main evaluation
# -----------------------------
def main():
    # Load ground truth queries
    with open("ground_truth.json") as f:
        ground_truth = json.load(f)

    # Initialize mock RAG
    mock_rag = MockCustomRAG("mock_retrieval.json")

    recalls = []
    rrs = []

    for q in ground_truth["queries"]:
        results = mock_rag.query(q["query_text"], top_k=3)
        predicted_ids = [r["student_id"] for r in results]
        gt_ids = q["top_candidates"]

        time.sleep(6)  # 6 seconds between queries to avoid exceeding cohere 10/min rate limlit

        r = recall_at_k(predicted_ids, gt_ids, k=3)
        rr = reciprocal_rank(predicted_ids, gt_ids)

        recalls.append(r)
        rrs.append(rr)

        print(f"Query: {q['query_text'][:50]}...")
        print(f"Predicted: {predicted_ids}")
        print(f"Ground truth: {gt_ids}")
        print(f"Recall@3: {r:.2f}, RR: {rr:.2f}\n")

    print(f"Average Recall@3: {np.mean(recalls):.2f}")
    print(f"Mean Reciprocal Rank (MRR): {np.mean(rrs):.2f}")

# -----------------------------
if __name__ == "__main__":
    main()
