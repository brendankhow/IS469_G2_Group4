"""
Search Candidates Tool.

RAG-based candidate search using resume embeddings.
"""

import time
from typing import Dict
from ..base_agent import BaseTool, AgentState, ToolResult
from services.embedder import embedder
from services.vector_store import VectorStore
from services.rag_factory import RAGFactory
from services.supabase_client import supabase
from config.feature_flags import feature_flags


class SearchCandidatesTool(BaseTool):
    """Tool for searching candidates using RAG"""
    
    def __init__(self):
        super().__init__(
            name="search_candidates",
            description="Search for candidates matching job requirements using semantic search (RAG). Returns up to 10 candidates with resume similarity scores."
        )
    
    async def execute(self, state: AgentState, parameters: Dict) -> ToolResult:
        """Execute RAG search"""
        start_time = time.time()
        
        try:
            
            print(f"   🔍 Searching for candidates")
            
            # Use RAG factory or basic vector search
            if feature_flags.ENABLE_CUSTOM_RAG or feature_flags.ENABLE_GRAPH_RAG:
                rag_factory = RAGFactory()
                matches = rag_factory.search_candidates(
                    query_text=state.query,
                )
            else:
                query_embedding = embedder.generate_embedding(state.query)
                matches = VectorStore.search_similar_resumes(
                    query_embedding=query_embedding,
                )
            
            # Enrich with basic profile data
            enriched_matches = []
            seen_students = set()
            
            for m in matches:
                sid = m.get("student_id")
                
                # Deduplicate
                if sid in seen_students:
                    continue
                seen_students.add(sid)
                
                profile_resp = supabase.table("profiles").select("*").eq("id", sid).execute()
                
                if profile_resp.data:
                    profile = profile_resp.data[0]
                    
                    # Debug: print available fields
                    print(f"      🔍 Profile fields for {sid[:8]}: {list(profile.keys())}")
                    print(f"      📋 Name field value: {profile.get('name')}")
                    
                    # Try different possible name fields
                    name = (
                        profile.get("name") or 
                        profile.get("full_name") or 
                        profile.get("student_name") or
                        profile.get("display_name") or
                        f"Student {sid[:8]}"  # Fallback to student ID prefix
                    )
                    
                    enriched_matches.append({
                        "student_id": sid,
                        "name": name,
                        "skills": profile.get("skills", "N/A"),
                        "github_username": profile.get("github_username", "N/A"),
                        "resume_similarity": m.get("similarity", 0.0),
                        "resume_text": m.get("resume_text", "")[:500]
                    })
            
            # Update state
            state.candidates = enriched_matches
            
            execution_time = time.time() - start_time
            
            print(f"   ✅ Found {len(enriched_matches)} candidates in {execution_time:.2f}s")
            
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "matches": enriched_matches,
                    "count": len(enriched_matches)
                },
                execution_time=execution_time
            )
        
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"   ❌ Search failed: {e}")
            return ToolResult(
                tool_name=self.name,
                success=False,
                data={},
                error=str(e),
                execution_time=execution_time
            )
