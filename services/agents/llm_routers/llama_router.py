"""
Llama3.2:1B Router Implementation.

Small Local LLM Router using Llama3.2:1B via Ollama.
- Fast inference (local)
- Zero API cost
- Limited reasoning capability vs frontier models
"""

from typing import List, Dict
import json
import time
import ollama
from .base_router import BaseLLMRouter, LLMConfig, LLMResponse
from ..base_agent import AgentState, AgentDecision


class LlamaRouter(BaseLLMRouter):
    """
    Small Local LLM Router using Llama3.2:1B (1B parameters)
    Running locally via Ollama - zero API cost, fast inference
    """
    
    def __init__(self, model_name: str = "llama3.2:1b"):
        config = LLMConfig(
            model_name=model_name,
            provider="ollama",
            size="small",  # 1B parameters
            context_window=8192,
            supports_json_mode=True,
            cost_per_1k_tokens=0.0  # Local model = free
        )
        super().__init__(config)
        self.model_name = model_name
    
    async def decide_next_action(
        self, 
        state: AgentState, 
        available_tools: List[Dict]
    ) -> AgentDecision:
        """Use Llama3.2:1B to decide next action"""
        
        prompt = self._build_decision_prompt(state, available_tools)
        
        start_time = time.time()
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a decision-making agent. Always respond with valid JSON only. No markdown, no explanation."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                options={
                    "temperature": 0.3,  # Lower temp for more deterministic decisions
                    "num_predict": 300
                },
                format="json"  # Force JSON output
            )
            
            latency = time.time() - start_time
            response_text = response['message']['content'].strip()
            
            # Parse JSON response
            response_text = self._extract_json(response_text)
            decision_json = json.loads(response_text)
            
            # Track usage
            self.total_calls += 1
            # For local models, we still track tokens for comparison purposes
            tokens_used = len(prompt.split()) + len(response_text.split())  # Rough estimate
            self.total_tokens += tokens_used
            self.total_cost += 0.0  # Local = free
            
            return AgentDecision(
                tool_name=decision_json["tool_name"],
                reasoning=decision_json["reasoning"],
                parameters=decision_json.get("parameters", {}),
                confidence=decision_json.get("confidence", 1.0)
            )
        
        except Exception as e:
            print(f"⚠️ Llama decision error: {e}, using fallback")
            return self._fallback_decision(state)
    
    async def rank_candidates(
        self,
        candidates: List[Dict],
        query: str,
        temperature: float = 0.7
    ) -> List[Dict]:
        """Use Llama3.2:1B to rank candidates"""
        
        # Build context from candidates (same as DeepSeek but for local model)
        rag_context_parts = []
        for i, c in enumerate(candidates):
            github_username = c.get('github_username', 'N/A')
            github_url = f"https://github.com/{github_username}" if github_username != "N/A" else "N/A"
            
            candidate_info = [
                f"{i+1}. {c.get('name', 'Unknown')} (@{github_username})",
                f"GitHub Profile: {github_url}",
                f"Skills: {c.get('skills', 'N/A')}",
                f"Resume Match: {c.get('resume_similarity', 0):.2%}"
            ]
            
            # Add resume text if available (shortened for smaller model)
            if c.get('resume_text'):
                resume_preview = c.get('resume_text', '')[:300]  # Limit context for small model
                candidate_info.append(f"\n📄 Resume: {resume_preview}...")
            
            # Add GitHub projects if available
            if c.get('github_projects'):
                candidate_info.append("\n🔍 Top Projects:")
                for proj in c['github_projects'][:2]:  # Only top 2 for smaller context
                    candidate_info.append(
                        f"  • {proj.get('repo_name', 'Unknown')}: {proj.get('description', '')[:80]}"
                    )
            
            # Add personality if available
            if c.get('personality_data'):
                pd = c['personality_data']
                candidate_info.append(f"\n🧠 Personality: C={pd.get('conscientiousness', 0):.1f}, I={pd.get('interview_score', 0):.1f}")
            
            rag_context_parts.append("\n".join(candidate_info))
        
        rag_context = "\n\n---\n\n".join(rag_context_parts)
        
        # Simplified prompt for smaller model
        SYSTEM_PROMPT = """You are a recruiter. Rank candidates with:
            1. Fit score (0-10)
            2. 3 evaluation bullets
            3. Notable projects
            4. Next step
            5. Personality insight

            Scoring:
            - 9-10: Perfect match
            - 7-8: Strong match
            - 5-6: Moderate match
            - 3-4: Weak match
            - 0-2: Poor match

            Return ONLY valid JSON array."""

        USER_PROMPT = f"""Candidates:\n\n{rag_context}\n\nJob: {query}"""
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": USER_PROMPT}
                ],
                options={
                    "temperature": temperature,
                    "num_predict": 2000
                },
                format="json"
            )
            
            response_text = response['message']['content'].strip()
            
            # Track usage
            self.total_calls += 1
            tokens_used = len(USER_PROMPT.split()) + len(response_text.split())
            self.total_tokens += tokens_used
            self.total_cost += 0.0  # Local = free
            
            # Parse JSON and return
            response_text = self._extract_json(response_text)
            ranked = json.loads(response_text)
            
            return ranked if isinstance(ranked, list) else candidates
            
        except Exception as e:
            print(f"⚠️ Llama ranking error: {e}")
            # Return candidates as-is with basic scores
            return candidates
    
    def _extract_json(self, text: str) -> str:
        """Extract JSON from markdown code blocks"""
        if "```json" in text:
            return text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            return text.split("```")[1].split("```")[0].strip()
        return text
    
    def _fallback_decision(self, state: AgentState) -> AgentDecision:
        """Rule-based fallback if LLM fails"""
        if not state.candidates:
            return AgentDecision("search_candidates", "Fallback: No candidates yet", {"top_k": 5, "threshold": 0.0})
        elif state.candidates and not state.final_rankings:
            return AgentDecision("rank_candidates", "Fallback: Need ranking", {})
        elif not state.final_rankings:
            return AgentDecision("rank_candidates", "Fallback: Need ranking", {})
        else:
            return AgentDecision("finish", "Fallback: Done", {})
