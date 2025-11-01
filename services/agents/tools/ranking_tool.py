"""
Ranking Tool.

Uses LLM to rank and evaluate candidates holistically.
"""

import time
from typing import Dict
from ..base_agent import BaseTool, AgentState, ToolResult


class RankingTool(BaseTool):
    """Tool for ranking candidates using LLM"""
    
    def __init__(self, llm_router):
        super().__init__(
            name="rank_candidates",
            description="Use LLM to holistically evaluate and rank all enriched candidates. Provides fit scores (0-10) and detailed evaluations."
        )
        self.llm_router = llm_router
    
    async def execute(self, state: AgentState, parameters: Dict) -> ToolResult:
        """Execute LLM ranking"""
        start_time = time.time()
        
        try:
            temperature = parameters.get("temperature", 0.7)
            
            print(f"   🏆 Ranking {len(state.candidates)} candidates using LLM...")
            
            # Use the LLM router to rank candidates
            ranked_candidates = await self.llm_router.rank_candidates(
                candidates=state.candidates,
                query=state.query,
                temperature=temperature
            )
            
            # Update state
            state.final_rankings = ranked_candidates
            state.goal_met = state.check_goal()
            
            execution_time = time.time() - start_time
            
            high_quality = [c for c in ranked_candidates if c.get("fit_score", 0) >= state.min_fit_score]
            print(f"   ✅ Ranked {len(ranked_candidates)} candidates ({len(high_quality)} high-quality) in {execution_time:.2f}s")
            
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "ranked_candidates": ranked_candidates,
                    "count": len(ranked_candidates),
                    "high_quality_count": len(high_quality)
                },
                execution_time=execution_time
            )
        
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"   ❌ Ranking failed: {e}")
            return ToolResult(
                tool_name=self.name,
                success=False,
                data={},
                error=str(e),
                execution_time=execution_time
            )
