from huggingface_hub import InferenceClient # this is the inference, there's another type - local model if we wanna run locally 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from services.supabase_client import supabase
from services.llm_client import llm_client
from fastapi.middleware.cors import CORSMiddleware
from routes.resume_routes import router as resume_router
from routes.chat_routes import router as chat_router
from routes.chat_routes_agentic import router as chat_agentic_router
from routes.chat_routes_comparison import router as chat_comparison_router
from routes.github_routes import router as github_router
from routes.student_routes import router as student_router
from routes.graphrag_routes import router as graphrag_router
from routes.personality_routes import router as personality_router
from routes.customrag_routes import router as customrag_router
from routes.evaluation_routes import router as evaluation_router

import uvicorn
import os 

load_dotenv()  

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_API_KEY = os.getenv("HF_API_KEY")
# api key need to tick the 2 read access under repo and make calls to inference providers
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324" # i randomly piak a model, feel free to change and play around 
client = InferenceClient(token=HF_API_KEY)

class ChatRequest(BaseModel):
    message: str = "hi"
    # we can add more hyper parameters here 
    temperature: float = 0.7

class ChatResponse(BaseModel):
    response: str
    
@app.get("/")
def read_root():
    return {
        "message": "FastAPI LLM Server is running!",
        "model": MODEL_NAME,
        "type": "huggingface_api"
    }

# chat routes
app.include_router(chat_router, prefix="/chat", tags=["Chat Helper"])
app.include_router(chat_agentic_router, prefix="/chat/community", tags=["Chat Agentic"])
app.include_router(chat_comparison_router, prefix="/chat", tags=["Architecture Comparison"])

# evaluation routes
app.include_router(evaluation_router, prefix="/evaluation", tags=["Evaluation"])

# resume routes
app.include_router(resume_router, prefix="/resume", tags=["Resume Helper"])

# github routes
app.include_router(github_router, prefix="/github", tags=["GitHub Helper"])

# student routes
app.include_router(student_router, prefix="/student", tags=["Student Helper"])

# graphrag route
app.include_router(graphrag_router, prefix="/recruiter", tags=["Recruiter GraphRag Helper"])

# personality routes
app.include_router(personality_router, prefix="/personality", tags=["Personality Analysis"])

# customrag route
app.include_router(customrag_router, prefix="/recruiter", tags=["Recruiter CustomRag Helper"])



@app.get("/profiles", tags=["Supabase Helper"])
def get_profiles():
    response = (
        supabase.table("profiles")
        .select("*")
        .execute()
    )    
    return response.data
    
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)