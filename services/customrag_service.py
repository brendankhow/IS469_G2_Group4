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
            
            for r in response.results:
                original_index = r.index
                original_doc = id_map[original_index] # Get the original doc using the correct index
                
                ranked_entries.append({
                    "student_id": original_doc.get("student_id"),
                    "type": original_doc.get("type"),
                    "rerank_score": r.relevance_score
                })

            # --- Merge scores per student  ---
            merged_candidates = {}
            for item in ranked_entries:
                sid = item["student_id"]
                if not sid: continue

                if sid not in merged_candidates:
                    # New candidate. We need their name and full resume text.
                    # Let's find their original full resume record
                    full_resume_record = next((res for res in retrieved_resumes if res.get("student_id") == sid), None)
                    
                    student_name = "N/A"
                    resume_text = None

                    if full_resume_record:
                        student_name = full_resume_record.get("student_name", "N/A")
                        resume_text = full_resume_record.get("resume_text")
                    else:
                        # If they only had a GitHub match, try to get name from there
                        github_record = next((git for git in retrieved_githubs if git.get("student_id") == sid), None)
                        if github_record:
                            student_name = github_record.get("student_name", "N/A")

                    merged_candidates[sid] = {
                        "student_id": sid,
                        "student_name": student_name,
                        "resume_text": resume_text, # Only return resume text
                        "combined_score": 0.0,
                    }

                # Add the score (from either resume or github) to the total
                merged_candidates[sid]["combined_score"] += item["rerank_score"]
                # merged_candidates[sid]["relevant_chunks_count"] += 1

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