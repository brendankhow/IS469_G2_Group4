# services/customrag_service_service.py
from services.supabase_client import supabase
from services.llm_client import llm_client
from services.vector_store import VectorStore
from services.embedding_service import *
from services.llama_wrappers import custom_llm, custom_embed_model, local_llm_client
from dotenv import load_dotenv
from typing import List, Dict, Optional
from services.embedder import embedder
import json
import logging
import cohere
import os

load_dotenv()

api_key = os.getenv("COHERE_API_KEY")
co = cohere.Client(api_key)

logger = logging.getLogger(__name__)

class CustomRAGService:

    @staticmethod
    def query_custom_rag(
        query_text: str,
        top_k: int = 3,  # No. of candidates
        filters: Optional[Dict] = None, 
        threshold: float = 0.3
    ) -> List[Dict]:
        """
        Ranks top candidates based on the similarity of their full RESUMEs to a query.
        Uses the 'search_similar_resumes' function for retrieval and Cohere for reranking.
        """
        logger.info(f"Received Custom RAG query (full resumes): {query_text[:100]}...")
        logger.info(f"Ranking top {top_k} candidates.")

        try:
            # --- Embed the Query ---
            query_embedding = embedder.generate_embedding(query_text)
            print("query embedding length:", len(query_embedding))  # should be 384

            # --- Retrieve Relevant Resumes ---
            logger.info("Searching resumes globally using search_similar_resumes...")
            retrieved_resumes = VectorStore.search_similar_resumes(
                query_embedding=query_embedding,
                top_k=top_k*5,  # retrieve more to give reranker options
                threshold=threshold
            )
            
            # --- Retrieve Relevant Github Profiles ---
            logger.info(f"Searching GitHub Profiles...")
            retrieved_githubs = VectorStore.search_similar_github_profiles(
                query_embedding=query_embedding,
                top_k=top_k*5,
                threshold=threshold
            )

            # If no data found
            if not retrieved_resumes and not retrieved_githubs:
                logger.warning("No relevant documents found.")
                return []
            
            # Prepare combined docs for reranking
            combined_docs = []
            id_map = []

            for r in retrieved_resumes:
                combined_docs.append(r["resume_text"])
                id_map.append({"student_id": r.get("student_id"), "type": "resume"})

            for g in retrieved_githubs:
                combined_docs.append(g["chunk_text"])
                id_map.append({"student_id": g.get("student_id"), "type": "github"})

            # --- Call Cohere reranker ---
            response = co.rerank(
                model="rerank-english-v3.0",
                query=query_text,
                documents=combined_docs
            )

            # --- Combine rerank results ---
            ranked_entries = []
            for i, r in enumerate(response.results):
                entry = id_map[i]
                score = r.relevance_score
                if entry["type"] == "resume":
                    record = next((res for res in retrieved_resumes if res["student_id"] == entry["student_id"]), None)
                else:
                    record = next((git for git in retrieved_githubs if git["student_id"] == entry["student_id"]), None)
                if record:
                    ranked_entries.append({
                        "student_id": entry["student_id"],
                        "type": entry["type"],
                        "text": record["resume_text"] if entry["type"] == "resume" else record["chunk_text"],
                        "rerank_score": score
                    })

            # --- Merge resume + github per student ---
            merged_candidates = {}
            for item in ranked_entries:
                sid = item["student_id"]
                if sid not in merged_candidates:
                    merged_candidates[sid] = {
                        "student_id": sid,
                        "resume": None,
                        "github": None,
                        "combined_score": 0.0
                    }

                if item["type"] == "resume":
                    merged_candidates[sid]["resume"] = item
                else:
                    merged_candidates[sid]["github"] = item

                merged_candidates[sid]["combined_score"] += item["rerank_score"]

            # --- Rank by combined score ---
            ranked_candidates = sorted(
                merged_candidates.values(),
                key=lambda x: x["combined_score"],
                reverse=True
            )

            # --- Return Top K Candidates ---
            top_results = ranked_candidates[:top_k]
            logger.info(f"Returning top {len(top_results)} ranked candidates.")
            return top_results

        except Exception as e:
            logger.error(f"Custom RAG query failed: {str(e)}", exc_info=True)
            return []