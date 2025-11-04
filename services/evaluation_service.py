"""
Evaluation Service for comparing rule-based vs agentic architectures.

Provides metrics and analysis for academic comparison.
"""

import time
from typing import Dict, List, Tuple
from dataclasses import dataclass, field
import statistics


@dataclass
class ArchitectureMetrics:
    """Metrics for a single architecture run"""
    architecture: str  # "rule-based" or "agentic"
    query: str
    
    # Performance metrics
    execution_time: float
    llm_calls: int
    total_tokens: int
    estimated_cost: float
    
    # Quality metrics
    candidates_found: int
    candidates_ranked: int
    top_fit_score: float
    avg_fit_score: float
    high_quality_count: int  # candidates with fit_score >= threshold
    
    # Success metrics
    goal_achieved: bool
    iterations: int
    
    # Additional context
    reasoning_log: List[Dict] = field(default_factory=list)
    timestamp: str = ""


@dataclass
class ComparisonResult:
    """Side-by-side comparison of both architectures"""
    query: str
    rule_based: ArchitectureMetrics
    agentic: ArchitectureMetrics
    
    # Comparative metrics
    speedup_factor: float  # rule_based_time / agentic_time
    cost_ratio: float  # agentic_cost / rule_based_cost
    quality_improvement: float  # agentic_top_score - rule_based_top_score
    
    # Winner determination
    winner: str  # "rule-based", "agentic", or "tie"
    winner_reason: str
    
    # Detailed comparison
    comparison_breakdown: Dict = field(default_factory=dict)


class EvaluationService:
    """Service for evaluating and comparing architectures"""
    
    def __init__(self):
        self.results: List[ComparisonResult] = []
    
    def create_metrics(
        self,
        architecture: str,
        query: str,
        execution_time: float,
        llm_calls: int,
        total_tokens: int,
        estimated_cost: float,
        candidates: List[Dict],
        goal_achieved: bool,
        iterations: int,
        min_fit_score: float = 5.0,
        reasoning_log: List[Dict] = None,
        timestamp: str = ""
    ) -> ArchitectureMetrics:
        """Create metrics from execution results"""
        
        # Calculate quality metrics
        fit_scores = [c.get("fit_score", 0) for c in candidates]
        top_fit_score = max(fit_scores) if fit_scores else 0.0
        avg_fit_score = statistics.mean(fit_scores) if fit_scores else 0.0
        high_quality_count = sum(1 for score in fit_scores if score >= min_fit_score)
        
        return ArchitectureMetrics(
            architecture=architecture,
            query=query,
            execution_time=execution_time,
            llm_calls=llm_calls,
            total_tokens=total_tokens,
            estimated_cost=estimated_cost,
            candidates_found=len(candidates),
            candidates_ranked=len(candidates),
            top_fit_score=top_fit_score,
            avg_fit_score=avg_fit_score,
            high_quality_count=high_quality_count,
            goal_achieved=goal_achieved,
            iterations=iterations,
            reasoning_log=reasoning_log or [],
            timestamp=timestamp
        )
    
    def compare_architectures(
        self,
        rule_based: ArchitectureMetrics,
        agentic: ArchitectureMetrics
    ) -> ComparisonResult:
        """Compare two architecture runs"""
        
        # Calculate comparative metrics
        speedup_factor = rule_based.execution_time / agentic.execution_time if agentic.execution_time > 0 else 0
        cost_ratio = agentic.estimated_cost / rule_based.estimated_cost if rule_based.estimated_cost > 0 else 0
        quality_improvement = agentic.top_fit_score - rule_based.top_fit_score
        
        # Determine winner
        winner, reason = self._determine_winner(rule_based, agentic)
        
        # Detailed breakdown
        comparison_breakdown = {
            "speed": {
                "rule_based_time": rule_based.execution_time,
                "agentic_time": agentic.execution_time,
                "speedup_factor": speedup_factor,
                "winner": "rule-based" if speedup_factor < 1 else "agentic"
            },
            "cost": {
                "rule_based_cost": rule_based.estimated_cost,
                "agentic_cost": agentic.estimated_cost,
                "cost_ratio": cost_ratio,
                "winner": "rule-based" if cost_ratio > 1 else "agentic"
            },
            "quality": {
                "rule_based_top_score": rule_based.top_fit_score,
                "agentic_top_score": agentic.top_fit_score,
                "improvement": quality_improvement,
                "winner": "agentic" if quality_improvement > 0 else "rule-based" if quality_improvement < 0 else "tie"
            },
            "efficiency": {
                "rule_based_llm_calls": rule_based.llm_calls,
                "agentic_llm_calls": agentic.llm_calls,
                "llm_call_ratio": agentic.llm_calls / rule_based.llm_calls if rule_based.llm_calls > 0 else 0
            },
            "coverage": {
                "rule_based_candidates": rule_based.candidates_found,
                "agentic_candidates": agentic.candidates_found,
                "difference": agentic.candidates_found - rule_based.candidates_found
            },
            "goal_achievement": {
                "rule_based": rule_based.goal_achieved,
                "agentic": agentic.goal_achieved,
                "winner": "agentic" if agentic.goal_achieved and not rule_based.goal_achieved else "rule-based" if rule_based.goal_achieved and not agentic.goal_achieved else "tie"
            }
        }
        
        result = ComparisonResult(
            query=rule_based.query,
            rule_based=rule_based,
            agentic=agentic,
            speedup_factor=speedup_factor,
            cost_ratio=cost_ratio,
            quality_improvement=quality_improvement,
            winner=winner,
            winner_reason=reason,
            comparison_breakdown=comparison_breakdown
        )
        
        self.results.append(result)
        return result
    
    def _determine_winner(
        self,
        rule_based: ArchitectureMetrics,
        agentic: ArchitectureMetrics
    ) -> Tuple[str, str]:
        """Determine which architecture performed better"""
        
        reasons = []
        points_rule = 0
        points_agentic = 0
        
        # 1. Goal achievement (most important)
        if rule_based.goal_achieved and not agentic.goal_achieved:
            points_rule += 3
            reasons.append("✅ Rule-based achieved goal, agentic failed")
        elif agentic.goal_achieved and not rule_based.goal_achieved:
            points_agentic += 3
            reasons.append("✅ Agentic achieved goal, rule-based failed")
        elif rule_based.goal_achieved and agentic.goal_achieved:
            reasons.append("✅ Both achieved goal")
        else:
            reasons.append("⚠️ Neither achieved goal")
        
        # 2. Quality (top candidate fit score)
        if abs(agentic.top_fit_score - rule_based.top_fit_score) >= 1.0:
            if agentic.top_fit_score > rule_based.top_fit_score:
                points_agentic += 2
                reasons.append(f"🎯 Agentic found higher quality candidate ({agentic.top_fit_score:.1f} vs {rule_based.top_fit_score:.1f})")
            else:
                points_rule += 2
                reasons.append(f"🎯 Rule-based found higher quality candidate ({rule_based.top_fit_score:.1f} vs {agentic.top_fit_score:.1f})")
        else:
            reasons.append(f"📊 Similar candidate quality (~{rule_based.top_fit_score:.1f})")
        
        # 3. Speed
        speedup = rule_based.execution_time / agentic.execution_time if agentic.execution_time > 0 else 1
        if speedup < 0.7:  # Agentic significantly slower
            points_rule += 1
            reasons.append(f"⚡ Rule-based is {1/speedup:.1f}x faster")
        elif speedup > 1.3:  # Agentic faster
            points_agentic += 1
            reasons.append(f"⚡ Agentic is {speedup:.1f}x faster")
        else:
            reasons.append(f"⏱️ Similar speed ({rule_based.execution_time:.1f}s vs {agentic.execution_time:.1f}s)")
        
        # 4. Cost efficiency
        cost_ratio = agentic.estimated_cost / rule_based.estimated_cost if rule_based.estimated_cost > 0 else 1
        if cost_ratio > 2.0:  # Agentic significantly more expensive
            points_rule += 1
            reasons.append(f"💰 Rule-based is {cost_ratio:.1f}x cheaper")
        elif cost_ratio < 0.8:  # Agentic cheaper
            points_agentic += 1
            reasons.append(f"💰 Agentic is {1/cost_ratio:.1f}x cheaper")
        else:
            reasons.append(f"💵 Similar cost (${rule_based.estimated_cost:.4f} vs ${agentic.estimated_cost:.4f})")
        
        # Determine winner
        if points_agentic > points_rule:
            return "agentic", " | ".join(reasons) + f" → Agentic wins ({points_agentic}-{points_rule})"
        elif points_rule > points_agentic:
            return "rule-based", " | ".join(reasons) + f" → Rule-based wins ({points_rule}-{points_agentic})"
        else:
            return "tie", " | ".join(reasons) + f" → TIE ({points_rule}-{points_agentic})"
    
    def aggregate_results(self) -> Dict:
        """Aggregate statistics across all comparison runs"""
        
        if not self.results:
            return {"error": "No comparison results available"}
        
        # Count wins
        rule_based_wins = sum(1 for r in self.results if r.winner == "rule-based")
        agentic_wins = sum(1 for r in self.results if r.winner == "agentic")
        ties = sum(1 for r in self.results if r.winner == "tie")
        
        # Average metrics
        avg_speedup = statistics.mean([r.speedup_factor for r in self.results])
        avg_cost_ratio = statistics.mean([r.cost_ratio for r in self.results])
        avg_quality_improvement = statistics.mean([r.quality_improvement for r in self.results])
        
        # Goal achievement rates
        rule_based_goal_rate = sum(1 for r in self.results if r.rule_based.goal_achieved) / len(self.results)
        agentic_goal_rate = sum(1 for r in self.results if r.agentic.goal_achieved) / len(self.results)
        
        return {
            "total_comparisons": len(self.results),
            "wins": {
                "rule_based": rule_based_wins,
                "agentic": agentic_wins,
                "ties": ties
            },
            "win_rates": {
                "rule_based": rule_based_wins / len(self.results),
                "agentic": agentic_wins / len(self.results),
                "tie": ties / len(self.results)
            },
            "average_metrics": {
                "speedup_factor": avg_speedup,
                "cost_ratio": avg_cost_ratio,
                "quality_improvement": avg_quality_improvement
            },
            "goal_achievement_rates": {
                "rule_based": rule_based_goal_rate,
                "agentic": agentic_goal_rate
            },
            "performance_summary": {
                "speed_winner": "rule-based" if avg_speedup < 1 else "agentic",
                "cost_winner": "rule-based" if avg_cost_ratio > 1 else "agentic",
                "quality_winner": "agentic" if avg_quality_improvement > 0 else "rule-based"
            }
        }
    
    def generate_report(self) -> str:
        """Generate a markdown report of all comparisons"""
        
        if not self.results:
            return "# Evaluation Report\n\nNo comparison results available."
        
        aggregate = self.aggregate_results()
        
        report = f"""# Architecture Comparison Report

## Summary Statistics

**Total Comparisons:** {aggregate['total_comparisons']}

### Win/Loss Record
- 🏆 **Rule-Based Wins:** {aggregate['wins']['rule_based']} ({aggregate['win_rates']['rule_based']:.1%})
- 🏆 **Agentic Wins:** {aggregate['wins']['agentic']} ({aggregate['win_rates']['agentic']:.1%})
- 🤝 **Ties:** {aggregate['wins']['ties']} ({aggregate['win_rates']['tie']:.1%})

### Average Performance Metrics
- ⚡ **Speed Factor:** {aggregate['average_metrics']['speedup_factor']:.2f}x (< 1 means agentic is slower)
- 💰 **Cost Ratio:** {aggregate['average_metrics']['cost_ratio']:.2f}x (agentic cost / rule-based cost)
- 🎯 **Quality Improvement:** {aggregate['average_metrics']['quality_improvement']:+.2f} (agentic - rule-based fit score)

### Goal Achievement Rates
- ✅ **Rule-Based:** {aggregate['goal_achievement_rates']['rule_based']:.1%}
- ✅ **Agentic:** {aggregate['goal_achievement_rates']['agentic']:.1%}

### Overall Winners
- ⚡ **Speed:** {aggregate['performance_summary']['speed_winner'].title()}
- 💰 **Cost Efficiency:** {aggregate['performance_summary']['cost_winner'].title()}
- 🎯 **Quality:** {aggregate['performance_summary']['quality_winner'].title()}

---

## Detailed Results

"""
        
        for i, result in enumerate(self.results, 1):
            report += f"""### Comparison {i}: {result.winner.upper()} Wins

**Query:** {result.query[:80]}...

**Winner:** {result.winner.title()}
**Reason:** {result.winner_reason}

#### Performance Comparison

| Metric | Rule-Based | Agentic | Difference |
|--------|-----------|---------|-----------|
| Execution Time | {result.rule_based.execution_time:.2f}s | {result.agentic.execution_time:.2f}s | {result.speedup_factor:.2f}x |
| LLM Calls | {result.rule_based.llm_calls} | {result.agentic.llm_calls} | +{result.agentic.llm_calls - result.rule_based.llm_calls} |
| Cost | ${result.rule_based.estimated_cost:.4f} | ${result.agentic.estimated_cost:.4f} | {result.cost_ratio:.2f}x |
| Top Fit Score | {result.rule_based.top_fit_score:.1f} | {result.agentic.top_fit_score:.1f} | {result.quality_improvement:+.1f} |
| Candidates Found | {result.rule_based.candidates_found} | {result.agentic.candidates_found} | {result.agentic.candidates_found - result.rule_based.candidates_found:+d} |
| Goal Achieved | {'✅' if result.rule_based.goal_achieved else '❌'} | {'✅' if result.agentic.goal_achieved else '❌'} | - |

---

"""
        
        return report


# Global evaluation service instance
evaluation_service = EvaluationService()
