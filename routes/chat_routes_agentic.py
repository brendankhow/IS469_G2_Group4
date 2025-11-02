"""
Agentic Chat Routes.

Endpoints for agentic candidate search where LLM decides which tools to call.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from services.agents.agentic_orchestrator import AgenticRecruitmentOrchestrator
from services.agents.llm_routers.deepseek_router import DeepSeekRouter
from services.agents.llm_routers.llama_router import LlamaRouter
from services.embedder import embedder
from services.vector_store import VectorStore
from services.supabase_client import supabase
from services.github.github_analysis import GitHubAnalysisService
from utils.timer import time_this_function
from typing import Literal

router = APIRouter()

# Initialize GitHub analyzer
github_analyzer = GitHubAnalysisService()

# Initialize routers (singleton instances)
deepseek_router = DeepSeekRouter()
llama_router = LlamaRouter()

# Router registry
ROUTER_REGISTRY = {
    "deepseek": deepseek_router,
    "llama": llama_router
}

class AgenticChatRequest(BaseModel):
    message: str = "I'm looking for a software engineer with experience in frontend tech like typescript and javascript."
    min_candidates: int = 1
    min_fit_score: float = 0.0
    max_iterations: int = 5
    temperature: float = 0.7
    router: Literal["deepseek", "llama"] = "deepseek"  # LLM router selection

class CandidateEvaluation(BaseModel):
    name: str
    fit_score: int
    evaluation_bullets: List[str]
    notable_github_projects: List[str]
    next_step: str
    personality_insight: str
    github_link: str
    candidate_link: str
    student_id: Optional[str] = None

class AgenticChatResponse(BaseModel):
    response: Optional[List[CandidateEvaluation]] = None
    reasoning_log: List[Dict] = []
    goal_achieved: bool = False
    iterations: int = 0
    execution_time: float = 0.0
    router_stats: Dict = {}
    architecture: str = "agentic"
    raw_response: Optional[str] = None

@router.post("/agentic", response_model=AgenticChatResponse)
@time_this_function
async def agentic_chat(request: AgenticChatRequest):
    """
    🤖 AGENTIC CANDIDATE SEARCH
    
    The agent autonomously decides:
    - When to search for candidates
    - When to enrich with GitHub data
    - When to fetch personality data
    - When to rank candidates
    - When to stop searching
    
    Key differences from /community (rule-based):
    - LLM router decides next action dynamically
    - Adaptive search (can expand if results poor)
    - More LLM calls (higher cost but potentially better results)
    - Non-deterministic (different runs may take different paths)
    
    Example:
    {
        "message": "Looking for a React developer with 3+ years experience",
        "min_candidates": 3,
        "min_fit_score": 7.0,
        "max_iterations": 5
    }
    """
    try:
        print(f"\n{'#'*80}")
        print(f"# AGENTIC ENDPOINT CALLED")
        print(f"# Router: {request.router}")
        print(f"# Query: {request.message[:60]}...")
        print(f"{'#'*80}")
        
        # Select router based on request
        selected_router = ROUTER_REGISTRY.get(request.router, deepseek_router)
        
        # Create orchestrator with selected router
        agentic_orchestrator = AgenticRecruitmentOrchestrator(llm_router=selected_router)
        
        # Let agent autonomously search
        result = await agentic_orchestrator.find_candidates(
            query=request.message,
            min_candidates=request.min_candidates,
            min_fit_score=request.min_fit_score,
            max_iterations=request.max_iterations
        )
        
        if not result["candidates"]:
            return AgenticChatResponse(
                response=None,
                reasoning_log=result["reasoning_log"],
                goal_achieved=result["goal_achieved"],
                iterations=result["iterations"],
                execution_time=result["execution_time"],
                router_stats=result["router_stats"],
                raw_response=f"Agent searched {result['iterations']} iterations but found no suitable candidates."
            )
        
        # Convert to CandidateEvaluation format
        candidates = []
        for c in result["candidates"]:
            # Extract data safely
            github_username = c.get("github_username", "N/A")
            github_link = f"https://github.com/{github_username}" if github_username != "N/A" else "N/A"
            
            # Format notable projects (deduplicate using set)
            notable_projects = []
            seen_projects = set()
            for proj in c.get("github_projects", []):
                repo_name = proj.get('repo_name', 'Unknown')
                # Use repo_name as unique identifier to avoid duplicates
                if repo_name not in seen_projects and repo_name != 'Unknown':
                    seen_projects.add(repo_name)
                    notable_projects.append(
                        f"{repo_name} ({proj.get('language', 'N/A')}) - {proj.get('stars', 0)}⭐"
                    )
                    if len(notable_projects) >= 3:  # Limit to top 3
                        break
            
            # Format personality insight
            personality_insight = ""
            if c.get("personality_data"):
                pd = c["personality_data"]
                traits = []
                if pd.get("conscientiousness", 0) > 0.7:
                    traits.append("highly organized and reliable")
                if pd.get("extraversion", 0) > 0.7:
                    traits.append("outgoing and energetic")
                if pd.get("openness", 0) > 0.7:
                    traits.append("creative and innovative")
                
                personality_insight = f"Personality: {', '.join(traits) if traits else 'Balanced traits'}"
            
            candidates.append(CandidateEvaluation(
                name=c.get("name", "Unknown"),
                fit_score=c.get("fit_score", 5),
                evaluation_bullets=c.get("evaluation_bullets", [
                    f"• Resume match: {c.get('resume_similarity', 0):.1%}",
                    f"• Skills: {c.get('skills', 'N/A')}",
                    f"• GitHub projects: {len(c.get('github_projects', []))}"
                ]),
                notable_github_projects=notable_projects,
                next_step=c.get("next_step", "Review"),
                personality_insight=personality_insight or "No personality data available",
                github_link=github_link,
                candidate_link="",
                student_id=c.get("student_id")
            ))
        
        return AgenticChatResponse(
            response=candidates,
            reasoning_log=result["reasoning_log"],
            goal_achieved=result["goal_achieved"],
            iterations=result["iterations"],
            execution_time=result["execution_time"],
            router_stats=result["router_stats"],
            architecture="agentic"
        )
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
