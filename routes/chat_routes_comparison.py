"""
Comparison Routes.

Endpoints for comparing rule-based vs agentic candidate search.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
import asyncio
import time
from datetime import datetime

router = APIRouter()

class ComparisonRequest(BaseModel):
    message: str = "I'm looking for a software engineer with experience in frontend tech like typescript and javascript."
    min_candidates: int = 1
    min_fit_score: float = 5.0
    max_iterations: int = 5
    temperature: float = 0.7

class ArchitectureResult(BaseModel):
    """Results from one architecture (rule-based or agentic)"""
    architecture: str  # "rule-based" or "agentic"
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

class ComparisonResponse(BaseModel):
    """Side-by-side comparison of both architectures"""
    query: str
    timestamp: str
    rule_based: ArchitectureResult
    agentic: ArchitectureResult
    winner: Optional[str] = None
    winner_reason: str = ""
    comparison_metrics: Dict = {}

@router.post("/compare", response_model=ComparisonResponse)
async def compare_architectures(request: ComparisonRequest):
    """
    🏆 ARCHITECTURE COMPARISON
    
    Runs both rule-based and agentic approaches on the same query
    and provides side-by-side metrics for comparison.
    
    Comparison Metrics:
    - Execution time (speed)
    - LLM calls (cost efficiency)
    - Candidates found (coverage)
    - Top candidate quality (accuracy)
    - Goal achievement (success rate)
    
    Winner Determination:
    1. Goal achievement (did it find min_candidates with min_fit_score?)
    2. Top candidate quality (highest fit_score)
    3. Speed (faster execution)
    4. Cost efficiency (fewer LLM calls)
    
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
        print(f"🏆 STARTING ARCHITECTURE COMPARISON")
        print(f"Query: {request.message[:60]}...")
        print(f"{'='*80}")
        
        # Import here to avoid circular dependencies
        from routes.chat_routes import chat, ChatRequest as RuleChatRequest
        from routes.chat_routes_agentic import agentic_chat, AgenticChatRequest
        from services.evaluation_service import evaluation_service
        
        # Prepare requests
        rule_request = RuleChatRequest(
            message=request.message,
            temperature=request.temperature
        )
        
        agentic_request = AgenticChatRequest(
            message=request.message,
            min_candidates=request.min_candidates,
            min_fit_score=request.min_fit_score,
            max_iterations=request.max_iterations,
            temperature=request.temperature
        )
        
        # Run rule-based (sync) first
        # Note: chat() is synchronous, agentic_chat() is async
        rule_start = time.time()
        rule_result = chat(rule_request)
        rule_time = time.time() - rule_start
        
        # Run agentic (async) second
        agentic_start = time.time()
        agentic_result = await agentic_chat(agentic_request)
        agentic_time = time.time() - agentic_start
        
        # Extract metrics for rule-based
        rule_candidates = rule_result.response if rule_result.response else []
        rule_scores = [c.fit_score for c in rule_candidates] if rule_candidates else []
        
        rule_arch = ArchitectureResult(
            architecture="rule-based",
            candidates_found=len(rule_candidates),
            execution_time=rule_time,
            llm_calls=1,  # Rule-based makes exactly 1 LLM call
            total_tokens=0,  # Not tracked in rule-based
            estimated_cost=0.002,  # Approximate for 1 call
            goal_achieved=len(rule_candidates) >= request.min_candidates and (
                max(rule_scores) >= request.min_fit_score if rule_scores else False
            ),
            iterations=1,
            top_candidate_score=max(rule_scores) if rule_scores else None,
            avg_candidate_score=sum(rule_scores) / len(rule_scores) if rule_scores else None
        )
        
        # Extract metrics for agentic
        agentic_candidates = agentic_result.response if agentic_result.response else []
        agentic_scores = [c.fit_score for c in agentic_candidates] if agentic_candidates else []
        
        router_stats = agentic_result.router_stats
        agentic_arch = ArchitectureResult(
            architecture="agentic",
            candidates_found=len(agentic_candidates),
            execution_time=agentic_time,  # Use measured time, not orchestrator's internal time
            llm_calls=router_stats.get("total_calls", 0),
            total_tokens=router_stats.get("total_tokens", 0),
            estimated_cost=router_stats.get("total_cost", 0.0),
            goal_achieved=agentic_result.goal_achieved,
            iterations=agentic_result.iterations,
            reasoning_log=agentic_result.reasoning_log,
            top_candidate_score=max(agentic_scores) if agentic_scores else None,
            avg_candidate_score=sum(agentic_scores) / len(agentic_scores) if agentic_scores else None
        )
        
        # Store metrics in evaluation service
        rule_based_metrics = evaluation_service.create_metrics(
            architecture="rule-based",
            query=request.message,
            execution_time=rule_time,
            llm_calls=1,
            total_tokens=0,
            estimated_cost=0.002,
            candidates=[{"fit_score": score} for score in rule_scores],
            goal_achieved=rule_arch.goal_achieved,
            iterations=1,
            min_fit_score=request.min_fit_score,
            timestamp=datetime.now().isoformat()
        )
        
        agentic_metrics = evaluation_service.create_metrics(
            architecture="agentic",
            query=request.message,
            execution_time=agentic_time,  # Use measured time, not orchestrator's internal time
            llm_calls=router_stats.get("total_calls", 0),
            total_tokens=router_stats.get("total_tokens", 0),
            estimated_cost=router_stats.get("total_cost", 0.0),
            candidates=[{"fit_score": score} for score in agentic_scores],
            goal_achieved=agentic_result.goal_achieved,
            iterations=agentic_result.iterations,
            min_fit_score=request.min_fit_score,
            reasoning_log=agentic_result.reasoning_log,
            timestamp=datetime.now().isoformat()
        )
        
        # Compare and store in evaluation service
        comparison_result = evaluation_service.compare_architectures(rule_based_metrics, agentic_metrics)
        
        # Determine winner
        winner = comparison_result.winner
        reason = comparison_result.winner_reason
        
        # Calculate comparison metrics
        comparison_metrics = {
            "speedup_factor": rule_time / agentic_time if agentic_time > 0 else 0,
            "cost_ratio": agentic_arch.estimated_cost / rule_arch.estimated_cost if rule_arch.estimated_cost > 0 else 0,
            "quality_improvement": (
                (agentic_arch.top_candidate_score or 0) - (rule_arch.top_candidate_score or 0)
                if rule_arch.top_candidate_score and agentic_arch.top_candidate_score else 0
            ),
            "candidate_coverage_diff": agentic_arch.candidates_found - rule_arch.candidates_found,
            "llm_call_overhead": agentic_arch.llm_calls - rule_arch.llm_calls
        }
        
        return ComparisonResponse(
            query=request.message,
            timestamp=datetime.now().isoformat(),
            rule_based=rule_arch,
            agentic=agentic_arch,
            winner=winner,
            winner_reason=reason,
            comparison_metrics=comparison_metrics
        )
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def _determine_winner(
    rule_based: ArchitectureResult, 
    agentic: ArchitectureResult,
    request: ComparisonRequest
) -> tuple[str, str]:
    """
    Determine which architecture performed better.
    
    Criteria (in priority order):
    1. Goal achievement (found enough high-quality candidates)
    2. Top candidate quality (fit_score)
    3. Speed (execution time)
    4. Cost efficiency (LLM calls)
    """
    reasons = []
    
    # 1. Goal achievement
    if rule_based.goal_achieved and not agentic.goal_achieved:
        return "rule-based", "✅ Achieved goal (found enough high-quality candidates) while agentic failed"
    elif agentic.goal_achieved and not rule_based.goal_achieved:
        return "agentic", "✅ Achieved goal (found enough high-quality candidates) while rule-based failed"
    elif not rule_based.goal_achieved and not agentic.goal_achieved:
        reasons.append("⚠️ Neither architecture achieved the goal")
    else:
        reasons.append("✅ Both achieved goal")
    
    # 2. Top candidate quality
    rule_top = rule_based.top_candidate_score or 0
    agentic_top = agentic.top_candidate_score or 0
    
    if abs(rule_top - agentic_top) >= 1.0:  # Significant difference
        if agentic_top > rule_top:
            return "agentic", f"🎯 Found higher quality candidate (score: {agentic_top} vs {rule_top})"
        else:
            return "rule-based", f"🎯 Found higher quality candidate (score: {rule_top} vs {agentic_top})"
    
    reasons.append(f"📊 Similar candidate quality (rule: {rule_top}, agentic: {agentic_top})")
    
    # 3. Speed
    speedup = rule_based.execution_time / agentic.execution_time if agentic.execution_time > 0 else 1
    if speedup < 0.5:  # Agentic is >2x slower
        reasons.append(f"⚡ Rule-based is {speedup:.1f}x faster")
        return "rule-based", " | ".join(reasons) + " → Rule-based wins on speed"
    elif speedup > 2.0:  # Agentic is somehow faster
        reasons.append(f"⚡ Agentic is {1/speedup:.1f}x faster")
        return "agentic", " | ".join(reasons) + " → Agentic wins on speed"
    
    reasons.append(f"⏱️ Similar speed ({rule_based.execution_time:.1f}s vs {agentic.execution_time:.1f}s)")
    
    # 4. Cost efficiency
    cost_ratio = agentic.estimated_cost / rule_based.estimated_cost if rule_based.estimated_cost > 0 else 1
    if cost_ratio > 3.0:  # Agentic costs >3x more
        reasons.append(f"💰 Rule-based is {cost_ratio:.1f}x cheaper")
        return "rule-based", " | ".join(reasons) + " → Rule-based wins on cost"
    
    reasons.append(f"💵 Cost ratio: {cost_ratio:.1f}x")
    
    # Tie - slight preference for rule-based (simpler, deterministic)
    return "rule-based", " | ".join(reasons) + " → TIE (rule-based preferred for simplicity)"
