from huggingface_hub import InferenceClient # this is the inference, there's another type - local model if we wanna run locally 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
import os 

load_dotenv()  

app = FastAPI()

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)