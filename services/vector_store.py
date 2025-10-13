from services.supabase_client import supabase
from typing import List, Dict, Optional

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
    def search_similar_resumes(
        query_embedding: List[float],
        top_k: int = 10,
        threshold: float = 0.0
    ) -> List[Dict]:
        """Search for similar resumes using the match_resumes function
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