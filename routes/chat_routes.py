from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from services.embedder import embedder
from services.vector_store import VectorStore
from services.supabase_client import supabase
from utils.json_parser import format_response
from services.github.github_analysis import GitHubAnalysisService  
from services.rag_factory import RAGFactory
from config.feature_flags import feature_flags
import os

load_dotenv()

router = APIRouter()

HF_API_KEY = os.getenv("HF_API_KEY")
# api key need to tick the 2 read access under repo and make calls to inference providers
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324" # i randomly piak a model, feel free to change and play around 

client = InferenceClient(token=HF_API_KEY)
github_analyzer = GitHubAnalysisService()  

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
    student_id: Optional[str] = None  # Add student_id for frontend tracking

class ChatResponse(BaseModel):
    response: Optional[List[CandidateEvaluation]] = None
    raw_response: Optional[str] = None  # Fallback if JSON parsing fails

@router.post("/community", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        query_embedding = embedder.generate_embedding(request.message)
        # TODO: possibly add more stuff from the original resume(?) since they are in chunks 
        if feature_flags.ENABLE_CUSTOM_RAG or feature_flags.ENABLE_GRAPH_RAG:
            rag_factory = RAGFactory()
            matches = rag_factory.search_candidates(
                query_text=request.message,
                top_k=10,
                filters=None
            )
            print(f"RAG matches found: {matches}")
        else:   
            # fallback to the original way if nothing is enabled - no chunking of resumes 
            query_embedding = embedder.generate_embedding(request.message)

            # Search across ALL candidates' resumes 
            matches = VectorStore.search_similar_resumes(
                query_embedding=query_embedding,
                top_k=5,
                threshold=0.1
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
            github_username = profile.get("github_username", "N/A")
            
            # Format GitHub projects with deep analysis
            github_projects = []
            portfolio_summary = None
            
            # TODO: check why it is going into this loop even when no github 
            # Get portfolio-level analysis if GitHub username exists
            if github_username != "N/A" or github_username != None and sid:
                try:
                    if not query_embedding:
                        query_embedding = embedder.generate_embedding(request.message)

                    # Get GitHub portfolio data for this student
                    github_matches = VectorStore.search_github_repos(
                        query_embedding=query_embedding,
                        student_id=sid,
                        top_k=3,  # Top 3 relevant projects per candidate
                        threshold=0.0
                    )
                    # Use comprehensive analysis method with "quick" type
                    portfolio_summary = github_analyzer.analyze_portfolio_comprehensive(
                        student_id=sid,
                        github_username=github_username,
                        analysis_type="quick"
                    )
                    
                    # Check if analysis returned an error
                    if portfolio_summary.get("error"):
                        print(f"Portfolio analysis error for {github_username}: {portfolio_summary['error']}")
                        portfolio_summary = None
                        
                except Exception as analysis_error:
                    print(f"Portfolio analysis error for {github_username}: {analysis_error}")
                    portfolio_summary = None
            
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
                "github_username": github_username,
                "resume_similarity": m.get("similarity", 0.0),
                "resume_excerpt": m.get("resume_text", ""),
                "github_projects": github_projects,
                "portfolio_summary": portfolio_summary  # Add portfolio overview
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
            
            # Add portfolio summary if available
            if c.get('portfolio_summary'):
                ps = c['portfolio_summary']
                candidate_info.append("\n📊 GitHub Portfolio Overview:")
                
                # Quick summary
                if ps.get('quick_summary'):
                    candidate_info.append(f"  Summary: {ps.get('quick_summary')}")
                
                # Technical identity
                if ps.get('technical_identity'):
                    candidate_info.append(f"  Technical Identity: {ps.get('technical_identity')}")
                
                # Key skills
                if ps.get('key_skills'):
                    candidate_info.append(f"  Key Skills: {', '.join(ps['key_skills'])}")
                
                # Standout projects
                if ps.get('standout_projects'):
                    candidate_info.append(f"  Standout Projects: {', '.join(ps['standout_projects'])}")
                
                # Job readiness
                if ps.get('job_readiness'):
                    readiness_emoji = "✅" if ps['job_readiness'] == "ready" else "🔄" if ps['job_readiness'] == "nearly_ready" else "⚠️"
                    candidate_info.append(f"  Job Readiness: {readiness_emoji} {ps['job_readiness'].replace('_', ' ').title()}")
            
            
            # Add GitHub projects if available
            if c['github_projects']:
                candidate_info.append("\n🔍 Top Relevant Projects:")
                for j, proj in enumerate(c['github_projects'][:3]):  # Top 3 projects
                    candidate_info.append(
                        f"  • {proj['repo_name']} ({proj['language']}) - {proj['stars']}⭐ "
                        f"[Match: {proj['similarity']:.2f}]"
                    )
                    candidate_info.append(f"    Topics: {', '.join(proj['topics'][:3])}")
                    candidate_info.append(f"    {proj['description'][:200]}")
            
            rag_context_parts.append("\n".join(candidate_info))
        
        rag_context = "\n\n---\n\n".join(rag_context_parts)

        SYSTEM_PROMPT = """
            You are a helpful professional recruiter assistant. The user will be giving you requirements such as job description, good to have experience etc. 

            Rank candidates based on their skills, resume experience, AND GitHub portfolio projects. Github projects that demonstrate relevant skills and experience should be weighted heavily in your evaluation and if it doesn't match the job requirement, it should not be penalised. 

            For each candidate provide:
            (1) Fit score (0-10) - consider both resume AND GitHub projects with portfolio analysis
            (2) 3 bullets tying their experience/projects/skills to the job requirements
                • [Bullet 1: Tie specific experience to job requirement and provide evidence from the resume to support your claim]
                • [Bullet 2: Highlight relevant skills or projects with technical evidence]
                • [Bullet 3: Note any standout achievements or portfolio insights]
            (3) Notable GitHub projects that demonstrate relevant skills (use project analysis data)
            (4) Recommended next step (interview/phone screen/reject)

            **Evaluation Framework:**

            1. **Primary Assessment (70% weight):**
            - Resume experience and skills
            - Years of experience
            - Previous roles and responsibilities
            - Resume match score indicates relevance

            2. **GitHub Portfolio (30% weight - BONUS EVIDENCE):**
            - Portfolio overview (total repos, stars, active days, language diversity)
            - Project-specific analysis (key skills, technical highlights)
            - Validates claimed skills with real code
            - Demonstrates active learning and contribution
            - Shows project complexity and quality
            - Low GitHub match scores should NOT penalize candidates
            - Missing GitHub data is neutral (not a negative)

            3. **Scoring Guidelines:**
            - 9-10: Perfect match with strong portfolio evidence and technical depth
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
            - Use portfolio summaries to understand overall technical breadth
            - Reference specific project analyses in your evaluation bullets
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
            
            # Create name to student_id mapping from enriched_candidates
            name_to_student_id = {c["name"]: c["student_id"] for c in enriched_candidates}
            
            # Inject student_id into each candidate based on name matching
            for candidate_data in parsed_json:
                candidate_name = candidate_data.get("name", "")
                candidate_data["student_id"] = name_to_student_id.get(candidate_name, None)
            
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
    student_id: Optional[str] = None  # Optional student ID for context-aware chat

@router.post("/chat_with_history", response_model=ChatResponse)
def chat_with_history(request: ChatHistoryRequest) -> ChatResponse:
    """
    LLM call with conversation history (for multi-turn chats).
    If student_id is provided, enriches the system prompt with student's resume and GitHub context.

    Args:
        messages: List of {"role": "user"/"assistant", "content": "..."} dicts
        temperature: Creativity level
        student_id: Optional student ID for context-aware responses

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
        "temperature": 0.7,
        "student_id": "123e4567-e89b-12d3-a456-426614174000"
        }
    """
    try:
        system_prompt = "You are a helpful assistant."
        
        # If student_id provided, enrich with student context
        if request.student_id:
            try:
                # Get student profile
                profile_response = supabase.table("profiles").select("*").eq("id", request.student_id).single().execute()
                
                if profile_response.data:
                    student_profile = profile_response.data
                    student_name = student_profile.get("name", "this candidate")
                    skills = student_profile.get("skills", "various skills")
                    github_username = student_profile.get("github_username", "N/A")
                    
                    # Get the last user message to use as query for relevant context
                    last_user_message = None
                    for msg in reversed(request.messages):
                        if msg.get("role") == "user":
                            last_user_message = msg.get("content", "")
                            break
                    
                    context_parts = []
                    
                    if last_user_message:
                        # Generate embedding for the question
                        query_embedding = embedder.generate_embedding(last_user_message)
                        
                        # Search unified portfolio for relevant information
                        relevant_chunks = VectorStore.search_unified_portfolio(
                            query_embedding=query_embedding,
                            student_id=request.student_id,
                            top_k=5,
                            threshold=0.0
                        )
                        
                        # Build context from relevant chunks
                        for chunk in relevant_chunks:
                            source = chunk.get("source", "")
                            if source == "resume":
                                text = chunk.get("resume_text", "")
                                context_parts.append(f"From Resume:\n{text}")
                            elif source == "github":
                                repo_name = chunk.get("repo_name", "")
                                text = chunk.get("text", "")
                                metadata = chunk.get("metadata", {})
                                language = metadata.get("language", "N/A")
                                topics = metadata.get("topics", [])
                                stars = metadata.get("stars", 0)
                                topics_str = ", ".join(topics[:3]) if topics else "N/A"
                                context_parts.append(
                                    f"From GitHub Project '{repo_name}':\n"
                                    f"  Language: {language} | Topics: {topics_str} | Stars: {stars}⭐\n"
                                    f"  {text}"
                                )
                    
                    context = "\n\n".join(context_parts) if context_parts else "No specific context found for this query."
                    
                    # Build enriched system prompt
                    github_info = f"GitHub: @{github_username}" if github_username != "N/A" else "No GitHub profile"
                    
                    system_prompt = f"""You are a helpful professional recruiter assistant helping to learn more about {student_name}.

**Candidate Profile:**
- Name: {student_name}
- Skills: {skills}
- {github_info}

**Relevant Information:**
{context}

**Instructions:**
- Answer questions about this candidate based on their resume and GitHub portfolio
- Be specific and reference actual projects, skills, and experiences from the provided context
- Use **bold** for emphasis on key points and skills
- Use bullet points (•) for listing items clearly
- Maintain proper line spacing for readability
- If information is not in the context, politely say you don't have that specific information
- Be professional and highlight the candidate's strengths

**Conversation History Context:**
{chr(10).join([f"{'Candidate Info' if msg['role'] == 'assistant' else 'Recruiter'}: {msg['content'][:200]}..." for msg in request.messages[-4:]]) if len(request.messages) > 0 else 'This is the start of the conversation.'}
"""
                else:
                    print(f"[chat_with_history] Student profile not found for ID: {request.student_id}")
            except Exception as e:
                print(f"[chat_with_history] Error fetching student context: {str(e)}")
                # Continue with default system prompt if context fetch fails
        
        completion = client.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                *request.messages  # unpack conversation history
            ],
            model=MODEL_NAME,
            temperature=request.temperature,
        )
        
        return ChatResponse(raw_response=completion.choices[0].message.content)   
     
    except Exception as e:
        error_msg = str(e)
        print(f"[chat_with_history] ERROR occurred:")
        print(f"  Error type: {type(e).__name__}")
        print(f"  Error message: {error_msg}")
        print(f"  Student ID: {request.student_id if request.student_id else 'None'}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"LLM error: {error_msg}")
