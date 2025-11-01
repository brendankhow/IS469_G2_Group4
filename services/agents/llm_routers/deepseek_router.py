"""
DeepSeek-V3 Router Implementation.

Frontier LLM Router using DeepSeek-V3 (671B parameters).
- High reasoning capability
- Slower but accurate
- API-based (HuggingFace)
"""

from typing import List, Dict
import json
import time
from huggingface_hub import InferenceClient
from .base_router import BaseLLMRouter, LLMConfig, LLMResponse
from ..base_agent import AgentState, AgentDecision
import os


class DeepSeekRouter(BaseLLMRouter):
    """
    Frontier LLM Router using DeepSeek-V3 (671B parameters)
    """
    
    def __init__(self):
        config = LLMConfig(
            model_name="deepseek-ai/DeepSeek-V3-0324",
            provider="huggingface",
            size="large",  # 671B parameters
            context_window=64000,
            supports_json_mode=True,
            cost_per_1k_tokens=0.002  # Approximate
        )
        super().__init__(config)
        
        self.client = InferenceClient(token=os.getenv("HF_API_KEY"))
    
    async def decide_next_action(
        self, 
        state: AgentState, 
        available_tools: List[Dict]
    ) -> AgentDecision:
        """Use DeepSeek-V3 to decide next action"""
        
        prompt = self._build_decision_prompt(state, available_tools)
        
        start_time = time.time()
        
        try:
            completion = self.client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a decision-making agent. Always respond with valid JSON only. No markdown, no explanation."},
                    {"role": "user", "content": prompt}
                ],
                model=self.config.model_name,
                temperature=0.3,  # Lower temp for more deterministic decisions
                max_tokens=300
            )
            
            latency = time.time() - start_time
            response_text = completion.choices[0].message.content.strip()
            
            # Parse JSON response
            response_text = self._extract_json(response_text)
            decision_json = json.loads(response_text)
            
            # Track usage
            self.total_calls += 1
            tokens_used = len(prompt.split()) + len(response_text.split())  # Rough estimate
            self.total_tokens += tokens_used
            self.total_cost += self._calculate_cost(tokens_used)
            
            return AgentDecision(
                tool_name=decision_json["tool_name"],
                reasoning=decision_json["reasoning"],
                parameters=decision_json.get("parameters", {}),
                confidence=decision_json.get("confidence", 1.0)
            )
        
        except Exception as e:
            print(f"⚠️ DeepSeek decision error: {e}, using fallback")
            return self._fallback_decision(state)
    
    async def rank_candidates(
        self,
        candidates: List[Dict],
        query: str,
        temperature: float = 0.7
    ) -> List[Dict]:
        """Use DeepSeek-V3 to rank candidates"""
        
        # Build context from candidates
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
            
            # Add GitHub projects if available
            if c.get('github_projects'):
                candidate_info.append("\n🔍 Top Projects:")
                for proj in c['github_projects'][:3]:
                    candidate_info.append(
                        f"  • {proj.get('repo_name', 'Unknown')}: {proj.get('description', '')[:100]}"
                    )
            
            # Add personality if available
            if c.get('personality_data'):
                pd = c['personality_data']
                candidate_info.append(f"\n🧠 Personality: Conscientiousness {pd.get('conscientiousness', 0):.2f}, Interview Score {pd.get('interview_score', 0):.2f}")
            
            rag_context_parts.append("\n".join(candidate_info))
        
        rag_context = "\n\n---\n\n".join(rag_context_parts)
        
        SYSTEM_PROMPT = """You are a professional recruiter. Rank candidates and provide detailed evaluations.

For each candidate provide:
1. Fit score (0-10)
2. 3 evaluation bullets with specific evidence
3. Notable GitHub projects
4. Next step (Interview/Phone Screen/Reject)
5. Personality insight (if data available)

Return ONLY valid JSON array."""

        USER_PROMPT = f"""Candidates:\n\n{rag_context}\n\nJob Requirements: {query}"""
        
        try:
            completion = self.client.chat_completion(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": USER_PROMPT}
                ],
                model=self.config.model_name,
                temperature=temperature,
                max_tokens=4000
            )
            
            response_text = completion.choices[0].message.content.strip()
            
            # Track usage
            self.total_calls += 1
            tokens_used = len(USER_PROMPT.split()) + len(response_text.split())
            self.total_tokens += tokens_used
            self.total_cost += self._calculate_cost(tokens_used)
            
            # Parse JSON and return
            response_text = self._extract_json(response_text)
            ranked = json.loads(response_text)
            
            return ranked if isinstance(ranked, list) else candidates
            
        except Exception as e:
            print(f"⚠️ DeepSeek ranking error: {e}")
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
            # If we have candidates but not ranked, rank them (enrichment is optional)
            return AgentDecision("rank_candidates", "Fallback: Need ranking", {})
        elif not state.final_rankings:
            return AgentDecision("rank_candidates", "Fallback: Need ranking", {})
        else:
            return AgentDecision("finish", "Fallback: Done", {})
