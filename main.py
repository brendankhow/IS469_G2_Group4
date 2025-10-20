from huggingface_hub import InferenceClient # this is the inference, there's another type - local model if we wanna run locally 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from services.supabase_client import supabase
from fastapi.middleware.cors import CORSMiddleware
from routes.resume_routes import router as resume_router
from routes.student_routes import router as student_router
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

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant."  # modify this to fit our use case 
                },
                {
                    "role": "user",
                    "content": request.message
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

# resume routes
app.include_router(resume_router, prefix="/resume", tags=["Resume Helper"])
app.include_router(student_router, prefix="/student", tags=["Student Helper"])
    
@app.get("/profiles", tags=["Supabase Helper"])
def get_profiles():
    response = (
        supabase.table("profiles")
        .select("*")
        .execute()
    )    
    return response.data
    
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)