from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.customrag_service import *

router = APIRouter()
customrag_service = CustomRAGService()

class CustomRAGQueryRequest(BaseModel):
    query: str
    top_k: int = 3  # How many candidates to return
    filters: dict = None

@router.post("/query/customrag")
async def query_candidates_customrag(request: CustomRAGQueryRequest):
    """
    Endpoint for recruiters to search candidates using the Custom RAG approach.
    """
    try:
        results = customrag_service.query_custom_rag(
            query_text=request.query,
            top_k=request.top_k,
            filters=request.filters
        )
        return {
            "success": True,
            "query": request.query,
            "ranking_method": "custom_rag_max_similarity",
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CustomRAG query failed: {str(e)}")