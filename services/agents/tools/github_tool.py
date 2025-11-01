"""
GitHub Analysis Tool.

Analyzes candidates' GitHub portfolios to assess technical skills.
"""

import time
import asyncio
from typing import Dict
from ..base_agent import BaseTool, AgentState, ToolResult
from services.vector_store import VectorStore
from services.github.github_analysis import GitHubAnalysisService
from services.embedder import embedder


class GitHubAnalysisTool(BaseTool):
    """Tool for analyzing candidates' GitHub portfolios"""
    
    def __init__(self):
        super().__init__(
            name="analyze_github",
            description="Deep-dive into candidates' GitHub portfolios to assess technical skills, project quality, and coding activity. Enriches candidates with GitHub project data."
        )
        self.github_analyzer = GitHubAnalysisService()
    
    async def execute(self, state: AgentState, parameters: Dict) -> ToolResult:
        """Execute GitHub analysis for all candidates"""
        start_time = time.time()
        
        try:
            print(f"   🐙 Analyzing GitHub portfolios for {len(state.candidates)} candidates...")
            
            query_embedding = embedder.generate_embedding(state.query)
            
            # Analyze GitHub for all candidates in parallel
            tasks = []
            for candidate in state.candidates:
                if not candidate.get("github_analyzed"):
                    tasks.append(self._analyze_candidate_github(candidate, query_embedding))
            
            if tasks:
                enriched = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Merge enriched data back
                enriched_dict = {e["student_id"]: e for e in enriched if isinstance(e, dict)}
                
                for candidate in state.candidates:
                    sid = candidate["student_id"]
                    if sid in enriched_dict:
                        candidate.update(enriched_dict[sid])
                        candidate["github_analyzed"] = True
            
            # Update state
            state.enriched_candidates = [c for c in state.candidates if c.get("github_analyzed")]
            
            execution_time = time.time() - start_time
            
            analyzed_count = len(state.enriched_candidates)
            print(f"   ✅ Analyzed {analyzed_count}/{len(state.candidates)} GitHub profiles in {execution_time:.2f}s")
            
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "enriched_count": len(state.enriched_candidates),
                    "total_candidates": len(state.candidates)
                },
                execution_time=execution_time
            )
        
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"   ❌ GitHub analysis failed: {e}")
            return ToolResult(
                tool_name=self.name,
                success=False,
                data={},
                error=str(e),
                execution_time=execution_time
            )
    
    async def _analyze_candidate_github(self, candidate: Dict, query_embedding) -> Dict:
        """Analyze GitHub for a single candidate"""
        sid = candidate["student_id"]
        github_username = candidate.get("github_username", "N/A")
        
        if not github_username or github_username == "N/A":
            return {
                "student_id": sid,
                "github_projects": [],
                "portfolio_summary": None
            }
        
        try:
            # Get relevant repos
            github_matches = await asyncio.to_thread(
                lambda: VectorStore.search_github_repos(
                    query_embedding=query_embedding,
                    student_id=sid,
                    top_k=3,
                    threshold=0.0
                )
            )
            
            # Format projects
            projects = []
            for gh in github_matches:
                metadata = gh.get("metadata", {})
                projects.append({
                    "repo_name": gh.get("repo_name", "Unknown"),
                    "language": metadata.get("language", "N/A"),
                    "topics": metadata.get("topics", []),
                    "stars": metadata.get("stars", 0),
                    "description": gh.get("text", "")[:200],
                    "similarity": gh.get("similarity", 0.0)
                })
            
            # Get portfolio summary
            portfolio_summary = await asyncio.to_thread(
                lambda: self.github_analyzer.analyze_portfolio_comprehensive(
                    student_id=sid,
                    github_username=github_username,
                    analysis_type="quick"
                )
            )
            
            return {
                "student_id": sid,
                "github_projects": projects,
                "portfolio_summary": portfolio_summary
            }
        
        except Exception as e:
            print(f"      ⚠️ GitHub analysis error for {github_username}: {e}")
            return {
                "student_id": sid,
                "github_projects": [],
                "portfolio_summary": None
            }
