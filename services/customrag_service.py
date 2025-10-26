# services/customrag_service_service.py
from services.supabase_client import supabase
from services.llm_client import llm_client
from services.vector_store import VectorStore
from services.embedding_service import *
from services.llama_wrappers import custom_llm, custom_embed_model, local_llm_client
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)
embedder = EmbeddingService()

class CustomRAGService:

    @staticmethod
    def query_custom_rag(
        query_text: str,
        top_k: int = 3, # No. of candidates
        filters: Optional[Dict] = None, 
        top_k_chunks: int = 45, # No. of chunks
        threshold: float = 0.3
    ) -> List[Dict]:
        """
        Ranks top candidates based on the similarity of their RESUME chunks to a query.
        Uses the global 'search_similar_resume_chunks' function.
        """
        logger.info(f"Received Custom RAG query: {query_text[:100]}...")
        logger.info(f"Ranking top {top_k} candidates.")

        try:
            # --- Embed the Query ---
            query_embedding = embedder.generate_embedding(query_text)
            print("query embedding:",len(query_embedding))  # should be 384

            # --- Retrieve Relevant chunks ---
            logger.info(f"Searching resume chunks globally using search_similar_resume_chunks...")
            retrieved_chunks = VectorStore.search_similar_resume_chunks(
                query_embedding=query_embedding,
                top_k=top_k_chunks,
                threshold=threshold
                # Note: Pass filters here ONLY if your match_resume_chunks SQL function
                # was modified to accept and use them.
            )

            if not retrieved_chunks:
                logger.warning("No relevant resume chunks found in VectorStore.")
                return []

            # --- Group Chunks by Candidate & Find Best Score ---
            student_scores = {}
            for chunk in retrieved_chunks:
                # Keys depend on what your 'match_resume_chunks' SQL function returns
                sid = chunk.get("student_id")
                similarity = chunk.get("similarity", 0.0)
                if not sid: continue

                if sid not in student_scores or similarity > student_scores[sid]['max_similarity']:
                    student_scores[sid] = {
                        "student_id": sid,
                        "max_similarity": similarity,
                        "student_name": chunk.get("student_name", "N/A"), # From SQL JOIN
                        "best_chunk": {
                            "id": chunk.get("id"),
                            "text": chunk.get("chunk_text", ""), # From SQL
                            "source": "resume",
                            "filename": chunk.get("file_name_alias", "N/A") # Alias from SQL
                        }
                    }

            # --- Rank Candidates by their Best Score ---
            ranked_candidates = sorted(
                student_scores.values(),
                key=lambda candidate: candidate["max_similarity"],
                reverse=True
            )

            # --- Return the Top K Candidates ---
            top_results = ranked_candidates[:top_k]
            logger.info(f"Returning top {len(top_results)} ranked candidates based on best chunk similarity.")
            return top_results

        except Exception as e:
            logger.error(f"Custom RAG query failed: {str(e)}", exc_info=True)
            return []