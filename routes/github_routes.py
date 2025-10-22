from fastapi import APIRouter, HTTPException
from pydantic import BaseModel  
from services.github.github_client import fetch_all_user_repos_data
from services.github.github_embedder import process_github_repos
from services.vector_store import VectorStore

router = APIRouter()

class GitHubPortfolioRequest(BaseModel):
    username: str
    student_id: str

class GitHubPortfolioResponse(BaseModel):
    documents: list

@router.post("/create", response_model=GitHubPortfolioResponse)
def build_portfolio(request: GitHubPortfolioRequest):
    """
    Build GitHub portfolio for a user by fetching their repos,
    processing README and other data, generating embeddings,
    and storing in pgvector. 

    use this to test 
    
    username: drawrowfly

    student_id: dd5b35f8-2262-42bc-954e-8131afd6e367
    """
    print(f"Building GitHub portfolio for {request.username}...")
    
    # Fetch all repos data
    repos = fetch_all_user_repos_data(
        username=request.username,
    )
    
    if not repos:
        raise HTTPException(status_code=404, detail="No repositories found for this user.")
    
    print(f"Fetched {len(repos)} repositories.")
    
    # Process repos to create documents and embed 
    documents = process_github_repos(repos)
    
    if not documents:
        raise HTTPException(status_code=500, detail="Failed to process GitHub repositories.")
    
    print(f"Processed {len(documents)} documents from repositories.")
    
    # Store documents in vector store
    VectorStore.store_github_documents_batch(
        documents,
        student_id=request.student_id
    )
    
    print(f"Stored documents in vector store.")
    
    return GitHubPortfolioResponse(documents=documents)

@router.delete("/student/{student_id}")
async def delete_github_embeddings(student_id: str):
    """
    Delete all GitHub embeddings for a specific student.
    This should be called when a student removes their GitHub username from profile.
    """
    try:
        print(f"[GitHub Delete] Attempting to delete GitHub embeddings for student_id: {student_id}")
        
        count = VectorStore.delete_student_github_repos(student_id)
        
        print(f"[GitHub Delete] Successfully deleted {count} GitHub embeddings for student_id: {student_id}")
        return {
            "success": True,
            "message": f"Deleted {count} GitHub embedding(s) for student {student_id}",
            "count": count
        }
    
    except Exception as e:
        print(f"[GitHub Delete] Error deleting GitHub embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))