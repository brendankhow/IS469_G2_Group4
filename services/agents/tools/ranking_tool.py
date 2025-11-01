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
            llm_rankings = await self.llm_router.rank_candidates(
                candidates=state.candidates,
                query=state.query,
                temperature=temperature
            )
            
            # The LLM only returns ranking info, we need to preserve original fields like name, student_id, etc.
            ranked_candidates = []
            for i, original_candidate in enumerate(state.candidates):
                # Start with the original candidate data (has name, student_id, etc.)
                merged = original_candidate.copy()
                
                # Find matching ranking from LLM (match by index or student_id)
                if i < len(llm_rankings):
                    llm_ranking = llm_rankings[i]
                    # Merge in the ranking-specific fields from LLM
                    merged["fit_score"] = llm_ranking.get("fit_score", 5)
                    merged["evaluation_bullets"] = llm_ranking.get("evaluation_bullets", [])
                    merged["notable_github_projects"] = llm_ranking.get("notable_github_projects", [])
                    merged["next_step"] = llm_ranking.get("next_step", "Review")
                    merged["personality_insight"] = llm_ranking.get("personality_insight", "")
                
                ranked_candidates.append(merged)
            
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
