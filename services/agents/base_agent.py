"""
Base classes for agentic recruitment system.

Defines core abstractions:
- AgentState: Current state of the agent
- AgentDecision: What the agent decided to do
- ToolResult: Result from executing a tool
- BaseTool: Abstract base class for tools
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import time


class ToolName(Enum):
    """Available tools for the agent"""
    SEARCH_CANDIDATES = "search_candidates"
    ANALYZE_GITHUB = "analyze_github"
    GET_PERSONALITY = "get_personality"
    RANK_CANDIDATES = "rank_candidates"
    EXPAND_SEARCH = "expand_search"
    FINISH = "finish"


@dataclass
class ToolResult:
    """Result from a tool execution"""
    tool_name: str
    success: bool
    data: Dict[str, Any]
    error: Optional[str] = None
    execution_time: float = 0.0


@dataclass
class AgentDecision:
    """Agent's decision on next action"""
    tool_name: str
    reasoning: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0


@dataclass
class AgentState:
    """Current state of the agent"""
    query: str
    candidates: List[Dict] = field(default_factory=list)
    enriched_candidates: List[Dict] = field(default_factory=list)
    final_rankings: List[Dict] = field(default_factory=list)
    
    # Metadata
    iterations: int = 0
    max_iterations: int = 5
    goal_met: bool = False
    
    # Quality thresholds
    min_candidates: int = 3
    min_fit_score: float = 7.0
    
    # Execution tracking
    tools_used: List[str] = field(default_factory=list)
    execution_log: List[Dict] = field(default_factory=list)
    total_execution_time: float = 0.0
    
    def add_execution_log(self, decision: AgentDecision, result: ToolResult):
        """Log an execution step"""
        self.execution_log.append({
            "iteration": self.iterations,
            "tool": decision.tool_name,
            "reasoning": decision.reasoning,
            "success": result.success,
            "execution_time": result.execution_time,
            "timestamp": time.time()
        })
        self.tools_used.append(decision.tool_name)
        self.total_execution_time += result.execution_time
    
    def check_goal(self) -> bool:
        """Check if agent's goal is achieved"""
        if not self.final_rankings:
            return False
        
        high_quality = [c for c in self.final_rankings 
                       if c.get("fit_score", 0) >= self.min_fit_score]
        
        return len(high_quality) >= self.min_candidates
    
    def should_continue(self) -> bool:
        """Decide if agent should continue iterating"""
        if self.goal_met:
            return False
        if self.iterations >= self.max_iterations:
            return False
        return True


class BaseTool(ABC):
    """Abstract base class for agent tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def execute(self, state: AgentState, parameters: Dict) -> ToolResult:
        """Execute the tool"""
        pass
    
    def to_dict(self) -> Dict:
        """Tool description for LLM"""
        return {
            "name": self.name,
            "description": self.description
        }
