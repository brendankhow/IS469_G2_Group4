from services.supabase_client import supabase
from typing import List, Dict, Optional
import ast

class VectorStore:
    @staticmethod
    def store_resume_embedding(
        student_id: str,
        resume_text: str,
        embedding: List[float],
        filename: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Store resume embedding in pgvector"""
        data = {
            "student_id": student_id,
            "resume_text": resume_text,
            "embedding": embedding,
            "filename": filename,
            "metadata": metadata or {}
        }
        
        response = supabase.table("resume_embeddings").insert(data).execute()
        return response.data[0]
    
    @staticmethod
    def store_resume_chunks(
        student_id: str,
        chunks: List[str],
        embeddings: List[List[float]],
        filename: str,
        metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Stores resume chunks and their embeddings.
        """
        if len(chunks) != len(embeddings):
            raise ValueError("Number of chunks and embeddings must match.")

        delete_response = supabase.table("resume_embeddings_chunk").delete().eq("student_id", student_id).execute()

        data_batch = [
            {
                "student_id": student_id,
                "chunk_text": chunk,
                "embedding": emb,
                "chunk_index": i,
                "filename": filename,
                "metadata": metadata or {} 
            }
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
            if chunk.strip() # Ensure chunk is not just whitespace
        ]

        if not data_batch:
            print("No valid chunks to store.")
            return []

        response = supabase.table("resume_embeddings_chunk").insert(data_batch).execute()
        return response.data
    
    @staticmethod
    def search_similar_resume_chunks(
        query_embedding: List[float],
        top_k: int = 10,
        threshold: float = 0.5
    ) -> List[Dict]:
        """
        Search for similar resume CHUNKS globally using the match_resume_chunks function.
        """
        row = supabase.table("resume_embeddings_chunk").select("embedding").limit(1).execute()
        embedding_str = row.data[0]["embedding"]
        response = supabase.rpc(
            "match_resume_chunks", # <-- SQL FUNCTION in supabase
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "match_threshold": threshold
            }
        ).execute()
        return response.data
    
    @staticmethod
    def search_similar_resumes(
        query_embedding: List[float],
        top_k: int = 10,
        threshold: float = 0.0
    ) -> List[Dict]:
        """ 
            Search for similar resumes using the match_resumes function
            Runs a vector similarity search using cosine similarity - match_resumes is a function defined in supabase
        """
        response = supabase.rpc(
            "match_resumes",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "match_threshold": threshold
            }
        ).execute()
        
        return response.data
    
    @staticmethod
    def get_resume_by_student_id(student_id: str) -> Optional[Dict]:
        """Get resume for a specific student"""
        response = supabase.table("resume_embeddings")\
            .select("*")\
            .eq("student_id", student_id)\
            .execute()
        return response.data[0] if response.data else None
    
    @staticmethod
    def update_resume_embedding(
        student_id: str,
        resume_text: str,
        embedding: List[float],
        filename: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Update existing resume embedding"""
        data = {
            "resume_text": resume_text,
            "embedding": embedding,
            "filename": filename,
            "metadata": metadata or {},
            "updated_at": "now()"
        }
        
        response = supabase.table("resume_embeddings")\
            .update(data)\
            .eq("student_id", student_id)\
            .execute()
        return response.data[0]
    
    @staticmethod
    def delete_resume_embedding(student_id: str) -> bool:
        """
        Delete resume embedding for a specific student.
        Returns True if successful, False otherwise.
        """
        try:
            response = supabase.table("resume_embeddings")\
                .delete()\
                .eq("student_id", student_id)\
                .execute()
            
            count = len(response.data) if response.data else 0
            print(f"Deleted {count} resume embedding(s) for student {student_id}")

            # delete chunked embeddings
            response_chunks = supabase.table("resume_embeddings_chunk")\
                .delete()\
                .eq("student_id", student_id)\
                .execute()

            chunk_count = len(response_chunks.data) if response_chunks.data else 0
            print(f"Deleted {chunk_count} chunk embedding(s) for student {student_id}")
            return True
        except Exception as e:
            print(f"Error deleting resume embedding for student {student_id}: {str(e)}")
            return False
    
    # ========== GitHub Portfolio Methods ==========
    
    @staticmethod
    def store_github_document(
        document_id: str,
        student_id: str,
        repo_name: str,
        text: str,
        embedding: List[float],
        metadata: Dict
    ) -> Dict:
        """
        Store a GitHub repository document (overview or README chunk) in pgvector.
        
        Args:
            document_id: Unique document ID (generated by GitHubDocumentProcessor)
            student_id: Student ID (UUID) who owns this portfolio
            repo_name: Repository name
            text: Document text content
            embedding: Vector embedding
            metadata: Rich metadata including repo_name, type, language, topics, etc.
            
        Returns:
            Inserted document data
        """
        data = {
            "document_id": document_id,
            "student_id": student_id,
            "repo_name": repo_name,
            "text": text,
            "embedding": embedding,
            "metadata": metadata
        }
        
        response = supabase.table("github_embeddings").insert(data).execute()
        return response.data[0]
    
    @staticmethod
    def store_github_documents_batch(
        documents: List[Dict],
        student_id: str
    ) -> List[Dict]:
        """
        Store multiple GitHub documents in batch.
        
        Args:
            documents: List of documents from GitHubDocumentProcessor
                      (each has 'id', 'text', 'embedding', 'metadata')
            student_id: Student ID (UUID) who owns this portfolio
            
        Returns:
            List of inserted documents
        """
        # Delete existing GitHub documents for this student to avoid duplicates
        VectorStore.delete_student_github_repos(student_id)
        
        data_batch = [
            {
                "document_id": doc["id"],
                "student_id": student_id,
                "repo_name": doc["metadata"].get("repo_name", ""),
                "text": doc["text"],
                "embedding": doc["embedding"],
                "metadata": doc["metadata"]
            }
            for doc in documents
        ]
        
        response = supabase.table("github_embeddings").insert(data_batch).execute()
        print(f"Stored {len(response.data)} GitHub documents for student {student_id}")
        return response.data
    
    @staticmethod
    def search_github_repos(
        query_embedding: List[float],
        student_id: str,
        top_k: int = 10,
        threshold: float = 0.5,
        language: Optional[str] = None,
        topics: Optional[List[str]] = None,
        min_stars: Optional[int] = None
    ) -> List[Dict]:
        """
        Search for relevant GitHub repositories using vector similarity.
        
        Args:
            query_embedding: Query vector embedding
            student_id: Student ID (UUID) to search within specific portfolio
            top_k: Number of results to return
            threshold: Minimum similarity threshold (default: 0.5)
            language: Filter by programming language (e.g., "Python")
            topics: Filter by topics (e.g., ["machine-learning", "web"])
            min_stars: Filter by minimum star count
            
        Returns:
            List of matching documents with similarity scores
        """
        # Call the match_github_repos RPC function
        params = {
            "query_embedding": query_embedding,
            "filter_student_id": student_id,
            "match_threshold": threshold,
            "match_count": top_k,
            "filter_language": language,
            "filter_topics": topics,
            "filter_min_stars": min_stars
        }
        
        response = supabase.rpc("match_github_repos", params).execute()
        
        return response.data
    
    @staticmethod
    def get_student_github_repos(student_id: str) -> List[Dict]:
        """
        Get all GitHub repository documents for a specific student.
        
        Args:
            student_id: Student ID (UUID)
            
        Returns:
            List of all GitHub documents for the student
        """
        response = supabase.table("github_embeddings")\
            .select("*")\
            .eq("student_id", student_id)\
            .execute()
        return response.data
    
    @staticmethod
    def delete_student_github_repos(student_id: str) -> int:
        """
        Delete all GitHub repository documents for a student.
        Useful when refreshing/updating portfolio data.
        
        Args:
            student_id: Student ID (UUID)
            
        Returns:
            Number of documents deleted
        """
        response = supabase.table("github_embeddings")\
            .delete()\
            .eq("student_id", student_id)\
            .execute()
        
        count = len(response.data) if response.data else 0
        print(f"Deleted {count} GitHub documents for student {student_id}")
        return count
    
    @staticmethod
    def get_student_portfolio_summary(student_id: str) -> Dict:
        """
        Fallback method to get portfolio summary by querying tables directly.
        Used when the RPC function has type mismatches or fails.
        
        Args:
            student_id: Student ID (UUID)
            
        Returns:
            Summary dictionary with stats
        """
        try:
            # Get profile info
            profile_response = supabase.table("profiles").select("name, github_username").eq("id", student_id).execute()
            profile = profile_response.data[0] if profile_response.data else {}
            
            # Get GitHub repos count and languages from github_embeddings table
            github_response = supabase.table("github_embeddings").select("repo_name, metadata").eq("student_id", student_id).execute()
            
            repos = github_response.data if github_response.data else []
            
            # Get unique repos
            unique_repos = {}
            for item in repos:
                repo_name = item.get('repo_name')
                if repo_name and repo_name not in unique_repos:
                    unique_repos[repo_name] = item.get('metadata', {})
            
            total_repos = len(unique_repos)
            
            # Extract languages and stars
            languages = []
            total_stars = 0
            for repo_name, metadata in unique_repos.items():
                if isinstance(metadata, dict):
                    lang = metadata.get('language')
                    if lang and lang not in languages:
                        languages.append(lang)
                    stars = metadata.get('stars', 0)
                    if isinstance(stars, (int, float)):
                        total_stars += int(stars)
            
            # Get resume chunks count
            resume_response = supabase.table("resume_embeddings").select("id", count="exact").eq("student_id", student_id).execute()
            total_resume_chunks = resume_response.count if resume_response.count else 0
            
            return {
                "student_name": profile.get("name"),
                "github_username": profile.get("github_username"),
                "total_repos": total_repos,
                "total_resume_chunks": total_resume_chunks,
                "top_languages": languages[:5],  # Top 5 languages
                "total_stars": int(total_stars),
                "repositories": list(unique_repos.keys())  # List of repo names
            }
        except Exception as e:
            print(f"Error in fallback portfolio summary: {str(e)}")
            return {
                "student_name": None,
                "github_username": None,
                "total_repos": 0,
                "total_resume_chunks": 0,
                "top_languages": [],
                "total_stars": 0
            }
    
    @staticmethod
    def search_unified_portfolio(
        query_embedding: List[float],
        student_id: str,
        top_k: int = 10,
        threshold: float = 0.5,
        source_filter: Optional[str] = None
    ) -> List[Dict]:
        """
        Search across both resume and GitHub portfolio data using the unified RPC function.
        Creates a unified knowledge base view.
        
        Args:
            query_embedding: Query vector embedding
            student_id: Student ID (UUID)
            top_k: Total number of results to return
            threshold: Minimum similarity threshold (default: 0.5)
            source_filter: Filter by source - 'resume', 'github', or None for both
            
        Returns:
            List of results with 'source' field indicating origin ('resume' or 'github')
        """
        response = supabase.rpc(
            "match_student_portfolio",
            {
                "query_embedding": query_embedding,
                "filter_student_id": student_id,
                "match_threshold": threshold,
                "match_count": top_k,
                "source_filter": source_filter
            }
        ).execute()
        
        return response.data
    
    @staticmethod
    def search_unified_portfolio_grouped(
        query_embedding: List[float],
        student_id: str,
        top_k: int = 10,
        threshold: float = 0.5
    ) -> Dict[str, List[Dict]]:
        """
        Search across both resume and GitHub portfolio data, grouped by source.
        Alternative to search_unified_portfolio that returns grouped results.
        
        Args:
            query_embedding: Query vector embedding
            student_id: Student ID (UUID)
            top_k: Number of results per source
            threshold: Minimum similarity threshold
            
        Returns:
            Dictionary with 'resume' and 'github' keys containing results
        """
        all_results = VectorStore.search_unified_portfolio(
            query_embedding=query_embedding,
            student_id=student_id,
            top_k=top_k * 2,  # Get more to ensure enough per source
            threshold=threshold
        )
        
        # Group by source
        grouped = {
            "resume": [],
            "github": []
        }
        
        for result in all_results:
            source = result.get("source", "")
            if source in grouped:
                grouped[source].append(result)
        
        # Limit each source to top_k
        grouped["resume"] = grouped["resume"][:top_k]
        grouped["github"] = grouped["github"][:top_k]
        
        return grouped
    @staticmethod
    def search_student_resume(
        student_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        Performs a semantic search for the most relevant chunks
        within a SINGLE student's resume.
        """
        response = supabase.rpc(
            "match_resumes",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "match_threshold": threshold
            }
        ).eq(
            "student_id", student_id 
        ).execute()
        
        return response.data

    # ========== graphRAG methods ==========

    @staticmethod
    def store_graph_node(
        node_id: str,
        student_id: str,
        text: str,
        embedding: List[float],
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Store a single graph node (entity or chunk) with embedding and metadata.
        Each node should have a student_id so recruiters know which candidate it belongs to.
        """
        data = {
            "node_id": node_id,
            "student_id": student_id,
            "text": text,
            "embedding": embedding,
            "metadata": metadata or {}
        }
        response = supabase.table("graphrag_portfolio").insert(data).execute()
        return response.data[0]

    @staticmethod
    def store_graph_nodes_batch(
        nodes: List[Dict]
    ) -> List[Dict]:
        """
        Store multiple graph nodes in a single batch insert.

        """
        data_batch = [
            {
                "node_id": node["id"],
                "student_id": node.get("student_id", "unknown"),
                "student_name": node.get("student_name", "Unknown"),
                "student_email": node.get("student_email", "Unknown"),
                "github_username": node.get("github_username", "unknown"),
                "text": node["text"],
                "embedding": node["embedding"],
                "metadata": node.get("metadata", {})
            }
            for node in nodes
        ]
        response = supabase.table("graphrag_portfolio").insert(data_batch).execute()
        print(f"Stored {len(response.data)} GraphRAG nodes in graphrag_portfolio")
        return response.data

    @staticmethod
    def search_graph_nodes(
        query_embedding: List[float],
        top_k: int = 10,
        threshold: float = 0.5,
        filters: Optional[Dict] = None  # optional metadata filters for recruiter queries
    ) -> List[Dict]:
        """
        Search for relevant graph nodes (chunks/entities) globally across all students.
        Optional filters can restrict results by skills, roles, language, or source.
        
        Supported filters:
        - filter_skill: Filter by skills
        - filter_role: Filter by role
        - filter_language: Filter by programming language (e.g., "JavaScript", "Python")
        - filter_source: Filter by source type ("resume" or "github")
        """

        params = {
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": top_k
        }

        # handling of optional filters
        if filters:
            if 'filter_skill' in filters:
                params['filter_skill'] = filters['filter_skill']
            if 'filter_role' in filters:
                params['filter_role'] = filters['filter_role']
            if 'filter_language' in filters:
                params['filter_language'] = filters['filter_language']
            if 'filter_source' in filters:
                params['filter_source'] = filters['filter_source']
            
        try:
            print(f"Executing RPC match_graph_nodes with params: {list(params.keys())}")
            response = supabase.rpc("match_graph_nodes", params).execute()
            return response.data
        except Exception as e:
            print(f"Warning: match_graph_nodes RPC failed: {e}")
            return []

    @staticmethod
    def delete_graph_nodes(student_id: Optional[str] = None) -> int:
        """
        Delete GraphRAG nodes.
        If student_id is provided, deletes only that student's nodes.
        Otherwise, deletes all nodes (use with caution!).
        """
        query = supabase.table("graphrag_portfolio").delete()
        if student_id:
            query = query.eq("student_id", student_id)
        response = query.execute()
        count = len(response.data) if response.data else 0
        if student_id:
            print(f"Deleted {count} GraphRAG nodes for student {student_id}")
        else:
            print(f"Deleted {count} GraphRAG nodes globally")
        return count

    @staticmethod
    def get_all_candidates_documents() -> List[Dict]:
        """
        Get all candidate documents (resumes and GitHub repos) and info for GraphRAG indexing.
        Returns documents in a format compatible with GraphRAG processing.
        """
        all_documents = []

        # get all resume documents

        resume_response = supabase.table("resume_embeddings")\
            .select("student_id, resume_text, filename, metadata, student_name, student_email")\
            .execute()

        for resume in resume_response.data:
            # skip empty resumes
            if not resume.get('resume_text') or not resume['resume_text'].strip():
                continue

            all_documents.append({
                "doc_id": f"resume_{resume['student_id']}",
                "student_id": resume['student_id'],
                "text": resume['resume_text'],
                "source": "resume",
                "filename": resume.get('filename', 'unknown'),
                "metadata": resume.get('metadata', {}),
                "student_name": resume.get('student_name'),
                "student_email": resume.get('student_email'),
                "github_username": None
            })

        # get all github documents

        github_response = supabase.table("github_embeddings_with_profile")\
            .select("student_id, document_id, text, repo_name, github_username, metadata, student_name, student_email")\
            .execute()

        for github_doc in github_response.data:
            # skip empty documents
            if not github_doc.get('text') or not github_doc['text'].strip():
                continue

            all_documents.append({
                "doc_id": github_doc['document_id'],
                "student_id": github_doc['student_id'],
                "text": github_doc['text'],
                "source": "github",
                "repo_name": github_doc.get('repo_name', 'unknown'),
                "github_username": github_doc.get('github_username'),
                "metadata": github_doc.get('metadata', {}),
                "student_name": github_doc.get('student_name'),
                "student_email": github_doc.get('student_email')
            })

        print(f"Retrieved {len(all_documents)} total documents for GraphRAG indexing")
        print(f"  - Resumes: {len([d for d in all_documents if d['source'] == 'resume'])}")
        print(f"  - GitHub docs: {len([d for d in all_documents if d['source'] == 'github'])}")

        return all_documents