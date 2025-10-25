from typing import List, Any
from llama_index.core.embeddings import BaseEmbedding
from llama_index.core.llms import CustomLLM, CompletionResponse, LLMMetadata

import ollama

from .embedder import embedder


class CustomRAGEmbedder(BaseEmbedding):
    
    """Wraps the existing embedding service to be compatible with LlamaIndex."""
    
    def _get_text_embedding(self, text: str) -> List[float]:
        """Private method for getting text embedding."""
        return embedder.generate_embedding(text)
    
    def get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Private method for getting batch embeddings."""
        return embedder.generate_embeddings_batch(texts)
    
    def _get_query_embedding(self, query: str) -> List[float]:
        """Private method for getting query embedding."""
        return embedder.generate_embedding(query)
    
    async def _aget_text_embedding(self, text: str) -> List[float]:
        """Async version - falls back to sync."""
        return self._get_text_embedding(text)
    
    async def _aget_query_embedding(self, query: str) -> List[float]:
        """Async version - falls back to sync."""
        return self._get_query_embedding(query)


class LocalLLMClient:
    """Local LLM client using Ollama."""
    
    def __init__(self, model_name: str = "llama3.2"):
        """
        Initialize Ollama client.
        
        Args:
            model_name: Model name (e.g., "llama3.2", "mistral", "phi3")
        """
        self.model_name = model_name
    
    def generate_text(self, system_prompt: str, user_prompt: str, 
                     temperature: float = 0.0, max_tokens: int = 512) -> str:
        """Generate text using Ollama."""
        response = ollama.chat(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            options={
                "temperature": temperature,
                "num_predict": max_tokens
            }
        )
        return response['message']['content']


class CustomRAGLLM(CustomLLM):
    """Wraps local Ollama LLM to be compatible with LlamaIndex."""

    @property
    def metadata(self) -> LLMMetadata:
        """Return LLM metadata."""
        return LLMMetadata(
            model_name=local_llm_client.model_name,
            context_window=4096,
            num_output=512,
            is_chat_model=False,
        )

    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        """Generate completion."""
        response_text = local_llm_client.generate_text(
            system_prompt="You are an expert entity and relationship extractor for candidate resumes and cover letters.",
            user_prompt=prompt,
            temperature=0.0  # cannot be changed, must be deterministic for graph extraction
        )
        return CompletionResponse(text=response_text)

    def stream_complete(self, prompt: str, **kwargs: Any):
        """Stream completion - yields single response."""
        response = self.complete(prompt, **kwargs)
        yield response


# remember to run "ollama pull llama3.2" in terminal first
local_llm_client = LocalLLMClient(model_name="llama3.2")

custom_llm = CustomRAGLLM()
custom_embed_model = CustomRAGEmbedder()