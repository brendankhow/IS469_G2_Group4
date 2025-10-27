from typing import List, Dict, Any, Optional
from config.feature_flags import feature_flags
from services.customrag_service import CustomRAGService
from services.graphrag_service import GraphRAGService  

class RAGFactory:
    """Factory for Custom and Graph RAG strategies"""
    
    def __init__(self):
        self.customrag_service = CustomRAGService()
        self.graphrag_service = GraphRAGService()  # Initialize Graph RAG
    
    def search_candidates(
        self, 
        query_text: str,
        top_k: int = 5,
        filters: Optional[dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for candidates using Custom RAG or Graph RAG
        
        1. Graph RAG (if enabled)
        2. Custom RAG (if enabled)
        
        Args:
            query_text: The search query text
            top_k: Number of results to return
            filters: Optional filters for Custom/Graph RAG
            
        Returns:
            List of candidate matches
        """
        
        # Graph RAG
        if feature_flags.ENABLE_GRAPH_RAG:
            print("Using Graph RAG")
            return self._graph_rag_search(query_text, top_k, filters)
        
        # Custom RAG
        elif feature_flags.ENABLE_CUSTOM_RAG:
            print("Using Custom RAG")
            return self._custom_rag_search(query_text, top_k, filters)
        
        else:
            raise ValueError("RAGFactory called but no RAG strategy enabled")
    
    def _custom_rag_search(self, query_text: str, top_k: int, filters: Optional[dict]) -> List[Dict[str, Any]]:
        return self.customrag_service.query_custom_rag(
            query_text=query_text,
            top_k=top_k,
            filters=filters
        )
    
    def _graph_rag_search(self, query_text: str, top_k: int, filters: Optional[dict]) -> List[Dict[str, Any]]:
        result = self.graphrag_service.query_candidates(
            query_text=query_text,
            top_k=top_k,
            filters=filters
        )
        # Return the response from Graph RAG
        return result.get("response", []) if isinstance(result, dict) else result