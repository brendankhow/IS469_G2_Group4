import logging
import time
import numpy as np
import sys, os
from typing import List, Dict, Any
from sklearn.metrics.pairwise import cosine_similarity

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.customrag_service import CustomRAGService
from services.embedder import embedder

logger = logging.getLogger(__name__)

class CustomRAGEvaluator:
    """Evaluate CustomRAG on a fixed test set with top-K retrieval."""

    TEST_EMAILS = [
        "01@test.com","02@test.com","03@test.com","04@test.com","05@test.com",
        "06@test.com","07@test.com","08@test.com","09@test.com","10@test.com",
        "11@test.com","12@test.com","13@test.com","14@test.com","15@test.com",
        "16@test.com","17@test.com","18@test.com","19@test.com","20@test.com"
    ]

    def __init__(self, top_k: int = 2):
        self.rag = CustomRAGService()
        self.top_k = top_k

    # --- Metrics ---
    def mean_reciprocal_rank(self, results: List[Dict], expected_ids: set) -> float:
        for i, r in enumerate(results, 1):
            if r.get("student_id") in expected_ids:
                return 1.0 / i
        return 0.0

    def precision_at_k(self, results: List[Dict], expected_ids: set) -> float:
        if not results:
            return 0.0
        top_ids = [r["student_id"] for r in results]
        num_relevant = sum(1 for r in top_ids if r in expected_ids)
        return num_relevant / len(results)

    def recall_at_k(self, results: List[Dict], expected_ids: set) -> float:
        if not expected_ids:
            return 0.0
        top_ids = [r["student_id"] for r in results]
        num_relevant = sum(1 for r in top_ids if r in expected_ids)
        return num_relevant / len(expected_ids)

    def answer_similarity(self, results: List[Dict], ground_truth: str) -> float:
        """Cosine similarity between combined retrieved answers and ground truth embedding."""
        if not results:
            return 0.0
        retrieved_texts = [r.get("resume_text") or "" for r in results]
        combined_text = " ".join(retrieved_texts)
        emb_query = embedder.generate_embedding(ground_truth)
        emb_answer = embedder.generate_embedding(combined_text)
        sim = cosine_similarity([emb_query], [emb_answer])[0][0]
        return float(sim)

    # --- Evaluation ---
    def evaluate(self, test_cases: List[Dict[str, Any]]) -> Dict[str, float]:
        mrrs, precisions, recalls, answer_sims, latencies = [], [], [], [], []

        for case in test_cases:
            query = case["question"]
            expected_ids = case["expected_ids"]
            ground_truth = case.get("ground_truth", "")

            start_time = time.time()
            results = self.rag.query_custom_rag(
                query,
                top_k=self.top_k,
                filters={"email": self.TEST_EMAILS}  # restrict to test emails
            )
            latency = time.time() - start_time

            mrrs.append(self.mean_reciprocal_rank(results, expected_ids))
            precisions.append(self.precision_at_k(results, expected_ids))
            recalls.append(self.recall_at_k(results, expected_ids))
            answer_sims.append(self.answer_similarity(results, ground_truth))
            latencies.append(latency)

            print(f"Query: {query[:50]}...")
            print(f"Top {self.top_k} candidates: {[r.get('student_id') for r in results]}")
            print(f"MRR: {mrrs[-1]:.2f}, Precision@{self.top_k}: {precisions[-1]:.2f}, Recall@{self.top_k}: {recalls[-1]:.2f}, "
                  f"AnswerSim: {answer_sims[-1]:.2f}, Latency: {latency:.2f}s\n")

        return {
            "avg_mrr": np.mean(mrrs),
            "avg_precision": np.mean(precisions),
            "avg_recall": np.mean(recalls),
            "avg_answer_similarity": np.mean(answer_sims),
            "avg_latency": np.mean(latencies)
        }


if __name__ == "__main__":
    evaluator = CustomRAGEvaluator(top_k=3)
    test_cases = [
        {
            "question": "Candidates with Python and machine learning experience",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates strong in Python, ML, and data projects.",
        },
        {
            "question": "Software engineers familiar with React and Node.js",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates experienced with full-stack web development.",
        },
        {
            "question": "Students skilled in Java and OOP principles",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with strong Java programming and OOP experience.",
        },
        {
            "question": "Data engineers with SQL and AWS experience",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates proficient in SQL databases, AWS, and data pipelines.",
        },
        {
            "question": "Machine learning researchers with PyTorch experience",
            "expected_ids": {
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates who have built ML models using PyTorch or TensorFlow.",
        },
        {
            "question": "Web developers familiar with HTML, CSS, and JavaScript",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with front-end development experience.",
        },
        {
            "question": "Students with GitHub portfolios showcasing projects",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "59fb0410-b473-49b4-8045-b8f4a95e939c",     # Sam Patel (11@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates with active GitHub profiles demonstrating technical work.",
        },
        {
            "question": "Interns with experience in teaching or mentoring CS students",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates who have tutored, mentored, or taught CS topics.",
        },
        {
            "question": "Students with experience in cloud platforms or Docker",
            "expected_ids": {
                "f7994298-54cf-487b-8447-3166c800eab2",     # Alex Rivera (01@test.com)
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
            },
            "ground_truth": "Candidates familiar with AWS, Docker, or cloud-based workflows.",
        },
        {
            "question": "Candidates with skills in data visualization and reporting",
            "expected_ids": {
                "b834bf2b-eb5e-46a7-b4d5-9fcdccf01175",     # Jordan Lee (02@test.com)
                "735b6edb-738a-4d72-9443-8b3d2da43380",     # Casey Patel (04@test.com)
                "a3500714-13f5-4378-bff3-641f9c6499e8",     # Jordan (12@test.com)
                "afbe87fb-5197-44ca-9ec7-e26229cebb86"      # Casey Garcia (15@test.com)
            },
            "ground_truth": "Candidates able to process data and create visual reports.",
        },
    ]

    results = evaluator.evaluate(test_cases)

    print("\nFINAL RESULTS")
    print("=" * 40)
    print(f"Average MRR: {results['avg_mrr']:.2f}")
    print(f"Average Precision@{evaluator.top_k}: {results['avg_precision']:.2f}")
    print(f"Average Recall@{evaluator.top_k}: {results['avg_recall']:.2f}")
    print(f"Average Answer Similarity: {results['avg_answer_similarity']:.2f}")
    print(f"Average Query Latency: {results['avg_latency']:.2f}s")