from typing import List, Any, Optional
from llama_index.core.embeddings import BaseEmbedding
from llama_index.core.llms import CustomLLM, CompletionResponse, LLMMetadata
from llama_index.core.llms.callbacks import CallbackManager

from .embedder import embedder
from .llm_client import llm_client


class CustomRAGEmbedder(BaseEmbedding):
    
    """Wraps the existing embedding service to be compatible with LlamaIndex."""
    
    def _get_text_embedding(self, text: str) -> List[float]:
        """Private method for getting text embedding."""
        return embedder.generate_embedding(text)
    
    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
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


class CustomRAGLLM(CustomLLM):

    """Wraps the existing LLM client to be compatible with LlamaIndex."""

    @property
    def metadata(self) -> LLMMetadata:
        """Return LLM metadata."""
        return LLMMetadata(
            model_name=llm_client.model_name,
            context_window=4096,
            num_output=512,
            is_chat_model=False,
        )

    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        """Generate completion."""
        response_text = llm_client.generate_text(
            system_prompt="You are an expert entity and relationship extractor for candidate resumes and cover letters.",
            user_prompt=prompt,
            temperature=0.0  # cannot be changed, must be deterministic for graph extraction
        )
        return CompletionResponse(text=response_text)

    def stream_complete(self, prompt: str, **kwargs: Any):
        """Stream completion - yields single response."""
        response = self.complete(prompt, **kwargs)
        yield response


custom_llm = CustomRAGLLM()
custom_embed_model = CustomRAGEmbedder()