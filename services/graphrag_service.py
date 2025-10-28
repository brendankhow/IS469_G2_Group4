from typing import List, Dict, Optional, Any
from llama_index.core.indices.property_graph import PropertyGraphIndex, ImplicitPathExtractor
from llama_index.core.schema import Document as LlamaDocument
from llama_index.core import Settings
import json
import logging

from .vector_store import VectorStore
from .llama_wrappers import custom_llm, custom_embed_model, local_llm_client

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
        Builds the GraphRAG index for all students' documents and info and stores nodes in Supabase.
        """
        try:
            Settings.llm = custom_llm
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
                        "filename": doc.get("filename") or doc.get("repo_name", "unknown"),
                        "student_name": doc.get("student_name"),
                        "student_email": doc.get("student_email"),
                        "github_username": doc.get("github_username"),
                        **(doc.get("metadata", {}) if isinstance(doc.get("metadata"), dict) else {})
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
                embed_model=custom_embed_model,
                show_progress=True,
                kg_extractors=[ImplicitPathExtractor()]
            )

            logger.info("Extracting and embedding nodes...")
            all_node_ids = list(index.docstore.docs.keys())
            all_nodes = [index.docstore.get_node(node_id) for node_id in all_node_ids]

            node_texts = []
            for node in all_nodes:
                base_text = node.get_content()
                metadata = node.metadata
                if metadata.get("source") == "github":
                    enriched = base_text
                    enriched += f"\n\nRepository: {metadata.get('repo_name', 'unknown')}"
                    enriched += f"\nLanguage: {metadata.get('language', 'unknown')}"
                    if metadata.get('topics'):
                        enriched += f"\nTopics: {', '.join(metadata.get('topics', []))}"
                    enriched += f"\nGitHub User: {metadata.get('github_username', 'unknown')}"
                    node_texts.append(enriched)
                else:
                    node_texts.append(base_text)

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
                    "student_id": node.metadata.get("student_id"),
                    "text": node.get_content(),
                    "embedding": embedding,
                    "metadata": node.metadata,
                    "student_name": node.metadata.get("student_name"),
                    "student_email": node.metadata.get("student_email"),
                    "github_username": node.metadata.get("github_username")
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
        top_k: int = 3,
        nodes_per_candidate: int = 5,
        filters: Optional[Dict] = None
    ) -> Dict:
        """
        Search GraphRAG nodes and return top_k candidates with balanced representation.
        
        Args:
            query_text: Search query
            top_k: Number of candidates to return (default: 3)
            nodes_per_candidate: Maximum nodes per candidate to prevent imbalance
            filters: Optional filters for search
        """
        try:
            logger.info(f"Processing query: {query_text[:100]}")

            query_embedding = custom_embed_model.get_query_embedding(query_text)
            
            # retrieve more nodes initially to ensure candidate diversity
            retrieved_nodes = VectorStore.search_graph_nodes(
                query_embedding=query_embedding,
                top_k=top_k * nodes_per_candidate * 3,  # 3 * 5 * 3 = 45 nodes
                filters=filters,
                threshold=0.3
            )

            if not retrieved_nodes:
                return {"success": True, "query": query_text, "results": []}

            # group nodes by candidate with diversity control
            student_contexts = {}
            
            for node in retrieved_nodes:
                sid = node.get("student_id")
                similarity = node.get("similarity", 0.0)

                if sid not in student_contexts:
                    student_contexts[sid] = {
                        "nodes": [],
                        "max_similarity": similarity
                    }
                
                # limit nodes per candidate to prevent one candidate from dominating
                if len(student_contexts[sid]["nodes"]) < nodes_per_candidate:
                    student_contexts[sid]["nodes"].append(node)
                    if similarity > student_contexts[sid]["max_similarity"]:
                        student_contexts[sid]["max_similarity"] = similarity

            # sort candidates by their best matching node and take top_k (top 3)
            sorted_candidates = sorted(
                student_contexts.items(),
                key=lambda x: x[1]["max_similarity"],
                reverse=True
            )[:top_k]
            
            student_contexts = dict(sorted_candidates)

            # build candidate context block for prompt
            candidates_block = ""
            for sid, info in student_contexts.items():
                first_node = info["nodes"][0]
                student_name = first_node.get("student_name")
                student_email = first_node.get("student_email")
                github_username = first_node.get("github_username")

                candidates_block += f"CANDIDATE ID: {sid}\n"
                candidates_block += f"RELEVANCE SCORE: {info['max_similarity']:.2f}\n"
                candidates_block += f"NAME: {student_name}\n"
                candidates_block += f"EMAIL: {student_email}\n"
                if github_username:
                    candidates_block += f"GITHUB: {github_username}\n"
                candidates_block += "\n".join([n.get("text") for n in info["nodes"]]) + "\n" + "="*60 + "\n"

            # JSON-enforcing prompt
            system_prompt = (
                "You are an expert technical recruiter. Analyze the candidate data and output JSON only.\n\n"
                "JSON schema:\n"
                "{\n"
                "  'success': true,\n"
                "  'query': '<original query>',\n"
                "  'results': [\n"
                "     {\n"
                "       'candidate_id': '<student_id>',\n"
                "       'student_name': '<name>',\n"
                "       'student_email': '<email>',\n"
                "       'github_username': '<github>',\n"
                "       'summary': '<brief summary>',\n"
                "       'key_skills': ['list of skills'],\n"
                "       'fit_assessment': '<suitability summary>',\n"
                "       'relevance_score': <float>\n"
                "     }\n"
                "  ]\n"
                "}\n"
                "IMPORTANT: All fields must be filled. If a candidate is not a good fit, explain why in the fit_assessment. "
                "For summary, always provide a brief overview of the candidate's background even if limited. "
                "Return only valid JSON — no extra text."
            )

            user_prompt = f"QUERY: {query_text}\n\nCANDIDATES:\n{candidates_block}"

            response_text = local_llm_client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1
            )

            # Parse JSON safely
            try:
                parsed = json.loads(response_text)
            except json.JSONDecodeError:
                logger.warning("LLM returned invalid JSON — wrapping manually")
                parsed = {
                    "success": True,
                    "query": query_text,
                    "raw_output": response_text
                }

            return parsed

        except Exception as e:
            logger.error(f"Query failed: {str(e)}", exc_info=True)
            return {"success": False, "query": query_text, "error": str(e)}

    @staticmethod
    def delete_nodes(student_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete GraphRAG nodes via VectorStore.
        
        Args:
            student_id: optional student ID
                        if provided, deletes only that student's nodes
                        if None, deletes all nodes
        
        Returns:
            Dict containing success status, count of deleted nodes, and message
        """
        try:
            count = VectorStore.delete_graph_nodes(student_id)
            
            return {
                "success": True,
                "count": count,
                "message": f"Successfully deleted {count} nodes" + 
                          (f" for student {student_id}" if student_id else " globally")
            }
        except Exception as e:
            print(f"Error deleting GraphRAG nodes: {str(e)}")
            return {
                "success": False,
                "count": 0,
                "message": f"Failed to delete nodes: {str(e)}"
            }