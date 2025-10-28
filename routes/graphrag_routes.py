from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
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

@router.delete("/delete-graphrag-nodes")
async def delete_graph_nodes(
    student_id: Optional[str] = Query(
        None, 
        description="Student ID to delete nodes for. If not provided, deletes ALL nodes (use with caution!)"
    )
):
    """
    Delete GraphRAG nodes.
    - if student_id is provided: deletes only that student's nodes
    - if student_id is NOT provided: deletes ALL nodes (WARNING : this cannot be undone!)
    """
    
    result = GraphRAGService.delete_nodes(student_id)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    
    return {
        "message": result["message"],
        "deleted_count": result["count"],
        "student_id": student_id
    }