from typing import List, Dict, Any, Optional
from config.feature_flags import feature_flags
from services.customrag_service import CustomRAGService
from services.graphrag_service import GraphRAGService  

class RAGFactory:
    """Factory for Custom and Graph RAG strategies"""
    
    def __init__(self):
        self.customrag_service = CustomRAGService()
        self.graphrag_service = GraphRAGService()  
    
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
            results = self._graph_rag_search(query_text, top_k, filters)
        
        # Custom RAG
        elif feature_flags.ENABLE_CUSTOM_RAG:
            print("Using Custom RAG")
            results = self._custom_rag_search(query_text, top_k, filters)
        
        else:
            raise ValueError("RAGFactory called but no RAG strategy enabled")
        
        return self._standardize_results(results)
    
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
        if isinstance(result, dict):
            return [result]
    
        # Already a list (in case they update to return multiple)
        elif isinstance(result, list):
            return result
    
    def _standardize_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalize field names across different RAG implementations
        
        Custom RAG format:
        {
            "student_id": "...",
            "max_similarity": 0.417,
            "student_name": "...",
            "best_chunk": {
                "id": "...",
                "text": "...",
                "source": "resume",
                "filename": "..."
            }
        }

        Graph RAG format:
       {
            "candidate_id": "",
            "student_name": "Jim",
            "student_email": "student@test.com",
            "github_username": "drawrowfly",
            "summary": "",
            "fit_assessment": "",
            "relevance_score": 0.42 
        }
        
        Standardized format:
        {
            "student_id": "...",
            "similarity": 0.417,
            "resume_text": "...",
            ...
        }
        """
        standardized = []
        
        for result in results:
            if "student_id" not in result and "candidate_id" in result:
                result["student_id"] = result.pop("candidate_id")  # Rename key

            # Skip if no student_id
            student_id = result.get("student_id")
            if not student_id or student_id == "None":
                print(f"Warning: Result missing valid 'student_id', skipping: {list(result.keys())}")
                continue
            
            # Normalize similarity field
            similarity = (
                result.get("similarity") or 
                result.get("max_similarity") or 
                result.get("score") or 
                result.get("relevance_score") or
                0.0
            )
            
            # Normalize text field - handle best_chunk dict format
            resume_text = ""
            if "best_chunk" in result and isinstance(result["best_chunk"], dict):
                resume_text = result["best_chunk"].get("text", "")
            else:
                resume_text = (
                    result.get("resume_text") or 
                    result.get("text") or 
                    result.get("chunk_text") or
                    result.get("summary") or # i just take the summary part to be a resume text from graph RAG
                    ""
                )
            
            # Create standardized result
            standardized_result = {
                "student_id": result.get("student_id"),
                "similarity": float(similarity),
                "resume_text": str(resume_text),
            }
            
            # Preserve additional useful fields
            if "student_name" in result:
                standardized_result["student_name"] = result["student_name"]
            
            if "best_chunk" in result and isinstance(result["best_chunk"], dict):
                standardized_result["chunk_metadata"] = {
                    "chunk_id": result["best_chunk"].get("id"),
                    "source": result["best_chunk"].get("source"),
                    "filename": result["best_chunk"].get("filename")
                }
            
            # Preserve any other additional fields that don't conflict
            for key, value in result.items():
                if key not in ["student_id", "similarity", "resume_text", "max_similarity", 
                              "score", "text", "best_chunk", "chunk_text", "student_name"]:
                    standardized_result[key] = value
            
            standardized.append(standardized_result)
        
        print(f"Standardized {len(standardized)} results from {len(results)} raw results")
        return standardized