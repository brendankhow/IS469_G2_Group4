"""
Base LLM Router abstraction.

Defines the interface for different LLM routers (DeepSeek, Qwen, Llama, etc.)
that can be used as the "brain" of the agentic system.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass
import time


@dataclass
class LLMConfig:
    """Configuration for an LLM"""
    model_name: str
    provider: str  # "huggingface", "openai", "local"
    size: str  # "small" (<5B), "medium" (5-20B), "large" (>20B)
    context_window: int
    supports_json_mode: bool = False
    cost_per_1k_tokens: float = 0.0


@dataclass
class LLMResponse:
    """Standardized LLM response"""
    content: str
    reasoning: Optional[str] = None
    model_used: str = ""
    tokens_used: int = 0
    latency: float = 0.0
    cost: float = 0.0


class BaseLLMRouter(ABC):
    """Abstract base class for LLM routers"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.total_tokens = 0
        self.total_cost = 0.0
        self.total_calls = 0
    
    @abstractmethod
    async def decide_next_action(
        self, 
        state: "AgentState", 
        available_tools: List[Dict]
    ) -> "AgentDecision":
        """
        Core agentic reasoning: Decide what to do next.
        Different LLMs will have different reasoning capabilities.
        """
        pass
    
    @abstractmethod
    async def rank_candidates(
        self,
        candidates: List[Dict],
        query: str,
        temperature: float = 0.7
    ) -> List[Dict]:
        """
        Rank candidates using the LLM.
        """
        pass
    
    def _build_decision_prompt(
        self, 
        state: "AgentState", 
        tools: List[Dict]
    ) -> str:
        """Build the reasoning prompt for decision-making"""
        
        tool_descriptions = "\n".join([
            f"- **{t['name']}**: {t['description']}" for t in tools
        ])
        
        execution_history = "None yet (first iteration)" if not state.execution_log else "\n".join([
            f"{i+1}. {log['tool']} - {log['reasoning']} (success: {log['success']}, time: {log['execution_time']:.2f}s)"
            for i, log in enumerate(state.execution_log[-3:])  # Last 3 actions
        ])
        
        top_fit_score = 0
        if state.final_rankings:
            top_fit_score = max([c.get("fit_score", 0) for c in state.final_rankings], default=0)
        
        prompt = f"""You are an autonomous recruitment agent. Your goal is to find at least {state.min_candidates} high-quality candidates (fit_score >= {state.min_fit_score}) for this job.

**Job Query:** {state.query}

**Current State:**
- Iteration: {state.iterations}/{state.max_iterations}
- Candidates found: {len(state.candidates)}
- Candidates enriched (with GitHub/personality): {len(state.enriched_candidates)}
- Candidates ranked: {len(state.final_rankings)}
- Top fit score so far: {top_fit_score}
- Goal achieved: {state.goal_met}

**Previous Actions:**
{execution_history}

**Available Tools:**
{tool_descriptions}

**Decision Rules (STRICT ORDER - CHECK STATE CAREFULLY):**

🚨 NEVER use "search_candidates" if candidates > 0 in Current State above!

1. If candidates = 0 → use "search_candidates"
2. If candidates > 0 → use "analyze_github" 
3. If enriched_candidates > 0 → use "get_personality"
4. If candidates > 0 AND final_rankings = 0 → use "rank_candidates" (MANDATORY!)
5. If final_rankings > 0 AND goal achieved → use "finish"
6. If final_rankings > 0 AND goal NOT achieved AND iterations < max → use "expand_search"
7. If max iterations reached → use "rank_candidates" if not ranked, else "finish"

**CRITICAL RULES:**
- NEVER search again if candidates > 0
- MUST rank before finishing
- Check "Current State" section above for exact counts
- You ALREADY HAVE {len(state.candidates)} candidates! DO NOT SEARCH AGAIN!

**IMPORTANT:** Respond with ONLY a JSON object (no markdown, no explanation):
{{
    "tool_name": "search_candidates",
    "reasoning": "No candidates found yet, need to search",
    "parameters": {{"top_k": 10}},
    "confidence": 0.9
}}
"""
        return prompt
    
    def _calculate_cost(self, tokens: int) -> float:
        """Calculate cost based on token usage"""
        return (tokens / 1000) * self.config.cost_per_1k_tokens
    
    def get_stats(self) -> Dict:
        """Get router statistics"""
        return {
            "model": self.config.model_name,
            "provider": self.config.provider,
            "size": self.config.size,
            "total_calls": self.total_calls,
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "avg_tokens_per_call": self.total_tokens / self.total_calls if self.total_calls > 0 else 0
        }
