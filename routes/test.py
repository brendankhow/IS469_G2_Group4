# keeping the original one - after adding the github, the scores for the candidates got lower
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


#  original response
{
  "response": "Here’s the ranking and evaluation of the candidates based on the job description for a **Software Engineer with experience in Python and JavaScript**:\n\n### **1. student**  \n- **Fit Score:** 8/10  \n  - **Skills:** JavaScript, TypeScript, HTML, CSS, React, Angular, Node.js, Express.js  \n  - **Experience:**  \n    - Spearheaded a flagship site rewrite from Angular.js to Angular 10, improving performance.  \n    - Developed React components, demonstrating front-end expertise.  \n- **Recommended Next Step:** **Interview** (Strong fit with JavaScript and modern frameworks, though Python is not explicitly mentioned.)  \n\n### **2. Choo Yi Ning**  \n- **Fit Score:** 3/10  \n  - **Skills:** Python (listed but no detail on usage)  \n  - **Experience:**  \n    - Senior Audit Professional (no relevant software engineering experience).  \n    - No mention of JavaScript or web development.  \n- **Recommended Next Step:** **Reject** (Lacks relevant experience.)  \n\n### **3. john**  \n- **Fit Score:** 1/10  \n  - **Skills:** No relevant technical skills listed.  \n  - **Experience:**  \n    - Focus on early childhood development and special needs care.  \n    - No software engineering or programming background.  \n- **Recommended Next Step:** **Reject** (Completely unrelated field.)  \n\n### **Final Recommendation:**  \n- **Interview \"student\"**—best fit despite Python not being explicitly detailed (may have transferable skills).  \n- **Reject the other two**—lack required technical experience.  \n\nWould you like me to refine the evaluation further?"
}