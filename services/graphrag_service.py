from typing import List, Dict, Optional
from llama_index.core.indices.property_graph import PropertyGraphIndex
from llama_index.core.schema import Document as LlamaDocument
import logging

from .vector_store import VectorStore
from .llama_wrappers import custom_llm, custom_embed_model
from .llm_client import llm_client

logger = logging.getLogger(__name__)


class GraphRAGService:
    """
    Service to build and query a global GraphRAG index for recruiter searches.
    Works with all students' resumes, cover letters, and GitHub portfolio data.
    """

    def __init__(self):
        """Initialize GraphRAG service."""
        self.batch_size = 100  # for batch embedding generation

    def build_global_graph_index(self) -> Optional[PropertyGraphIndex]:
        """
        Builds the GraphRAG index for all students' documents and stores nodes in Supabase.
        
        Returns:
            PropertyGraphIndex or None if no documents found
        """
        try:
            logger.info("Fetching all candidate documents from Supabase...")
            documents_data = VectorStore.get_all_candidates_documents()

            if not documents_data:
                logger.warning("No candidate documents found.")
                return None

            logger.info(f"Found {len(documents_data)} candidate documents")

            # convert to llamaindex documents
            documents = [
                LlamaDocument(
                    text=doc["text"],
                    doc_id=doc["doc_id"],
                    metadata={
                        "student_id": doc["student_id"],
                        "source": doc.get("source", "unknown"),
                        "filename": doc.get("filename") or doc.get("repo_name", "unknown")
                    },
                )
                for doc in documents_data
                if doc.get("text") and doc.get("text").strip()  # filter empty docs
            ]

            if not documents:
                logger.warning("No valid documents after filtering")
                return None

            logger.info(f"Building graph index from {len(documents)} documents...")

            # build PropertyGraph - this generates embeddings internally
            index = PropertyGraphIndex.from_documents(
                documents,
                llm=custom_llm,
                embed_model=custom_embed_model,
                show_progress=True,
            )

            logger.info("Storing graph nodes in Supabase...")
            all_node_ids = list(index.docstore.docs.keys())
            all_nodes = [index.docstore.get_node(node_id) for node_id in all_node_ids]

            # batch process nodes for efficient embedding generation
            node_texts = [node.get_content() for node in all_nodes]
            
            # generate embeddings in batches (much faster than one-by-one)
            logger.info(f"Generating embeddings for {len(node_texts)} nodes...")
            all_embeddings = []
            for i in range(0, len(node_texts), self.batch_size):
                batch_texts = node_texts[i:i + self.batch_size]
                batch_embeddings = custom_embed_model.get_text_embeddings(batch_texts)
                all_embeddings.extend(batch_embeddings)
                logger.info(f"Generated embeddings for batch {i//self.batch_size + 1}")

            # prepare batch data for storage
            node_data_batch = [
                {
                    "id": node.node_id,
                    "student_id": node.metadata.get("student_id", "unknown"),
                    "text": node.get_content(),
                    "embedding": embedding,
                    "metadata": {
                        **node.metadata,
                        "node_type": node.class_name(),  # e.g., "TextNode", "Document"
                        "source": node.metadata.get("source", "unknown")
                    }
                }
                for node, embedding in zip(all_nodes, all_embeddings)
            ]

            # store in database
            VectorStore.store_graph_nodes_batch(node_data_batch)
            logger.info(f"Successfully stored {len(node_data_batch)} graph nodes")

            return index

        except Exception as e:
            logger.error(f"Failed to build graph index: {str(e)}", exc_info=True)
            raise

    def query_candidates(
        self, 
        query_text: str, 
        top_k: int = 15, 
        filters: Optional[Dict] = None
    ) -> str:
        """
        Search all candidate GraphRAG nodes and generate recruiter-friendly summary.

        Args:
            query_text: Recruiter query (e.g., "Python developers with AWS experience")
            top_k: Number of top nodes to retrieve
            filters: Optional metadata filters (e.g., {"source": "resume"})

        Returns:
            LLM-generated summary of matching candidates
        """
        try:
            logger.info(f"Processing query: {query_text[:100]}")

            # generate query embedding
            query_embedding = custom_embed_model.get_query_embedding(query_text)

            # search across all candidates
            retrieved_nodes = VectorStore.search_graph_nodes(
                query_embedding=query_embedding,
                top_k=top_k,
                filters=filters
            )

            if not retrieved_nodes:
                logger.warning("No candidates matched the search criteria")
                return "No candidates matched the search criteria."

            logger.info(f"Found {len(retrieved_nodes)} matching nodes")

            # aggregate context
            # group by student for better organisation because there may be >1 node for each student
            student_contexts = {}
            for node in retrieved_nodes:
                student_id = node.get("student_id", "unknown")
                similarity = node.get("similarity", 0.0)
                
                if student_id not in student_contexts:
                    student_contexts[student_id] = {
                        "chunks": [],
                        "max_similarity": similarity
                    }
                
                student_contexts[student_id]["chunks"].append({
                    "text": node.get("text", ""),
                    "source": node.get("metadata", {}).get("source", "unknown"),
                    "similarity": similarity
                })
                
                # track highest similarity score for this student
                if similarity > student_contexts[student_id]["max_similarity"]:
                    student_contexts[student_id]["max_similarity"] = similarity

            # build context for LLM - organise by candidate
            context_chunks = []
            for student_id, data in sorted(
                student_contexts.items(), 
                key=lambda x: x[1]["max_similarity"], 
                reverse=True
            ):
                student_context = f"CANDIDATE ID: {student_id}\n"
                student_context += f"RELEVANCE SCORE: {data['max_similarity']:.2f}\n"
                
                for chunk in data["chunks"]:
                    student_context += f"\n[{chunk['source'].upper()}] {chunk['text']}"
                
                context_chunks.append(student_context + "\n" + "="*80)

            full_context = "\n\n".join(context_chunks)

            # Generate summary
            system_prompt = (
                "You are an expert technical recruiter. Analyze the candidate information "
                "and provide a clear, structured summary that helps make hiring decisions.\n\n"
                "For each candidate:\n"
                "1. Summarize their key qualifications and experience\n"
                "2. Highlight relevant skills matching the query\n"
                "3. Note any standout projects or achievements\n"
                "4. Provide an overall fit assessment\n\n"
                "Rank candidates by relevance and provide actionable recommendations."
            )

            user_prompt = (
                f"SEARCH QUERY: {query_text}\n\n"
                f"CANDIDATE DATA:\n{full_context}\n\n"
                f"Provide a recruiter-friendly analysis of these candidates."
            )

            logger.info("Generating LLM summary...")
            response_text = llm_client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1
            )

            logger.info("Query completed successfully")
            return response_text

        except Exception as e:
            logger.error(f"Query failed: {str(e)}", exc_info=True)
            raise

    # # can consider uncommenting below + inserting routes if we ever need these functions
    # # but for simplicity's sake, i'll comment them out first

    # def is_healthy(self) -> bool:
    #     """Check if GraphRAG service is operational."""
    #     try:
    #         test_embedding = custom_embed_model.get_query_embedding("health check")
    #         return len(test_embedding) > 0
    #     except Exception as e:
    #         logger.error(f"Health check failed: {str(e)}")
    #         return False

    # def clear_index(self) -> bool:
    #     """Clear all GraphRAG nodes from database."""
    #     try:
    #         VectorStore.delete_graph_nodes()
    #         logger.info("GraphRAG index cleared")
    #         return True
    #     except Exception as e:
    #         logger.error(f"Failed to clear index: {str(e)}")
    #         return False