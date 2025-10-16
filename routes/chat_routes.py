from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore
from services.supabase_client import supabase
import os

load_dotenv()

router = APIRouter()
embedder = EmbeddingService()

HF_API_KEY = os.getenv("HF_API_KEY")
# api key need to tick the 2 read access under repo and make calls to inference providers
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324" # i randomly piak a model, feel free to change and play around 

client = InferenceClient(token=HF_API_KEY)

class ChatRequest(BaseModel):
    # testing
    message: str = "I'm looking for a software engineer with experience in python and javascript."
    # we can add more hyper parameters here 
    temperature: float = 0.7

class ChatResponse(BaseModel):
    response: str

@router.post("/community", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        query_embedding = embedder.generate_embedding(request.message)

        # TODO: replace with the actual RAG later
        matches = VectorStore.search_similar_resumes(
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.0
        )

        if not matches:
            return ChatResponse(response="No matching candidates found.")  

        enriched_candidates = []
        for m in matches:
            sid = m.get("student_id")
            profile_resp = supabase.table("profiles").select("*").eq("id", sid).execute()
            if profile_resp.data:
                profile = profile_resp.data[0]
                enriched_candidates.append({
                    "student_id": sid,
                    "name": profile.get("name", "Unknown"),
                    "skills": profile.get("skills", "N/A"),
                    "similarity": m.get("similarity", 0.0),
                    "resume_excerpt": m.get("resume_text", "")[:600]  # short excerpt
                }) 

        rag_context = "\n\n".join(
            f"{i+1}. {c['name']} (similarity: {c['similarity']:.3f})\n"
            f"Skills: {c['skills']}\n"
            f"Resume excerpt: {c['resume_excerpt']}"
            for i, c in enumerate(enriched_candidates)
        )

        # TODO: check if return in json instead of str would be better 
        SYSTEM_PROMPT = f"""
            You are a helpful professional recruiter assistant. The user will be giving you requirements such as job description, good to have experience etc. Rank candidates based on their skills, projects and experience.
            For each candidate give: 
            (1) fit score (0-10)
            (2) 2 bullets tying experience/projects/skills to the job
            (3) recommended next step (interview/phone screen/reject)
            Provide concise and relevant answers.
            Use bullet points or numbered lists for clarity.
            Always be professional and courteous.
            """
        
        USER_PROMPT = f"""
            Here are the candidates:\n\n{rag_context}\n\n
            Based on the candidates' skills and experience, rank them for the following job description and provide reasoning for this user query:
            \"\"\"{request.message}\"\"\"
            """
        
        completion = client.chat.completions.create(
            model=MODEL_NAME,
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
            # add hyper parameters here
            temperature=request.temperature
        )
        
        response_text = completion.choices[0].message.content
        
        return ChatResponse(response=response_text)
    
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status_code=500, detail=f"An error occurred: {error_msg}")
