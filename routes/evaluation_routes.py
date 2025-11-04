"""
Evaluation Routes.

Endpoints for evaluating and comparing architectures with metrics.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from services.evaluation_service import evaluation_service

router = APIRouter()


class EvaluationStatsResponse(BaseModel):
    """Statistics from evaluation runs"""
    total_comparisons: int
    wins: Dict[str, int]
    win_rates: Dict[str, float]
    average_metrics: Dict[str, float]
    goal_achievement_rates: Dict[str, float]
    performance_summary: Dict[str, str]


class EvaluationReportResponse(BaseModel):
    """Full evaluation report"""
    report_markdown: str
    generated_at: str


@router.get("/stats", response_model=EvaluationStatsResponse)
async def get_evaluation_stats():
    """
    GET EVALUATION STATISTICS
    
    Returns aggregated statistics from all comparison runs:
    - Win/loss records for each architecture
    - Average performance metrics
    - Goal achievement rates
    - Overall performance winners
    
    Use this endpoint to see cumulative results after running multiple
    comparisons via /chat/compare endpoint.
    
    Example response:
    {
        "total_comparisons": 10,
        "wins": {"rule_based": 3, "agentic": 6, "ties": 1},
        "win_rates": {"rule_based": 0.3, "agentic": 0.6, "tie": 0.1},
        "average_metrics": {
            "speedup_factor": 0.35,
            "cost_ratio": 2.5,
            "quality_improvement": 0.8
        },
        "goal_achievement_rates": {
            "rule_based": 0.9,
            "agentic": 1.0
        },
        "performance_summary": {
            "speed_winner": "rule-based",
            "cost_winner": "rule-based",
            "quality_winner": "agentic"
        }
    }
    """
    try:
        stats = evaluation_service.aggregate_results()
        
        if "error" in stats:
            raise HTTPException(status_code=404, detail=stats["error"])
        
        return EvaluationStatsResponse(**stats)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report", response_model=EvaluationReportResponse)
async def get_evaluation_report():
    """
    GET FULL EVALUATION REPORT
    
    Generates a comprehensive markdown report including:
    - Summary statistics
    - Win/loss breakdown
    - Average performance metrics
    - Detailed comparison for each run
    
    Perfect for generating documentation or academic reports.
    
    Example:
    GET http://localhost:8000/evaluation/report
    
    Returns markdown-formatted report that can be saved to a file.
    """
    try:
        report = evaluation_service.generate_report()
        
        return EvaluationReportResponse(
            report_markdown=report,
            generated_at=datetime.now().isoformat()
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_evaluation_data():
    """
    RESET EVALUATION DATA
    
    Clears all stored comparison results.
    Use this to start a fresh evaluation session.
    
    Example:
    POST http://localhost:8000/evaluation/reset
    
    Returns:
    {
        "message": "Evaluation data cleared",
        "previous_count": 10
    }
    """
    try:
        previous_count = len(evaluation_service.results)
        evaluation_service.results = []
        
        return {
            "message": "Evaluation data cleared",
            "previous_count": previous_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_evaluation_data():
    """
    EXPORT RAW EVALUATION DATA
    
    Exports all comparison results as JSON for external analysis.
    
    Example:
    GET http://localhost:8000/evaluation/export
    
    Returns array of all comparison results with full details.
    """
    try:
        if not evaluation_service.results:
            raise HTTPException(status_code=404, detail="No evaluation data available")
        
        # Convert results to dicts for JSON serialization
        export_data = []
        for result in evaluation_service.results:
            export_data.append({
                "query": result.query,
                "winner": result.winner,
                "winner_reason": result.winner_reason,
                "rule_based": {
                    "architecture": result.rule_based.architecture,
                    "execution_time": result.rule_based.execution_time,
                    "llm_calls": result.rule_based.llm_calls,
                    "total_tokens": result.rule_based.total_tokens,
                    "estimated_cost": result.rule_based.estimated_cost,
                    "candidates_found": result.rule_based.candidates_found,
                    "top_fit_score": result.rule_based.top_fit_score,
                    "avg_fit_score": result.rule_based.avg_fit_score,
                    "high_quality_count": result.rule_based.high_quality_count,
                    "goal_achieved": result.rule_based.goal_achieved,
                    "iterations": result.rule_based.iterations
                },
                "agentic": {
                    "architecture": result.agentic.architecture,
                    "execution_time": result.agentic.execution_time,
                    "llm_calls": result.agentic.llm_calls,
                    "total_tokens": result.agentic.total_tokens,
                    "estimated_cost": result.agentic.estimated_cost,
                    "candidates_found": result.agentic.candidates_found,
                    "top_fit_score": result.agentic.top_fit_score,
                    "avg_fit_score": result.agentic.avg_fit_score,
                    "high_quality_count": result.agentic.high_quality_count,
                    "goal_achieved": result.agentic.goal_achieved,
                    "iterations": result.agentic.iterations
                },
                "comparison": {
                    "speedup_factor": result.speedup_factor,
                    "cost_ratio": result.cost_ratio,
                    "quality_improvement": result.quality_improvement
                },
                "breakdown": result.comparison_breakdown
            })
        
        return {
            "total_comparisons": len(export_data),
            "comparisons": export_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
