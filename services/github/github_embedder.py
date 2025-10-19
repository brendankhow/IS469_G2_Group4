import re
import hashlib
from typing import List, Dict, Optional
from services.embedder import embedder


class GitHubDocumentProcessor:
    """
    Processes GitHub repository data into embeddable documents with chunking support.
    Integrates with existing EmbeddingService for vector generation.
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize the GitHub document processor.
        
        Args:
            chunk_size: Maximum characters per chunk (default: 1000)
            chunk_overlap: Overlap between chunks to preserve context (default: 200)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedder = embedder  # Reuse existing embedder instance
    
    def chunk_text(self, text: str, preserve_paragraphs: bool = True) -> List[str]:
        """
        Intelligently chunk text while preserving context.
        
        Args:
            text: Text to chunk
            preserve_paragraphs: If True, tries to break at paragraph boundaries
            
        Returns:
            List of text chunks
        """
        if not text or len(text) <= self.chunk_size:
            return [text] if text else []
        
        chunks = []
        
        if preserve_paragraphs:
            # Split by double newlines (paragraphs) first
            paragraphs = re.split(r'\n\s*\n', text)
            current_chunk = ""
            
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                
                # If paragraph itself is too long, split it
                if len(para) > self.chunk_size:
                    # Save current chunk if it exists
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                        current_chunk = ""
                    
                    # Split long paragraph into sentences
                    sentences = re.split(r'(?<=[.!?])\s+', para)
                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                            current_chunk += sentence + " "
                        else:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = sentence + " "
                    continue
                
                # Check if adding this paragraph exceeds chunk size
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk += para + "\n\n"
                else:
                    # Save current chunk and start new one
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = para + "\n\n"
            
            # Add remaining chunk
            if current_chunk:
                chunks.append(current_chunk.strip())
        else:
            # Simple character-based chunking with overlap
            start = 0
            while start < len(text):
                end = start + self.chunk_size
                
                # Try to break at word boundary
                if end < len(text):
                    # Look for last space before end
                    last_space = text.rfind(' ', start, end)
                    if last_space > start:
                        end = last_space
                
                chunk = text[start:end].strip()
                if chunk:
                    chunks.append(chunk)
                
                # Move start position with overlap
                start = end - self.chunk_overlap if end < len(text) else end
        
        return chunks
    
    def generate_chunk_id(self, repo_name: str, chunk_type: str, index: int = 0) -> str:
        """
        Generate unique ID for a document chunk.
        
        Args:
            repo_name: Repository name
            chunk_type: Type of chunk (overview, readme, description)
            index: Chunk index for multi-chunk documents
            
        Returns:
            Unique chunk ID
        """
        content = f"{repo_name}_{chunk_type}_{index}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def create_overview_document(self, repo_data: Dict) -> Dict:
        """
        Create a high-level overview document for a repository.
        This is always a single document (no chunking).
        
        Args:
            repo_data: Repository data from GitHubDataFetcher
            
        Returns:
            Document dictionary ready for embedding
        """
        # Calculate language percentages
        languages = repo_data.get("languages", {})
        total_bytes = sum(languages.values()) if languages else 0
        language_breakdown = []
        
        if total_bytes > 0:
            for lang, bytes_count in sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]:
                percentage = (bytes_count / total_bytes) * 100
                language_breakdown.append(f"{lang} ({percentage:.1f}%)")
        
        # Build overview text
        overview_parts = [
            f"Repository: {repo_data.get('name', 'Unknown')}",
            f"Description: {repo_data.get('description', 'No description')}" if repo_data.get('description') else None,
            f"Primary Language: {repo_data.get('language', 'Not specified')}" if repo_data.get('language') else None,
            f"Languages: {', '.join(language_breakdown)}" if language_breakdown else None,
            f"Topics: {', '.join(repo_data.get('topics', []))}" if repo_data.get('topics') else None,
            f"Stars: {repo_data.get('stars', 0)}, Forks: {repo_data.get('forks', 0)}",
            f"License: {repo_data.get('license', 'No license')}" if repo_data.get('license') else None,
            f"Homepage: {repo_data.get('homepage')}" if repo_data.get('homepage') else None,
        ]
        
        overview_text = "\n".join([part for part in overview_parts if part])
        
        # Create metadata
        metadata = {
            "type": "overview",
            "repo_name": repo_data.get("name", ""),
            "repo_url": repo_data.get("url", ""),
            "language": repo_data.get("language", ""),
            "languages": list(languages.keys()) if languages else [],
            "topics": repo_data.get("topics", []),
            "stars": repo_data.get("stars", 0),
            "forks": repo_data.get("forks", 0),
            "is_fork": repo_data.get("is_fork", False),
            "is_archived": repo_data.get("is_archived", False),
            "created_at": repo_data.get("created_at", ""),
            "updated_at": repo_data.get("updated_at", ""),
        }
        
        return {
            "id": self.generate_chunk_id(repo_data.get("name", "unknown"), "overview"),
            "text": overview_text,
            "metadata": metadata
        }
    
    def create_readme_documents(self, repo_data: Dict) -> List[Dict]:
        """
        Create chunked documents from repository README.
        
        Args:
            repo_data: Repository data from GitHubDataFetcher
            
        Returns:
            List of document dictionaries (one per chunk)
        """
        readme = repo_data.get("readme", "")
        if not readme:
            return []
        
        # Clean README (remove excessive markdown, but keep structure)
        readme = self._clean_readme(readme)
        
        # Chunk the README
        chunks = self.chunk_text(readme, preserve_paragraphs=True)
        
        documents = []
        repo_name = repo_data.get("name", "unknown")
        
        for i, chunk in enumerate(chunks):
            # Base metadata (same for all chunks)
            metadata = {
                "type": "readme",
                "repo_name": repo_name,
                "repo_url": repo_data.get("url", ""),
                "language": repo_data.get("language", ""),
                "topics": repo_data.get("topics", []),
                "stars": repo_data.get("stars", 0),
                "chunk_index": i,
                "total_chunks": len(chunks),
            }
            
            # Add context prefix for better search
            context_prefix = f"README from {repo_name}:\n\n"
            full_text = context_prefix + chunk
            
            documents.append({
                "id": self.generate_chunk_id(repo_name, "readme", i),
                "text": full_text,
                "metadata": metadata
            })
        
        return documents
    
    def _clean_readme(self, readme: str) -> str:
        """
        Clean README content while preserving important information.
        
        Args:
            readme: Raw README text
            
        Returns:
            Cleaned README text
        """
        # Remove HTML comments
        readme = re.sub(r'<!--.*?-->', '', readme, flags=re.DOTALL)
        
        # Remove excessive blank lines
        readme = re.sub(r'\n{3,}', '\n\n', readme)
        
        # Remove markdown image syntax but keep alt text
        readme = re.sub(r'!\[(.*?)\]\(.*?\)', r'\1', readme)
        
        # Simplify markdown links - keep text, remove URLs
        readme = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', readme)
        
        # Remove HTML tags
        readme = re.sub(r'<[^>]+>', '', readme)
        
        # Clean up code blocks - keep the code but simplify markers
        readme = re.sub(r'```\w*\n', '\nCode:\n', readme)
        readme = re.sub(r'```', '', readme)
        
        return readme.strip()
    
    def process_repository(self, repo_data: Dict) -> List[Dict]:
        """
        Process a complete repository into multiple embeddable documents.
        
        Args:
            repo_data: Repository data from GitHubDataFetcher
            
        Returns:
            List of all documents (overview + README chunks)
        """
        documents = []
        
        # Always create overview document
        overview = self.create_overview_document(repo_data)
        documents.append(overview)
        
        # Add README chunks if available
        readme_docs = self.create_readme_documents(repo_data)
        documents.extend(readme_docs)
        
        print(f"Processed {repo_data.get('name')}: {len(documents)} documents (1 overview + {len(readme_docs)} README chunks)")
        
        return documents
    
    def process_repositories_batch(self, repos_data: List[Dict]) -> List[Dict]:
        """
        Process multiple repositories into embeddable documents.
        
        Args:
            repos_data: List of repository data from GitHubDataFetcher
            
        Returns:
            List of all documents from all repositories
        """
        all_documents = []
        
        for repo in repos_data:
            try:
                docs = self.process_repository(repo)
                all_documents.extend(docs)
            except Exception as e:
                print(f"Error processing repository {repo.get('name', 'unknown')}: {str(e)}")
                continue
        
        print(f"\nTotal documents created: {len(all_documents)}")
        return all_documents
    
    def embed_documents(self, documents: List[Dict]) -> List[Dict]:
        """
        Generate embeddings for all documents using existing EmbeddingService.
        
        Args:
            documents: List of document dictionaries with 'text' field
            
        Returns:
            Documents with added 'embedding' field
        """
        print(f"Generating embeddings for {len(documents)} documents...")
        
        # Extract texts for batch embedding
        texts = [doc["text"] for doc in documents]
        
        # Use existing embedder's batch method
        embeddings = self.embedder.generate_embeddings_batch(texts)
        
        # Add embeddings to documents
        for doc, embedding in zip(documents, embeddings):
            doc["embedding"] = embedding
        
        print(f"Embeddings generated! Dimension: {len(embeddings[0]) if embeddings else 0}")
        return documents
    
    def process_and_embed_repositories(self, repos_data: List[Dict]) -> List[Dict]:
        """
        Complete pipeline: process repositories and generate embeddings.
        
        Args:
            repos_data: List of repository data from GitHubDataFetcher
            
        Returns:
            List of documents with embeddings ready for storage
        """
        # Step 1: Process into documents with metadata
        documents = self.process_repositories_batch(repos_data)
        
        # Step 2: Generate embeddings
        documents_with_embeddings = self.embed_documents(documents)
        
        return documents_with_embeddings


# Convenience function for easy import
def process_github_repos(
    repos_data: List[Dict],
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[Dict]:
    """
    Process GitHub repositories into embedded documents.
    
    This is the main callable function for processing GitHub data.
    
    Args:
        repos_data: List of repository data from GitHubDataFetcher
        chunk_size: Maximum characters per chunk (default: 1000)
        chunk_overlap: Overlap between chunks (default: 200)
        
    Returns:
        List of documents with embeddings and metadata
        
    Example:
        >>> from services.github_client import fetch_all_user_repos_data
        >>> from services.github_embedder import process_github_repos
        >>> 
        >>> # Fetch repos
        >>> repos = fetch_all_user_repos_data("username")
        >>> 
        >>> # Process and embed
        >>> documents = process_github_repos(repos)
        >>> 
        >>> # Now store in vector database
        >>> # (see vector_store.py for storage methods)
    """
    processor = GitHubDocumentProcessor(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return processor.process_and_embed_repositories(repos_data)
