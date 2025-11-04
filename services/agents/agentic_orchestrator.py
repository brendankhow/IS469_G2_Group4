"""
Agentic Recruitment Orchestrator.

Main orchestrator that uses LLM to decide which tools to call.
This is the "brain" of the agentic system.
"""

import asyncio
from typing import List, Dict, Optional
from .base_agent import AgentState, AgentDecision, ToolResult, ToolName
from .tools.search_tool import SearchCandidatesTool
from .tools.github_tool import GitHubAnalysisTool
from .tools.personality_tool import PersonalityAnalysisTool
from .tools.ranking_tool import RankingTool


class AgenticRecruitmentOrchestrator:
    """
    Main agentic orchestrator for candidate search.
    Uses LLM to decide which tools to call and when.
    
    Key difference from rule-based:
    - Rule-based: Fixed pipeline (search → enrich → rank)
    - Agentic: LLM router decides next action based on state
    """
    
    def __init__(self, llm_router):
        self.llm_router = llm_router
        
        # Initialize tools
        self.tools = {
            "search_candidates": SearchCandidatesTool(),
            "analyze_github": GitHubAnalysisTool(),
            "get_personality": PersonalityAnalysisTool(),
            "rank_candidates": RankingTool(llm_router),
        }
    
    async def find_candidates(
        self,
        query: str,
        min_candidates: int = 0,
        min_fit_score: float = 5.0,
        max_iterations: int = 5
    ) -> Dict:
        """
        Autonomous agent loop that decides which tools to call.
        
        Args:
            query: Job description/requirements
            min_candidates: Minimum number of quality candidates needed
            min_fit_score: Minimum fit score threshold (0-10)
            max_iterations: Maximum decision iterations
        
        Returns:
            Dict with candidates, reasoning log, and execution stats
        """
        
        # Initialize agent state
        state = AgentState(
            query=query,
            min_candidates=min_candidates,
            min_fit_score=min_fit_score,
            max_iterations=max_iterations
        )
        
        print(f"\n{'='*60}")
        print(f"🤖 AGENTIC ORCHESTRATOR STARTED")
        print(f"   Router: {self.llm_router.config.model_name}")
        print(f"   Goal: Find {min_candidates}+ candidates with fit_score >= {min_fit_score}")
        print(f"   Query: {query[:80]}...")
        print(f"{'='*60}\n")
        
        # Agent decision loop
        while state.should_continue():
            state.iterations += 1
            
            print(f"\n{'─'*60}")
            print(f"🔄 Iteration {state.iterations}/{state.max_iterations}")
            print(f"   Candidates: {len(state.candidates)}, Enriched: {len(state.enriched_candidates)}, Ranked: {len(state.final_rankings)}")
            print(f"{'─'*60}")
            
            # 🧠 Agent decides next action using LLM
            decision = await self.llm_router.decide_next_action(
                state=state,
                available_tools=[t.to_dict() for t in self.tools.values()]
            )
            
            print(f"\n🧠 Agent Decision:")
            print(f"   Tool: {decision.tool_name}")
            print(f"   Reasoning: {decision.reasoning}")
            print(f"   Confidence: {decision.confidence:.2f}")
            
            # Check for finish command
            if decision.tool_name == "finish":
                print("\n✅ Agent decided to finish")
                state.goal_met = state.check_goal()
                break
            
            # Execute the chosen tool
            tool = self.tools.get(decision.tool_name)
            if not tool:
                print(f"   ⚠️ Unknown tool: {decision.tool_name}, skipping")
                continue
            
            result = await tool.execute(state, decision.parameters)
            
            # Log execution
            state.add_execution_log(decision, result)
            
            if not result.success:
                print(f"   ⚠️ Tool execution had errors (continuing anyway)")
            
            # Debug: Show state after tool execution
            print(f"\n   📊 State after tool execution:")
            print(f"      - candidates: {len(state.candidates)}")
            print(f"      - enriched_candidates: {len(state.enriched_candidates)}")
            print(f"      - final_rankings: {len(state.final_rankings)}")
            
            # Check if goal achieved
            if state.check_goal():
                print(f"\n🎯 Goal achieved! Found {len([c for c in state.final_rankings if c.get('fit_score', 0) >= state.min_fit_score])} high-quality candidates")
                state.goal_met = True
                break
        
        # Final summary
        print(f"\n{'='*60}")
        print(f"📊 AGENTIC EXECUTION SUMMARY")
        print(f"{'='*60}")
        print(f"Total iterations: {state.iterations}")
        print(f"Goal achieved: {'✅ Yes' if state.goal_met else '❌ No'}")
        print(f"Candidates found: {len(state.candidates)}")
        print(f"Candidates enriched: {len(state.enriched_candidates)}")
        print(f"Candidates ranked: {len(state.final_rankings)}")
        print(f"Total execution time: {state.total_execution_time:.2f}s")
        print(f"Tools used: {', '.join(set(state.tools_used))}")
        
        # LLM Router stats
        router_stats = self.llm_router.get_stats()
        print(f"\n🤖 LLM Router Stats ({router_stats['model']}):")
        print(f"   Provider: {router_stats['provider']} ({router_stats['size']})")
        print(f"   Total calls: {router_stats['total_calls']}")
        print(f"   Total tokens: {router_stats['total_tokens']}")
        print(f"   Total cost: ${router_stats['total_cost']:.4f}")
        print(f"   Avg tokens/call: {router_stats['avg_tokens_per_call']:.0f}")
        print(f"{'='*60}\n")
        
        return {
            "candidates": state.final_rankings,
            "reasoning_log": state.execution_log,
            "goal_achieved": state.goal_met,
            "iterations": state.iterations,
            "execution_time": state.total_execution_time,
            "router_stats": router_stats,
            "architecture": "agentic"
        }
