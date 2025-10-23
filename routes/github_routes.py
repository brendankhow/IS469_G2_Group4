from fastapi import APIRouter, HTTPException
from pydantic import BaseModel  
from typing import Optional, Dict, Any
from services.github.github_client import fetch_all_user_repos_data
from services.github.github_embedder import process_github_repos
from services.github.github_analysis import github_analysis_service
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


# ==================== Analysis Endpoints ====================

class AnalysisRequest(BaseModel):
    student_id: str
    github_username: str
    analysis_type: str = "full"  # full, quick, interview_prep, resume, job_fit

class AnalysisResponse(BaseModel):
    analysis: Dict[str, Any]

@router.post("/analyze", response_model=AnalysisResponse)
def analyze_portfolio(request: AnalysisRequest):
    """
    Comprehensive AI analysis of student's GitHub portfolio.
    
    Analysis types:
    - "full": Complete comprehensive analysis (all insights)
    - "quick": 30-second summary
    - "interview_prep": Interview preparation focused
    - "resume": Resume content generation
    - "job_fit": Job fit and market analysis
    
    Example request:
    {
        "student_id": "dd5b35f8-2262-42bc-954e-8131afd6e367",
        "github_username": "drawrowfly",
        "analysis_type": "full"
    }
    """
    try:
        analysis = github_analysis_service.analyze_portfolio_comprehensive(
            student_id=request.student_id,
            github_username=request.github_username,
            analysis_type=request.analysis_type
        )
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        return AnalysisResponse(analysis=analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


class ProjectDeepDiveRequest(BaseModel):
    student_id: str
    repo_name: str
    analysis_focus: str = "all"  # all, technical, presentation, interview

@router.post("/analyze/project", response_model=AnalysisResponse)
def analyze_single_project(request: ProjectDeepDiveRequest):
    """
    Deep dive analysis of a single GitHub project.
    
    Analysis focus:
    - "all": Complete project analysis
    - "technical": Technical architecture and code quality
    - "presentation": README and portfolio presentation
    - "interview": Interview preparation for this project
    
    Example request:
    {
        "student_id": "dd5b35f8-2262-42bc-954e-8131afd6e367",
        "repo_name": "instagram-scraper",
        "analysis_focus": "all"
    }
    """
    try:
        analysis = github_analysis_service.analyze_single_project_deep_dive(
            student_id=request.student_id,
            repo_name=request.repo_name,
            analysis_focus=request.analysis_focus
        )
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        return AnalysisResponse(analysis=analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project analysis failed: {str(e)}")


class JobFitComparisonRequest(BaseModel):
    student_id: str
    target_role: str

@router.post("/analyze/job-fit", response_model=AnalysisResponse)
def compare_against_role(request: JobFitComparisonRequest):
    """
    Compare student's portfolio against a target job role.
    Provides gap analysis and recommendations.
    
    Example request:
    {
        "student_id": "dd5b35f8-2262-42bc-954e-8131afd6e367",
        "target_role": "Full Stack Developer"
    }
    
    Common target roles:
    - "Frontend Developer"
    - "Backend Developer"
    - "Full Stack Developer"
    - "Data Scientist"
    - "Machine Learning Engineer"
    - "Mobile Developer"
    - "DevOps Engineer"
    """
    try:
        analysis = github_analysis_service.generate_portfolio_comparison(
            student_id=request.student_id,
            target_role=request.target_role
        )
        
        if "error" in analysis:
            raise HTTPException(status_code=404, detail=analysis["error"])
        
        return AnalysisResponse(analysis=analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job fit analysis failed: {str(e)}")