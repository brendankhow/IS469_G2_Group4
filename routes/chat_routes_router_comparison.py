"""
Router Comparison Routes.

Endpoints for comparing different LLM routers (DeepSeek vs Llama).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
import asyncio
import time
from datetime import datetime

router = APIRouter()

class RouterComparisonRequest(BaseModel):
    message: str = "I'm looking for a software engineer with experience in frontend tech like typescript and javascript."
    min_candidates: int = 1
    min_fit_score: float = 5.0
    max_iterations: int = 5
    temperature: float = 0.7

class RouterResult(BaseModel):
    """Results from one router"""
    router_name: str
    model_name: str
    provider: str  # "huggingface" or "ollama"
    size: str  # "large" (DeepSeek) or "small" (Llama)
    candidates_found: int
    execution_time: float
    llm_calls: int
    total_tokens: int
    estimated_cost: float
    goal_achieved: bool
    iterations: int
    reasoning_log: Optional[List[Dict]] = None
    top_candidate_score: Optional[float] = None
    avg_candidate_score: Optional[float] = None
    decision_quality: Optional[Dict] = None  # Router-specific metrics

class RouterComparisonResponse(BaseModel):
    """Side-by-side comparison of routers"""
    query: str
    timestamp: str
    deepseek_result: RouterResult
    llama_result: RouterResult
    winner: Optional[str] = None
    winner_reason: str = ""
    comparison_metrics: Dict = {}

@router.post("/compare-routers", response_model=RouterComparisonResponse)
async def compare_routers(request: RouterComparisonRequest):
    """
    🔬 LLM ROUTER COMPARISON
    
    Compares DeepSeek-V3 (frontier model) vs Llama3.2:1B (local model)
    on the same agentic task.
    
    Key Comparisons:
    - Decision quality (routing accuracy)
    - Execution speed (local vs API)
    - Cost efficiency (paid vs free)
    - Goal achievement (effectiveness)
    - Token usage (efficiency)
    
    Research Question:
    "Can a small local LLM (1B params) make routing decisions
     as effectively as a frontier model (236B+ params)?"
    
    Example:
    {
        "message": "Looking for a React developer with 3+ years experience",
        "min_candidates": 3,
        "min_fit_score": 7.0,
        "max_iterations": 5
    }
    """
    try:
        print(f"\n{'='*80}")
        print(f"🔬 STARTING ROUTER COMPARISON")
        print(f"Query: {request.message[:60]}...")
        print(f"{'='*80}")
        
        # Import here to avoid circular dependencies
        from routes.chat_routes_agentic import agentic_chat, AgenticChatRequest
        
        # Run DeepSeek router
        print(f"\n🤖 [1/2] Running DeepSeek-V3 Router (Frontier Model)...")
        deepseek_start = time.time()
        deepseek_request = AgenticChatRequest(
            message=request.message,
            min_candidates=request.min_candidates,
            min_fit_score=request.min_fit_score,
            max_iterations=request.max_iterations,
            temperature=request.temperature,
            router="deepseek"
        )
        deepseek_response = await agentic_chat(deepseek_request)
        deepseek_time = time.time() - deepseek_start
        
        # Run Llama router
        print(f"\n🦙 [2/2] Running Llama3.2:1B Router (Local Model)...")
        llama_start = time.time()
        llama_request = AgenticChatRequest(
            message=request.message,
            min_candidates=request.min_candidates,
            min_fit_score=request.min_fit_score,
            max_iterations=request.max_iterations,
            temperature=request.temperature,
            router="llama"
        )
        llama_response = await agentic_chat(llama_request)
        llama_time = time.time() - llama_start
        
        # Extract metrics for DeepSeek
        deepseek_candidates = deepseek_response.response if deepseek_response.response else []
        deepseek_scores = [c.fit_score for c in deepseek_candidates] if deepseek_candidates else []
        
        deepseek_result = RouterResult(
            router_name="DeepSeek-V3",
            model_name="deepseek-ai/DeepSeek-V3-0324",
            provider="huggingface",
            size="large",
            candidates_found=len(deepseek_candidates),
            execution_time=deepseek_time,
            llm_calls=deepseek_response.router_stats.get("total_calls", 0),
            total_tokens=deepseek_response.router_stats.get("total_tokens", 0),
            estimated_cost=deepseek_response.router_stats.get("total_cost", 0.0),
            goal_achieved=deepseek_response.goal_achieved,
            iterations=deepseek_response.iterations,
            reasoning_log=deepseek_response.reasoning_log,
            top_candidate_score=max(deepseek_scores) if deepseek_scores else None,
            avg_candidate_score=sum(deepseek_scores) / len(deepseek_scores) if deepseek_scores else None
        )
        
        # Extract metrics for Llama
        llama_candidates = llama_response.response if llama_response.response else []
        llama_scores = [c.fit_score for c in llama_candidates] if llama_candidates else []
        
        llama_result = RouterResult(
            router_name="Llama3.2:1B",
            model_name="llama3.2:1b",
            provider="ollama",
            size="small",
            candidates_found=len(llama_candidates),
            execution_time=llama_time,
            llm_calls=llama_response.router_stats.get("total_calls", 0),
            total_tokens=llama_response.router_stats.get("total_tokens", 0),
            estimated_cost=llama_response.router_stats.get("total_cost", 0.0),
            goal_achieved=llama_response.goal_achieved,
            iterations=llama_response.iterations,
            reasoning_log=llama_response.reasoning_log,
            top_candidate_score=max(llama_scores) if llama_scores else None,
            avg_candidate_score=sum(llama_scores) / len(llama_scores) if llama_scores else None
        )
        
        # Determine winner
        winner, reason = _determine_router_winner(deepseek_result, llama_result, request)
        
        # Calculate comparison metrics
        comparison_metrics = {
            "speedup_factor": deepseek_time / llama_time if llama_time > 0 else 0,
            "cost_savings": deepseek_result.estimated_cost - llama_result.estimated_cost,
            "quality_delta": (
                (deepseek_result.top_candidate_score or 0) - (llama_result.top_candidate_score or 0)
                if deepseek_result.top_candidate_score and llama_result.top_candidate_score else 0
            ),
            "iteration_efficiency": {
                "deepseek": deepseek_result.candidates_found / deepseek_result.iterations if deepseek_result.iterations > 0 else 0,
                "llama": llama_result.candidates_found / llama_result.iterations if llama_result.iterations > 0 else 0
            },
            "decision_count_delta": deepseek_result.llm_calls - llama_result.llm_calls
        }
        
        return RouterComparisonResponse(
            query=request.message,
            timestamp=datetime.now().isoformat(),
            deepseek_result=deepseek_result,
            llama_result=llama_result,
            winner=winner,
            winner_reason=reason,
            comparison_metrics=comparison_metrics
        )
    
    except Exception as e:
        print(f"❌ Router comparison error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _determine_router_winner(
    deepseek: RouterResult,
    llama: RouterResult,
    request: RouterComparisonRequest
) -> tuple[str, str]:
    """
    Determine which router performed better using point system.
    
    Scoring:
    - Goal achievement: 3 points (most important)
    - Quality (top score): 2 points
    - Speed: 1 point
    - Cost: 1 point (llama wins this by default)
    """
    
    deepseek_points = 0
    llama_points = 0
    reasons = []
    
    # 1. Goal achievement (3 points)
    if deepseek.goal_achieved and not llama.goal_achieved:
        deepseek_points += 3
        reasons.append("DeepSeek achieved goal, Llama didn't")
    elif llama.goal_achieved and not deepseek.goal_achieved:
        llama_points += 3
        reasons.append("Llama achieved goal, DeepSeek didn't")
    elif deepseek.goal_achieved and llama.goal_achieved:
        reasons.append("Both achieved goal")
    
    # 2. Quality - top candidate score (2 points)
    if deepseek.top_candidate_score and llama.top_candidate_score:
        if deepseek.top_candidate_score > llama.top_candidate_score:
            deepseek_points += 2
            reasons.append(f"DeepSeek: higher quality ({deepseek.top_candidate_score:.1f} vs {llama.top_candidate_score:.1f})")
        elif llama.top_candidate_score > deepseek.top_candidate_score:
            llama_points += 2
            reasons.append(f"Llama: higher quality ({llama.top_candidate_score:.1f} vs {deepseek.top_candidate_score:.1f})")
    
    # 3. Speed (1 point) - Llama should win this (local is faster)
    if llama.execution_time < deepseek.execution_time:
        llama_points += 1
        speedup = deepseek.execution_time / llama.execution_time if llama.execution_time > 0 else 0
        reasons.append(f"Llama: faster ({speedup:.1f}x speedup)")
    else:
        deepseek_points += 1
        reasons.append(f"DeepSeek: faster (surprisingly)")
    
    # 4. Cost (1 point) - Llama always wins (local = free)
    llama_points += 1
    reasons.append(f"Llama: zero cost (vs ${deepseek.estimated_cost:.4f})")
    
    # Determine winner
    if deepseek_points > llama_points:
        return "DeepSeek-V3", f"DeepSeek wins ({deepseek_points} vs {llama_points} points). " + "; ".join(reasons)
    elif llama_points > deepseek_points:
        return "Llama3.2:1B", f"Llama wins ({llama_points} vs {deepseek_points} points). " + "; ".join(reasons)
    else:
        return "Tie", f"Tie ({deepseek_points} points each). " + "; ".join(reasons)
