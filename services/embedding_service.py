from sentence_transformers import SentenceTransformer
from typing import List

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"): # it's a lightweight version of BERT
        """Initialise embedding model"""
        print(f"Loading embedding model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded! Dimension: {self.dimension}")
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        embedding = self.model.encode(text)
        return embedding.tolist()
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        embeddings = self.model.encode(texts)
        return embeddings.tolist()
    
    # we can do chunking in this file if needed 