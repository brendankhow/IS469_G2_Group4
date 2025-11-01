"""
Personality Analysis Tool.

Fetches personality traits and interview performance data.
"""

import time
import asyncio
from typing import Dict
from ..base_agent import BaseTool, AgentState, ToolResult
from services.supabase_client import supabase


class PersonalityAnalysisTool(BaseTool):
    """Tool for fetching candidates' personality analysis data"""
    
    def __init__(self):
        super().__init__(
            name="get_personality",
            description="Retrieve personality traits and interview performance data for cultural fit assessment. Adds personality insights to candidates."
        )
    
    async def execute(self, state: AgentState, parameters: Dict) -> ToolResult:
        """Execute personality data fetching"""
        start_time = time.time()
        
        try:
            print(f"   🧠 Fetching personality data for {len(state.candidates)} candidates...")
            
            # Fetch personality for all candidates in parallel
            tasks = []
            for candidate in state.candidates:
                if not candidate.get("personality_analyzed"):
                    tasks.append(self._fetch_personality(candidate["student_id"]))
            
            if tasks:
                personality_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Merge personality data back INTO existing candidate data (don't replace!)
                personality_dict = {p["student_id"]: p for p in personality_results if isinstance(p, dict)}
                
                for candidate in state.candidates:
                    sid = candidate["student_id"]
                    if sid in personality_dict:
                        # UPDATE existing candidate dict (don't replace!)
                        candidate["personality_data"] = personality_dict[sid].get("data")
                        candidate["personality_analyzed"] = True
            
            # Update enriched candidates list (those with either GitHub or personality)
            state.enriched_candidates = [
                c for c in state.candidates 
                if c.get("github_analyzed") or c.get("personality_analyzed")
            ]
            
            # Count enriched candidates
            enriched_count = sum(1 for c in state.candidates if c.get("personality_analyzed"))
            
            execution_time = time.time() - start_time
            
            print(f"   ✅ Fetched personality data for {enriched_count}/{len(state.candidates)} candidates in {execution_time:.2f}s")
            
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "enriched_count": enriched_count,
                    "total_candidates": len(state.candidates)
                },
                execution_time=execution_time
            )
        
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"   ❌ Personality fetch failed: {e}")
            return ToolResult(
                tool_name=self.name,
                success=False,
                data={},
                error=str(e),
                execution_time=execution_time
            )
    
    async def _fetch_personality(self, student_id: str) -> Dict:
        """Fetch personality data for a single candidate"""
        try:
            personality_resp = await asyncio.to_thread(
                lambda: supabase.table("personality_analyses")
                    .select("*")
                    .eq("student_id", student_id)
                    .order("created_at", desc=True)
                    .execute()
            )
            
            return {
                "student_id": student_id,
                "data": personality_resp.data[0] if personality_resp.data else None
            }
        
        except Exception as e:
            print(f"      ⚠️ Personality fetch error for {student_id}: {e}")
            return {
                "student_id": student_id,
                "data": None
            }
