from typing import List, Dict, Optional, Any
from llama_index.core.indices.property_graph import PropertyGraphIndex, ImplicitPathExtractor
from llama_index.core.schema import Document as LlamaDocument
from llama_index.core import Settings
import json
import logging
import numpy as np

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
        self.reranker = None  # lazy load reranker model
        
    def _get_reranker(self):
        """Lazy load (load only when needed) cross-encoder reranker model."""
        if self.reranker is None:
            try:
                from sentence_transformers import CrossEncoder
                logger.info("Loading cross-encoder reranker model...")
                
                models_to_try = [
                    'BAAI/bge-reranker-base',                 # Better for general semantic understanding
                    'cross-encoder/ms-marco-MiniLM-L-12-v2',  # Larger MS-MARCO model
                    'cross-encoder/ms-marco-MiniLM-L-6-v2'
                ]
                
                for model_name in models_to_try:
                    try:
                        logger.info(f"Trying to load: {model_name}")
                        self.reranker = CrossEncoder(model_name)
                        logger.info(f"Successfully loaded reranker: {model_name}")
                        break
                    except Exception as e:
                        logger.warning(f"Failed to load {model_name}: {str(e)}")
                        continue
                
                if self.reranker is None:
                    raise Exception("Failed to load any reranker model")
                    
            except ImportError:
                logger.error("sentence-transformers not installed. Install with: pip install sentence-transformers")
                raise
            except Exception as e:
                logger.error(f"Failed to load reranker model: {str(e)}")
                raise
        return self.reranker

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

    def _rerank_candidates(
        self, 
        query_text: str, 
        student_contexts: Dict[str, Dict], 
        top_k: int
    ) -> Dict[str, Dict]:
        """
        Rerank candidates (not individual nodes) using cross-encoder.
        
        Args:
            query_text: Original search query
            student_contexts: Dict mapping student_id to their node context
            top_k: Number of top candidates to return
            
        Returns:
            Reranked student_contexts dict
        """
        if not student_contexts or len(student_contexts) <= 1:
            return student_contexts
        
        try:
            logger.info(f"Reranking {len(student_contexts)} candidates with cross-encoder...")
            
            reranker = self._get_reranker()
            
            # build aggregated text for each candidate
            candidate_list = []
            for student_id, context in student_contexts.items():
                nodes = context["nodes"]
                
                combined_text = ""
                
                first_node = nodes[0]
                student_name = first_node.get("student_name", "Unknown")
                github = first_node.get("github_username", "")
                
                combined_text += f"Candidate: {student_name}\n"
                if github:
                    combined_text += f"GitHub: {github}\n"
                
                node_texts = []
                for node in nodes:
                    text = node.get("text", "").strip()
                    metadata = node.get("metadata", {})
                    
                    # enrich GitHub nodes with metadata
                    if metadata.get("source") == "github":
                        repo = metadata.get("repo_name", "")
                        lang = metadata.get("language", "")
                        if repo:
                            text += f" [Repo: {repo}]"
                        if lang:
                            text += f" [Language: {lang}]"
                    
                    node_texts.append(text)
                
                # combine node texts but limit total length to 2000 chars for cross-encoder
                combined_text += "\n".join(node_texts)[:2000]
                
                candidate_list.append({
                    "student_id": student_id,
                    "text": combined_text,
                    "context": context
                })
            
            # prepare query-candidate pairs
            pairs = [(query_text, candidate["text"]) for candidate in candidate_list]
            
            # get relevance scores from cross-encoder
            scores = reranker.predict(pairs)
            scores = np.array(scores)
            
            # get indices sorted by score (descending)
            ranked_indices = np.argsort(scores)[::-1]
            
            # reorder candidates and update scores
            reranked_contexts = {}
            for rank, idx in enumerate(ranked_indices[:top_k]):
                candidate = candidate_list[int(idx)]
                student_id = candidate["student_id"]
                context = candidate["context"]
                
                # update max_similarity with reranker score
                context["max_similarity"] = float(scores[idx])
                context["rerank_position"] = rank + 1
                context["original_similarity"] = context.get("max_similarity", 0.0)
                
                reranked_contexts[student_id] = context
            
            logger.info(f"Successfully reranked to {len(reranked_contexts)} candidates")
            top_scores = [f"{list(reranked_contexts.values())[i]['max_similarity']:.3f}" 
                         for i in range(min(3, len(reranked_contexts)))]
            logger.info(f"Top 3 candidate rerank scores: {top_scores}")
            
            return reranked_contexts
            
        except Exception as e:
            logger.warning(f"Candidate reranking failed: {str(e)}, using original order")
            # return top_k from original
            return dict(list(student_contexts.items())[:top_k])

    def query_candidates(
        self,
        query_text: str,
        top_k: int = 3,
        nodes_per_candidate: int = 5,
        filters: Optional[Dict] = None,
        use_reranking: bool = False,    # can change to True if we want reranking enabled
        neighbor_depth: int = 2         # how many graph hops to include
    ) -> Dict:
        """
        Search GraphRAG nodes and return top_k candidates.

        Args:
            query_text: Search query
            top_k: Number of candidates to return (default: 3)
            nodes_per_candidate: Maximum nodes per candidate to prevent imbalance
            filters: Optional filters for search
            use_reranking: Whether to apply cross-encoder reranking at candidate level (but default value is False)
            neighbor_depth: Depth of neighbor traversal in graph for context

        Returns:
            Dict with structured JSON of top candidates
        """
        try:
            logger.info(f"Processing query: {query_text[:100]}")

            query_embedding = custom_embed_model.get_query_embedding(query_text)

            # retrieve more nodes initially to ensure candidate diversity
            initial_retrieval_size = top_k * nodes_per_candidate * 4
            retrieved_nodes = VectorStore.search_graph_nodes(
                query_embedding=query_embedding,
                top_k=initial_retrieval_size,
                filters=filters,
                threshold=0.3
            )

            if not retrieved_nodes:
                return {"success": True, "query": query_text, "results": []}

            # expand nodes using graph neighbours
            expanded_nodes = []
            for node in retrieved_nodes:
                expanded_nodes.append(node)
                if neighbor_depth > 0 and hasattr(node, "node_id"):
                    # get neighbours from the PropertyGraphIndex
                    try:
                        neighbors = index.get_neighbors(node["node_id"], depth=neighbor_depth)
                        for n in neighbors:
                            n_metadata = n.metadata if hasattr(n, "metadata") else {}
                            expanded_nodes.append({
                                "student_id": n_metadata.get("student_id"),
                                "text": n.get_content() if hasattr(n, "get_content") else str(n),
                                "metadata": n_metadata,
                                "similarity": node.get("similarity", 0.0)
                            })
                    except Exception as e:
                        logger.warning(f"Failed to get neighbors for node {node.get('node_id')}: {str(e)}")

            # group nodes by candidate with diversity control
            student_contexts = {}

            for node in expanded_nodes:
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

            # apply candidate-level reranking if enabled
            if use_reranking and len(student_contexts) > 1:
                student_contexts = self._rerank_candidates(
                    query_text=query_text,
                    student_contexts=student_contexts,
                    top_k=top_k
                )
            else:
                # sort candidates by their best matching node and take top_k
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
                temperature=0.1,
                max_tokens=2048
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