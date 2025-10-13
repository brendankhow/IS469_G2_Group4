# IS469_G2_Group4

## Python backend — Quick start


Install Python requirements:

```bash
pip install -r requirements.txt
```

Environment variables

Create a `.env` file in the project root

```
HF_API_KEY=your_huggingface_api_token
SUPABASE_URL=https://your-supabase-project-url
SUPABASE_KEY=your-supabase-service-key
```


Spin up the backend

```bash
fastapi run main.py 
#or 
python main.py
```



Endpoints
- GET / — simple health/info endpoint
- POST /chat — chat endpoint that proxies to the Hugging Face Inference API 
    - test it out by putting in your prompt and press execute 
- GET /profiles — Supabase helper that reads from the `profiles` table

Documentation - http://0.0.0.0:8000/docs

