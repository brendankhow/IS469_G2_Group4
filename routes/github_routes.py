from fastapi import APIRouter, HTTPException
from pydantic import BaseModel  
from typing import Optional, Dict, Any, List
from services.github.github_client import fetch_all_user_repos_data
from services.github.github_embedder import process_github_repos
from services.github.github_analysis import github_analysis_service
from services.vector_store import VectorStore
from services.llm_client import llm_client

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

class GithubFollowupRequest(BaseModel):
    student_id: str
    github_username: str
    question: str
    chat_history: List[Dict[str, str]]  # Previous conversation in this session
    temperature: float = 0.7

@router.post("/followup", response_model=AnalysisResponse)
def analyze_chat(request: GithubFollowupRequest):
    """
    Follow-up questions about a student's GitHub analysis.
    Designed for students to ask questions about their own GitHub profile analysis.
    
    Example request:
    {
    "student_id": "dd5b35f8-2262-42bc-954e-8131afd6e367",
    "github_username": "drawrowfly",
    "question": "Can you explain more about my skill gaps",
    "chat_history": [
        {
        "role": "assistant",
        "content": "Your GitHub profile shows that you are good in frontend but need to work on backend as you only know hello world from python and not java"
        },
        {
        "role": "user",
        "content": "What are my strengths?"
        }
    ],
    "temperature": 0.7
    }
    """
    try:
        # Extract the most recent analysis from chat history
        previous_analysis = ""
        for msg in request.chat_history:
            if msg.get("role") == "assistant":
                previous_analysis = msg.get("content", "")
                break  # Get the most recent assistant message
        
        # Build conversation context summary
        conversation_context = "\n".join([
            f"{msg['role']}: {msg['content'][:150]}..." 
            for msg in request.chat_history[-3:]
        ]) if request.chat_history else 'This is the first question.'
        
        # Build system prompt
        system_prompt = f"""You are an AI career advisor specializing in GitHub profile analysis and career development for software engineers.

            **Context:**
            The student (@{request.github_username}) has received a GitHub profile analysis and is now asking follow-up questions.

            **Previous Analysis Summary:**
            {previous_analysis[:2000]}

            **Your Role:**
            - Help the student understand their GitHub analysis
            - Provide actionable career advice
            - Suggest specific improvements to their projects or profile
            - Answer questions about skill gaps, job readiness, or project quality
            - Reference specific projects and skills from their profile
            - Be encouraging but honest about areas for improvement

            **Formatting Guidelines:**
            - Use **bold** for key points and action items
            - Use bullet points (•) for lists
            - Keep responses concise but comprehensive
            - Provide specific examples when possible
            - Include next steps or action items when relevant

            **Conversation Context:**
            {conversation_context}
            """
        
        # Build full messages array
        messages = [
            {"role": "system", "content": system_prompt},
            *request.chat_history,  # Include full chat history for context
            {"role": "user", "content": request.question}
        ]
        
        # Use the centralized chat_completion method
        response_text = llm_client.chat_completion(
            messages=messages,
            temperature=request.temperature
        )
        
        # Return in the AnalysisResponse format
        return AnalysisResponse(analysis={"response": response_text})
        
    except Exception as e:
        error_msg = str(e)
        print(f"[github_followup] Error: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"GitHub followup error: {error_msg}")