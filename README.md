# IS469_G2_Group4

> Your portfolio just got an upgrade: meet your 24/7 AI assistant! 

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
  - [For Recruiters](#for-recruiters)
  - [For Students](#for-students)
- [Quick Start](#-quick-start)
- [System Architecture](#-system-architecture)
---

## 🌟 Overview

A comprehensive AI-powered recruitment platform that streamlines the hiring process for recruiters while helping students showcase their skills effectively. The system leverages advanced AI technologies including RAG, LLMs, MCP, embeddings, and computer vision to provide intelligent matching, automated analysis, and personalized assistance for both recruiters and candidates.

---

## 🚀 Key Features

### **For Recruiters**

#### 🤖 **Community Chatbot**
- AI-powered conversational interface for candidate discovery
- Natural language job requirements → Intelligent candidate matching
- Multiple search strategies:
  - **Rule-Based**: Fast, predictable pipeline (3-5s response)
  - **Agentic**: Adaptive AI agents that reason and iterate (8-12s response)
- Powered by RAG (Custom & GraphRAG) with semantic search

#### 📊 **Intelligent Candidate Ranking**
- **Top-K Recommendations**: Get the best-fit candidates ranked by relevance
- **Dual Matching Strategies**:
  - **Embedding-Based**: Semantic similarity using vector search (pgvector)
  - **Keyword Matching**: Traditional skills and tech stack matching
- **Smart Scoring**: AI evaluates resume, cover letter, projects, and experience
- **Detailed Insights**: See why each candidate is recommended

#### 💬 **Candidate-Specific Chatbots**
- Click into any candidate to start a personalized conversation
- Ask detailed questions about their experience, projects, and skills
- RAG retrieves relevant information from candidate's full profile
- Get AI-generated summaries of qualifications
- Understand technical depth and project complexity

#### 📅 **Interview Scheduling (MCP Integration)**
- Schedule interviews directly from candidate profiles
- Automated email management using Model Context Protocol (MCP)
- Send meeting invitations to selected applicants
- Track interview scheduling status

---

### **For Students**

#### 📄 **Resume & Cover Letter Chatbot**
- **Upload & Get Feedback**: Upload your resume for AI-powered analysis
- **Improvement Suggestions**: Get actionable recommendations to enhance your resume
- **Job-Specific Targeting**: Select up to 5 companies/job roles you're interested in
- **Tailored Advice**: Receive customized tips based on target positions
- **Cover Letter Assistance**: Get help crafting compelling cover letters

#### 🤖 **Digital Twin Chatbot**
- **Your AI Representative**: A chatbot that acts as your digital twin
- **Automatic Claim Backup**: Answers tough questions about your projects and experience
- **Proof-Based Responses**: Automatically references your GitHub repos, commits, and project details
- **24/7 Availability**: Responds to recruiter inquiries even when you're offline
- **Smart Context**: Understands your full profile and provides accurate, detailed answers

#### 📝 **Personal Information Management**
- **Profile Creation**: Store comprehensive professional information
  - Name, contact details, education background
  - Skills, certifications, work experience
  - Project portfolio and achievements
- **Data Persistence**: Securely stored in Supabase database
- **Easy Updates**: Keep your profile current with simple form updates

#### 🎥 **Video Personality Analysis** (For Marketing Students)
- **CNN-Based Analysis**: Process video submissions using deep learning
- **Big Five Personality Traits**: Evaluate Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- **Visual Insights**: Interactive personality charts and scores
- **Recruiter Visibility**: Share personality profiles with potential employers
- **Marketing Focus**: Tailored for marketing roles that value personality fit

#### � **GitHub Assistant** (For Computing Students)
- **Two Connection Methods**:
  - Direct GitHub account integration
  - Username-based public profile analysis
- **Overall Portfolio Analysis**:
  - Total commits, repos, languages used
  - Contribution patterns and activity levels
  - Top technologies and frameworks
- **Deep Dive into Repositories**:
  - Individual repo analysis with detailed insights
  - Code quality assessment
  - Project complexity evaluation
  - Technology stack identification
  - Identify potential interview questions
- **Automated Enrichment**: Automatically fetches and analyzes GitHub data
- **Digital Twin Integration**: GitHub insights power your chatbot responses

---

## 🛠️ Technology Stack

### **Frontend**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **React Hooks** - State management

### **Backend**
- **FastAPI** - Modern async Python web framework
- **Python 3.11+** - Core language
- **Pydantic** - Data validation

### **AI/ML**
- **Large Language Models**:
  - DeepSeek-V3 (671B params) - Advanced reasoning
  - Llama3.2:1B - Local, cost-effective inference
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **LlamaIndex** - RAG framework
- **GraphRAG** - Knowledge graph-based retrieval
- **Computer Vision**: CNN models for video personality analysis

### **Database & Storage**
- **Supabase** - PostgreSQL with real-time subscriptions
- **pgvector** - Vector similarity search for embeddings
- **JSON Storage** - Local data persistence

### **Integrations**
- **GitHub API** - Portfolio analysis and repo data
- **Gmail API / SendGrid** - Email automation
- **Model Context Protocol (MCP)** - Interview scheduling
- **Ollama** - Local LLM inference

### **Development Tools**
- **uvicorn** - ASGI server
- **python-dotenv** - Environment management
- **pytest** - Testing framework

---

## ⚡ Quick Start

### **Prerequisites**

1. **Python 3.11+**
   ```bash
   python --version  # Should be 3.11 or higher
   ```

2. **Ollama** (for Llama router)
   ```bash
   # macOS
   brew install ollama
   
   # Start Ollama
   ollama serve
   
   # Pull model
   ollama pull llama3.2:1b
   ```

3. **API Keys**
   - HuggingFace API Key (for DeepSeek-V3)
   - Supabase URL and Key

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/brendankhow/IS469_G2_Group4.git
   cd IS469_G2_Group4
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   
   Create `.env` file:
   ```env
   # HuggingFace (for DeepSeek-V3 router)
   HF_API_KEY=your_huggingface_api_token
   
   # Supabase (PostgreSQL + pgvector)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_supabase_service_key

   GITHUB_ACCESS_TOKEN=your_github_token

   COHERE_API_KEY=your_cohere_token
   ```

4. **Start the server**
   ```bash
   fastapi run main.py
   # Server runs at http://127.0.0.1:8000
   ```

5. **Access API documentation**
   ```
   http://127.0.0.1:8000/docs
   ```

### **Quick Test Examples**

```bash
# Recruiter: Search for candidates
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Looking for a React developer with 3+ years experience"}'

# Recruiter: Get candidate ranking
curl -X POST http://127.0.0.1:8000/chat/rank \
  -H "Content-Type: application/json" \
  -d '{"job_description": "Senior Python Developer", "top_k": 5}'

# Student: Analyze GitHub profile
curl -X POST http://127.0.0.1:8000/github/analyze \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'

# Student: Process personality video
curl -X POST http://127.0.0.1:8000/personality/analyze \
  -F "video=@interview.mp4" \
  -F "student_id=123"

# Student: Parse resume
curl -X POST http://127.0.0.1:8000/resume/parse \
  -F "file=@resume.pdf"

# Schedule interview
curl -X POST http://127.0.0.1:8000/schedule/interview \
  -H "Content-Type: application/json" \
  -d '{"candidate_id": "123", "date": "2025-11-15", "time": "14:00"}'
```

---

## 🔧 System Architecture

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECRUITMENT PLATFORM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌─────────────────────────┐  │
│  │   RECRUITER SIDE     │         │    STUDENT SIDE         │  │
│  ├──────────────────────┤         ├─────────────────────────┤  │
│  │ • Community Chatbot  │         │ • Resume Chatbot        │  │
│  │ • Candidate Ranking  │         │ • Digital Twin Bot      │  │
│  │ • Specific Chatbots  │         │ • Profile Management    │  │
│  │ • Interview Scheduler│         |                         |
│  └──────────┬───────────┘         │ • Video Analysis        │  │
│             │                     │ • GitHub Assistant      │  │
│             │                     └────────┬────────────────┘  │
│             │                              │                    │
│             └──────────┬───────────────────┘                    │
│                        ▼                                         │
│         ┌──────────────────────────────┐                        │
│         │   CORE AI SERVICES           │                        │
│         ├──────────────────────────────┤                        │
│         │ • RAG (Custom + GraphRAG)    │                        │
│         │ • Vector Search (pgvector)   │                        │
│         │ • LLM Services (DeepSeek)    │                        │
│         │ • Embedding Service          │                        │
│         │ • GitHub API Integration     │                        │
│         │ • CNN Video Analysis         │                        │
│         │ • Email Service (Gmail)      │                        │
│         │ • MCP Scheduler              │                        │
│         └──────────────┬───────────────┘                        │
│                        ▼                                         │
│         ┌──────────────────────────────┐                        │
│         │   DATA LAYER                 │                        │
│         ├──────────────────────────────┤                        │
│         │ • Supabase (PostgreSQL)      │                        │
│         │ • Vector Store (pgvector)    │                        │
│         │ • User Profiles              │                        │
│         │ • Applications               │                        │
│         │ • Job Listings               │                        │
│         └──────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### **Directory Structure**

```
IS469_G2_Group4/
├── main.py                          # FastAPI application entry point
├── requirements.txt                 # Python dependencies
├── .env                            # Environment variables
│
├── frontend/                       # Next.js frontend
│   ├── app/                       # App router pages
│   │   ├── recruiter/            # Recruiter dashboard
│   │   ├── student/              # Student dashboard
│   │   ├── login/                # Authentication
│   │   └── api/                  # API routes
│   ├── components/               # Reusable UI components
│   │   ├── interview-scheduler.tsx
│   │   ├── pdf-viewer-modal.tsx
│   │   ├── personality-chart.tsx
│   │   ├── video-recorder.tsx
│   │   └── ui/                  # shadcn components
│   └── lib/                      # Frontend utilities
│       ├── ai-service.ts
│       ├── auth.ts
│       └── services/
│
├── routes/                         # Backend API endpoints
│   ├── chat_routes.py             # Community chatbot
│   ├── chat_routes_agentic.py     # Advanced agentic search
│   ├── resume_routes.py           # Resume parsing & feedback
│   ├── github_routes.py           # GitHub analysis
│   ├── personality_routes.py      # Video personality analysis
│   ├── schedule_routes.py         # Interview scheduling (MCP)
│   ├── student_routes.py          # Student profile management
│   └── evaluation_routes.py       # System evaluation
│
├── services/                       # Business logic
│   ├── customrag_service.py       # Custom RAG implementation
│   ├── graphrag_service.py        # GraphRAG implementation
│   ├── vector_store.py            # Vector similarity search
│   ├── embedder.py                # Text embeddings
│   ├── llm_client.py              # LLM interface
│   ├── resume_parser.py           # Resume processing
│   ├── personality_service.py     # Big Five analysis
│   ├── cover_letter_service.py    # Cover letter generation
│   ├── email_service.py           # Email automation
│   ├── supabase_client.py         # Database client
│   ├── github/                    # GitHub integration
│   │   └── github_analysis.py    # Portfolio analysis
│   └── agents/                    # Agentic architecture
│       ├── agentic_orchestrator.py
│       ├── llm_routers/          # AI routing strategies
│       └── tools/                # Agent tools
│
├── config/                         # Configuration
│   └── feature_flags.py           # Feature toggles
│
└── utils/                          # Utilities
    ├── timer.py                   # Performance timing
    └── json_parser.py             # JSON utilities
```

### **Key Components**

#### **1. RAG Systems**
- **Custom RAG**: Traditional retrieval-augmented generation
- **GraphRAG**: Knowledge graph-based retrieval for complex queries
- **Vector Store**: pgvector for semantic similarity search
- Powers community chatbot and candidate-specific chatbots

#### **2. Resume & Cover Letter Engine**
- **Parser**: Extracts structured data from PDF/DOCX resumes
- **Feedback System**: AI-powered resume improvement suggestions
- **Cover Letter Generator**: Tailored cover letters based on job descriptions
- **Email Integration**: Auto-send applications to recruiters

#### **3. GitHub Assistant**
- **Profile Analysis**: Overall activity, languages, contribution patterns
- **Repository Deep Dive**: Individual repo analysis with complexity scoring
- **Technology Detection**: Identifies frameworks, libraries, tools used
- **Digital Twin Integration**: Powers chatbot responses with real project data

#### **4. Personality Analysis**
- **CNN Model**: Processes video submissions
- **Big Five Traits**: Extracts personality dimensions
- **Visualization**: Interactive charts and scores
- **Marketing Focus**: Tailored for roles requiring personality insights

#### **5. Interview Scheduler**
- **MCP Integration**: Model Context Protocol to email
- **Automated Invites**: Send meeting requests to candidates
- **Status Tracking**: Monitor scheduling progress
- **Recruiter Dashboard**: Manage all interviews in one place

#### **6. Intelligent Matching**
- **Embedding-Based**: Semantic similarity using sentence transformers
- **Keyword Matching**: Traditional skills-based matching
- **Hybrid Ranking**: Combines multiple signals for best results
- **LLM Scoring**: AI evaluates candidate-job fit (0-10 scale)

#### **7. Personal AI Assistant**
- On the go 24/7 assistant that acts as your **digital twin**
- Automatically back up your claims based on your resume, github and personality

---


### **Interactive Documentation**
Full API documentation with request/response schemas available at:
```
http://127.0.0.1:8000/docs
```

---

## Advanced Features

### **AI Architecture Options**

Our platform supports multiple AI search strategies to balance speed, cost, and quality:

#### **Rule-Based Search** (Default)
- Fixed pipeline: Search → Enrich → Analyze → Rank
- ⚡ Fast (3-5 seconds)
- 💰 Cost-effective (~$0.002 per query)
- ✅ Consistent and predictable

#### **Agentic Search** (Advanced)
- AI agents autonomously decide which tools to use
- 🤖 Adaptive to complex queries
- 🧠 Reasons through multi-step problems
- 🔄 Iterates until success criteria met
- Choose between:
  - **DeepSeek-V3** (671B params) - Highest quality
  - **Llama3.2:1B** (local) - Free, cost-effective

### **RAG Technologies**

#### **Custom RAG**
- Traditional retrieval-augmented generation
- Vector similarity search with pgvector
- Optimized for candidate profiles and resumes
- Fast retrieval with semantic understanding

#### **GraphRAG**
- Knowledge graph-based retrieval
- Better for complex multi-hop queries
- Understands relationships between entities
- Ideal for deep technical questions

### **Evaluation & Comparison Tools**

```bash
# Compare search architectures
./export_all_evaluation.sh

# Compare AI routers
./export_router_comparison.sh

# View metrics
curl http://127.0.0.1:8000/evaluation/stats
```

**Metrics Tracked:**
- Performance (speed, cost, LLM calls)
- Quality (candidate fit scores, relevance)
- Success rate (goal achievement)

---

## Development Guide

### **Running in Development**

```bash
# Backend (FastAPI)
python -m uvicorn main:app --reload

# Frontend (Next.js)
cd frontend
npm run dev
```



