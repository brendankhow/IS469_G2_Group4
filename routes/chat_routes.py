from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
import os

load_dotenv()

router = APIRouter()

HF_API_KEY = os.getenv("HF_API_KEY")
# api key need to tick the 2 read access under repo and make calls to inference providers
MODEL_NAME = "deepseek-ai/DeepSeek-V3-0324" # i randomly piak a model, feel free to change and play around 

client = InferenceClient(token=HF_API_KEY)

class ChatRequest(BaseModel):
    # testing
    message: str = "I'm looking for a software engineer with experience in python. Here are the candidates: Candidate A: 5 years experience in Java, C++. Candidate B: 3 years experience in Python, Django. Candidate C: 4 years experience in JavaScript, React."
    # we can add more hyper parameters here 
    temperature: float = 0.7

class ChatResponse(BaseModel):
    response: str

@router.post("/community", response_model=ChatResponse)
def chat(request: ChatRequest):
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
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
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
