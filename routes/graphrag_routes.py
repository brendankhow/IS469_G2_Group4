from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.graphrag_service import GraphRAGService

router = APIRouter()
graphrag_service = GraphRAGService()

class RecruiterQueryRequest(BaseModel):
    query: str
    top_k: int = 15
    filters: dict = None  # optional metadata filters like {"skills": "Python"}

@router.post("/query")
def query_candidates(request: RecruiterQueryRequest):
    """
    Endpoint for recruiters to search across all candidates using GraphRAG.
    """
    try:
        result = graphrag_service.query_candidates(
            query_text=request.query,
            top_k=request.top_k,
            filters=request.filters
        )
        return {
            "success": True,
            "query": request.query,
            "response": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GraphRAG query failed: {str(e)}")

@router.post("/build-index")
def build_global_index():
    """
    Endpoint to build a global GraphRAG index for all candidates.
    Should be triggered when new candidates are added or resumes updated.
    """
    try:
        index = graphrag_service.build_global_graph_index()
        if not index:
            return {"success": False, "message": "No candidate documents found to index."}
        return {"success": True, "message": "Global GraphRAG index built successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")