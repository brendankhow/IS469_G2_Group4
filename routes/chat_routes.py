from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from services.embedder import embedder
from services.vector_store import VectorStore
from services.supabase_client import supabase
from utils.json_parser import format_response
import os

load_dotenv()

router = APIRouter()

HF_API_KEY = os.getenv("HF_API_KEY")
# api key need to tick the 2 read access under repo and make calls to inference providers
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324" # i randomly piak a model, feel free to change and play around 

client = InferenceClient(token=HF_API_KEY)

class ChatRequest(BaseModel):
    # testing
    message: str = "I'm looking for a software engineer with experience in frontend tech like typescript and javascript."
    # we can add more hyper parameters here 
    temperature: float = 0.7

# Response models
class CandidateEvaluation(BaseModel):
    name: str
    fit_score: int
    evaluation_bullets: List[str]
    notable_github_projects: List[str]
    next_step: str
    github_link: str
    candidate_link: str

class ChatResponse(BaseModel):
    response: Optional[List[CandidateEvaluation]] = None
    raw_response: Optional[str] = None  # Fallback if JSON parsing fails

@router.post("/community", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        query_embedding = embedder.generate_embedding(request.message)

        # Search across ALL candidates' resumes AND GitHub portfolios
        matches = VectorStore.search_similar_resumes(
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.0
        )

        if not matches:
            return ChatResponse(response="No matching candidates found.")  

        enriched_candidates = []
        seen_students = set()  # Track students we've already processed
        
        for m in matches:
            sid = m.get("student_id")
            
            # Skip if we've already processed this student
            if sid in seen_students:
                continue
            seen_students.add(sid)
            
            # Get profile info
            profile_resp = supabase.table("profiles").select("*").eq("id", sid).execute()
            if not profile_resp.data:
                continue
                
            profile = profile_resp.data[0]
            
            # Get GitHub portfolio data for this student
            github_matches = VectorStore.search_github_repos(
                query_embedding=query_embedding,
                student_id=sid,
                top_k=3,  # Top 3 relevant projects per candidate
                threshold=0.0
            )
            
            # Format GitHub projects
            github_projects = []
            for gh in github_matches:
                repo_name = gh.get("repo_name", "Unknown")
                metadata = gh.get("metadata", {})
                language = metadata.get("language", "N/A")
                topics = metadata.get("topics", [])
                stars = metadata.get("stars", 0)
                text_snippet = gh.get("text", "")[:200]  # Short snippet
                
                github_projects.append({
                    "repo_name": repo_name,
                    "language": language,
                    "topics": topics,
                    "stars": stars,
                    "description": text_snippet,
                    "similarity": gh.get("similarity", 0.0)
                })
            
            enriched_candidates.append({
                "student_id": sid,
                "name": profile.get("name", "Unknown"),
                "skills": profile.get("skills", "N/A"),
                "github_username": profile.get("github_username", "N/A"),
                "resume_similarity": m.get("similarity", 0.0),
                "resume_excerpt": m.get("resume_text", "")[:600],
                "github_projects": github_projects
            })

        # Build enriched RAG context with GitHub data
        rag_context_parts = []
        for i, c in enumerate(enriched_candidates):
            github_username = c['github_username']
            github_url = f"https://github.com/{github_username}" if github_username != "N/A" else "N/A"
            
            candidate_info = [
                f"{i+1}. {c['name']} (@{github_username}) - Resume Match: {c['resume_similarity']:.3f}",
                f"GitHub Profile: {github_url}",
                f"Skills: {c['skills']}",
                f"Resume excerpt: {c['resume_excerpt']}"
            ]
            
            # Add GitHub projects if available
            if c['github_projects']:
                candidate_info.append("\nGitHub Projects:")
                for j, proj in enumerate(c['github_projects'][:3]):  # Top 3 projects
                    candidate_info.append(
                        f"  • {proj['repo_name']} ({proj['language']}) - {proj['stars']}⭐ "
                        f"[Match: {proj['similarity']:.2f}]\n"
                        f"    Topics: {', '.join(proj['topics'][:3])}\n"
                        f"    {proj['description']}"
                    )
            
            rag_context_parts.append("\n".join(candidate_info))
        
        rag_context = "\n\n---\n\n".join(rag_context_parts)

        SYSTEM_PROMPT = """
            You are a helpful professional recruiter assistant. The user will be giving you requirements such as job description, good to have experience etc. 

            Rank candidates based on their skills, resume experience, AND GitHub portfolio projects. Github projects that demonstrate relevant skills and experience should be weighted heavily in your evaluation and if it doesn't match the job requirement, it should not be penalised. 

            For each candidate provide:
            (1) Fit score (0-10) - consider both resume AND GitHub projects
            (2) 2-3 bullets tying their experience/projects/skills to the job requirements
                • [Bullet 1: Tie specific experience to job requirement]
                • [Bullet 2: Highlight relevant skills or projects]
                • [Bullet 3: Note any standout achievements]
            (3) Notable GitHub projects that demonstrate relevant skills
            (4) Recommended next step (interview/phone screen/reject)

            **Evaluation Framework:**

            1. **Primary Assessment (70% weight):**
            - Resume experience and skills
            - Years of experience
            - Previous roles and responsibilities
            - Resume match score indicates relevance

            2. **GitHub Portfolio (30% weight - BONUS EVIDENCE):**
            - Validates claimed skills with real code
            - Demonstrates active learning and contribution
            - Shows project complexity and quality
            - Low GitHub match scores should NOT penalize candidates
            - Missing GitHub data is neutral (not a negative)

            3. **Scoring Guidelines:**
            - 9-10: Perfect match with strong portfolio evidence
            - 7-8: Strong match with good portfolio or excellent resume alone
            - 5-6: Moderate match, some relevant experience
            - 3-4: Weak match, minimal relevant experience
            - 0-2: Poor match, not suitable


            Provide concise and relevant answers.
            Use bullet points or numbered lists for clarity.
            Always be professional and courteous.
            
            **Important:**
            - Be generous with candidates who have strong resumes but limited GitHub
            - GitHub projects are evidence of skill, not requirements
            - Focus on relevant experience matching job needs
            - Provide actionable interview suggestions
            - If the GitHub does not have any relevant projects, you do not need to mention it in the evaluation.

            **CRITICAL: You MUST return ONLY valid JSON. Do not include any explanatory text before or after the JSON.**

            Return in JSON format as follows:
            [
                {
                    "name": "Candidate Name",
                    "fit_score": 8, 
                    "evaluation_bullets": [
                        "• Bullet 1",
                        "• Bullet 2",
                        "• Bullet 3"
                    ],
                    "notable_github_projects": [
                        "Project 1: Description",
                        "Project 2: Description"
                    ],
                    "next_step": "Phone Screen",
                    "github_link": "https://github.com/username",
                    "candidate_link": ""
                }
            ]
            """
        
        USER_PROMPT = f"""
            Here are the candidates with their resumes and GitHub portfolios:

            {rag_context}

            Based on the candidates' skills, experience, and GitHub projects, rank them for the following job description and provide reasoning:

            \"\"\"{request.message}\"\"\"
            """
        
        print(USER_PROMPT)
        # i checked the similarity scores - the resume is pretty low but might be cuz of the prompt 
        
        completion = client.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": USER_PROMPT
                }
            ],
            model=MODEL_NAME,
            temperature=request.temperature
        )
        
        response_text = completion.choices[0].message.content
        
        # Parse JSON response
        try:
            parsed_json = format_response(response_text)
            # Validate and convert to Pydantic models
            candidates = [CandidateEvaluation(**candidate) for candidate in parsed_json]
            return ChatResponse(response=candidates)
        except Exception as parse_error:
            # If JSON parsing fails, return raw response as fallback
            print(f"JSON parsing error: {parse_error}")
            print(f"Raw response: {response_text}")
            return ChatResponse(raw_response=response_text)
    
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status_code=500, detail=f"An error occurred: {error_msg}")

class ChatHistoryRequest(BaseModel):
    messages: List[Dict[str, str]]  # Each dict: {"role": "user"/"assistant", "content": "..."}
    temperature: float = 0.7 

@router.post("/chat_with_history", response_model=ChatResponse)
def chat_with_history(request: ChatHistoryRequest) -> ChatResponse:
    """
    LLM call with conversation history (for multi-turn chats).
    
    Args:
        messages: List of {"role": "user"/"assistant", "content": "..."} dicts
        system_prompt: System context
        temperature: Creativity level
        model: LLM model to use
    
    Returns:
        ChatResponse: The LLM's response
    
    Example usage:
        {
        "messages": [
            { "role": "user", "content": "Tell me about candidate A. A has 3 years experience in python and some frontend skills on javascript but prefers to use typescript." },
            { "role": "assistant", "content": "Candidate A has experience in Python." },
            { "role": "user", "content": "What about their JavaScript skills?" },
            { "role": "user", "content": "What is the candidate name again?" }
        ],
        "temperature": 0.7
        }
    """
    try:
        completion = client.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant."
                },
                *request.messages  # unpack conversation history
            ],
            model=MODEL_NAME,
            temperature=request.temperature,
        )
        
        return ChatResponse(raw_response=completion.choices[0].message.content)   
     
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")
