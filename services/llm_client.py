# services/llm_client.py
import os
os.environ["HF_INFERENCE_ENDPOINT"] = "https://api-inference.huggingface.co"
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

class LLMClient:
    def __init__(self):
        hf_api_key = os.getenv("HF_API_KEY")
        if not hf_api_key:
            raise ValueError("HF_API_KEY not found in environment variables.")
        
        self.model_name = "deepseek-ai/DeepSeek-V3-0324" # can modify
        self.client = InferenceClient(token=hf_api_key)

    def generate_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        try:
            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Error during LLM generation: {e}")
            return "An error occurred while generating the response."

llm_client = LLMClient()