# services/llm_client.py
import os
os.environ["HF_INFERENCE_ENDPOINT"] = "https://api-inference.huggingface.co"
from huggingface_hub import InferenceClient
from dotenv import load_dotenv
from typing import List, Dict

load_dotenv()

class LLMClient:
    def __init__(self):
        hf_api_key = os.getenv("HF_API_KEY")
        if not hf_api_key:
            raise ValueError("HF_API_KEY not found in environment variables.")
        
        self.model_name = "deepseek-ai/DeepSeek-V3-0324" # can modify
        self.client = InferenceClient(token=hf_api_key)

    def generate_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        """
        Generate text using the LLM with a system and user prompt.
        
        Args:
            system_prompt: The system-level instruction
            user_prompt: The user's input/query
            temperature: Sampling temperature (0-1)
            
        Returns:
            Generated text response
        """
        try:
            # Create the messages array
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Call the Hugging Face API using chat_completion method
            response = self.client.chat_completion(
                messages=messages,
                model=self.model_name,
                temperature=temperature,
                max_tokens=2000
            )
            
            # Extract and return the response content
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating text: {e}")
            return f"Error: {str(e)}"
        
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
    ) -> str:
        """
        Generate a chat completion with full conversation history.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
                     Example: [
                         {"role": "system", "content": "You are a helpful assistant"},
                         {"role": "user", "content": "Hello"},
                         {"role": "assistant", "content": "Hi there!"},
                         {"role": "user", "content": "How are you?"}
                     ]
            temperature: Sampling temperature (0-1)
            
        Returns:
            Generated response text
        """
        try:
            response = self.client.chat_completion(
                messages=messages,
                model=self.model_name,
                temperature=temperature,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error in chat completion: {e}")
            return f"Error: {str(e)}"
        

llm_client = LLMClient()