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

            if not retrieved_resumes:
                logger.warning("No relevant resumes found in VectorStore.")
                return []

            # prepare text list for reranking
            resume_texts = [r["resume_text"] for r in retrieved_resumes]

            # --- Call Cohere reranker ---
            response = co.rerank(
                model="rerank-english-v3.0",
                query=query_text,
                documents=resume_texts
            )

            # attach rerank scores
            for i, r in enumerate(response.results):
                retrieved_resumes[i]["rerank_score"] = r.relevance_score

            # --- Rank Resumes by Relevance ---
            ranked_candidates = sorted(
                retrieved_resumes,
                key=lambda r: r.get("rerank_score", 0.0),
                reverse=True
            )

            # --- Return Top K Candidates ---
            top_results = ranked_candidates[:top_k]
            logger.info(f"Returning top {len(top_results)} ranked resumes based on rerank score.")
            return top_results

        except Exception as e:
            logger.error(f"Custom RAG query failed: {str(e)}", exc_info=True)
            return []
        
    # # Resume chunks based RAG
    # @staticmethod
    # def query_custom_rag(
    #     query_text: str,
    #     top_k: int = 3, # No. of candidates
    #     filters: Optional[Dict] = None, 
    #     top_k_chunks: int = 45, # No. of chunks
    #     threshold: float = 0.3
    # ) -> List[Dict]:
    #     """
    #     Ranks top candidates based on the similarity of their RESUME chunks to a query.
    #     Uses the global 'search_similar_resume_chunks' function.
    #     """
    #     logger.info(f"Received Custom RAG query: {query_text[:100]}...")
    #     logger.info(f"Ranking top {top_k} candidates.")

    #     try:
    #         # --- Embed the Query ---
    #         query_embedding = embedder.generate_embedding(query_text)

    #         # --- Retrieve Relevant chunks ---
    #         logger.info(f"Searching resume chunks globally using search_similar_resume_chunks...")
    #         retrieved_chunks = VectorStore.search_similar_resume_chunks(
    #             query_embedding=query_embedding,
    #             top_k=top_k_chunks,
    #             threshold=threshold
    #         )

    #         if not retrieved_chunks:
    #             logger.warning("No relevant resume chunks found in VectorStore.")
    #             return []
            
    #         # prepare text list for reranking
    #         chunk_texts = [c["chunk_text"] for c in retrieved_chunks]

    #         # call cohere reranker
    #         response = co.rerank(
    #             model="rerank-english-v3.0",
    #             query=query_text,
    #             documents=chunk_texts
    #         )

    #         # Add the rerank score back to the original chunks
    #         for i, r in enumerate(response.results):
    #             retrieved_chunks[i]["rerank_score"] = r.relevance_score

    #         # --- Group Chunks by Candidate & Find Best Score ---
    #         student_scores = {}
    #         for chunk in retrieved_chunks:
    #             sid = chunk.get("student_id")
    #             # similarity = chunk.get("similarity", 0.0) # without re-ranking
    #             similarity = chunk.get("rerank_score", chunk.get("similarity", 0.0)) # with cohere re-ranking
    #             if not sid: continue

    #             if sid not in student_scores or similarity > student_scores[sid]['max_similarity']:
    #                 student_scores[sid] = {
    #                     "student_id": sid,
    #                     "max_similarity": similarity,
    #                     "student_name": chunk.get("student_name", "N/A"), # From SQL JOIN
    #                     "best_chunk": {
    #                         "id": chunk.get("id"),
    #                         "text": chunk.get("chunk_text", ""), # From SQL
    #                         "source": "resume",
    #                         "filename": chunk.get("file_name_alias", "N/A") # Alias from SQL
    #                     }
    #                 }

    #         # --- Rank Candidates by their Best Score ---
    #         ranked_candidates = sorted(
    #             student_scores.values(),
    #             key=lambda candidate: candidate["max_similarity"],
    #             reverse=True
    #         )

    #         # --- Return the Top K Candidates ---
    #         top_results = ranked_candidates[:top_k]
    #         logger.info(f"Returning top {len(top_results)} ranked candidates based on best chunk similarity.")
    #         return top_results

    #     except Exception as e:
    #         logger.error(f"Custom RAG query failed: {str(e)}", exc_info=True)
    #         return []