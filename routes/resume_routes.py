from fastapi import APIRouter, HTTPException, Form
from typing import List
from pydantic import BaseModel
from services.resume_parser import ResumeParser
from services.embedder import embedder
from services.vector_store import VectorStore
from services.supabase_client import supabase
from services.cover_letter_service import coverLetterService
import tempfile
import os
import requests

router = APIRouter()

parser = ResumeParser()

@router.post("/process")
async def process_resume(student_id: str = Form(...)):
    """
    Process resume for a student by fetching their resume_url from profiles table
    Downloads PDF, extracts text, generates embeddings, stores in pgvector
    """
    temp_path = None
    
    try:
        # Fetch resume_url from profiles table
        print(f"Fetching resume URL for student: {student_id}")
        profile_response = supabase.table("profiles")\
            .select("resume_url")\
            .eq("id", student_id)\
            .execute()
        
        if not profile_response.data or len(profile_response.data) == 0:
            raise HTTPException(status_code=404, detail="Student profile not found")
        
        resume_url = profile_response.data[0].get("resume_url")
        
        if not resume_url:
            raise HTTPException(status_code=400, detail="No resume uploaded for this student")
        
        print(f"Found resume URL: {resume_url}")
        
        # Download PDF from Supabase Storage URL
        print(f"Downloading resume...")
        response = requests.get(resume_url, timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"Could not download resume. Status: {response.status_code}"
            )
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(response.content)
            temp_path = temp_file.name
        
        print(f"Downloaded to temp file")
        
        # Extract text from PDF
        print("Extracting text from PDF...")
        resume_text = parser.extract_text_from_pdf(temp_path)
        resume_text = parser.clean_text(resume_text)
        
        if not resume_text or len(resume_text) < 50:
            raise HTTPException(
                status_code=400, 
                detail="Could not extract meaningful text from PDF. Make sure it's a text-based PDF, not a scanned image."
            )
        
        print(f"Extracted {len(resume_text)} characters")
        
        # Generate embedding
        print("Generating embedding...")
        embedding = embedder.generate_embedding(resume_text)
        print(f"Generated embedding with {len(embedding)} dimensions")
        
        # Check if resume already exists for this student
        existing = VectorStore.get_resume_by_student_id(student_id)
        
        # Store or update in vector database
        print("Storing in database...")
        filename = resume_url.split('/')[-1]
        
        if existing:
            print("Updating existing resume embedding...")
            result = VectorStore.update_resume_embedding(
                student_id=student_id,
                resume_text=resume_text,
                embedding=embedding,
                filename=filename,
                metadata={"resume_url": resume_url}
            )
        else:
            print("Creating new resume embedding...")
            result = VectorStore.store_resume_embedding(
                student_id=student_id,
                resume_text=resume_text,
                embedding=embedding,
                filename=filename,
                metadata={"resume_url": resume_url}
            )
        
        print(f"Successfully processed resume for student {student_id}")
        
        return {
            "success": True,
            "message": "Resume processed and vectorized successfully",
            "embedding_id": result["id"],
            "student_id": student_id,
            "text_length": len(resume_text),
            "embedding_dimension": len(embedding),
            "action": "updated" if existing else "created"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing resume: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

@router.get("/student/{student_id}")
async def get_student_resume(student_id: str):
    """Get resume embedding and data for a specific student"""
    try:
        result = VectorStore.get_resume_by_student_id(student_id)
        if not result:
            raise HTTPException(status_code=404, detail="Resume not found for this student")
        
        # Add profile data
        profile = supabase.table("profiles")\
            .select("*")\
            .eq("id", student_id)\
            .execute()
        
        if profile.data:
            result["profile"] = profile.data[0]
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/student/{student_id}")
async def delete_student_resume_embeddings(student_id: str):
    """
    Delete resume embeddings for a specific student.
    This should be called when a student removes their resume.
    """
    try:
        print(f"[Delete] Attempting to delete resume embeddings for student_id: {student_id}")
        
        success = VectorStore.delete_resume_embedding(student_id)
        
        if success:
            print(f"[Delete] Successfully deleted resume embeddings for student_id: {student_id}")
            return {
                "success": True,
                "message": f"Resume embeddings deleted for student {student_id}"
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to delete resume embeddings"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Delete] Error deleting resume embeddings: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
# example usage 
@router.post("/search")
async def search_candidates(
    job_description: str = Form(...),
    top_k: int = Form(10)
):
    """
    Search for candidates matching a job description
    Returns top-k most similar resumes with profile data
    """
    try:
        print(f"Searching for top {top_k} candidates...")
        
        # Generate embedding for job description
        query_embedding = embedder.generate_embedding(job_description)
        
        # Search vector database
        results = VectorStore.search_similar_resumes(
            query_embedding=query_embedding,
            top_k=top_k
        )
        
        # Enrich with profile data
        enriched_results = []
        for result in results:
            profile = supabase.table("profiles")\
                .select("id, email, name, phone, skills, hobbies")\
                .eq("id", result["student_id"])\
                .execute()
            
            if profile.data:
                result["profile"] = profile.data[0]
            enriched_results.append(result)
        
        print(f"Found {len(enriched_results)} matching candidates")
        
        return {
            "success": True,
            "query": job_description,
            "results": enriched_results,
            "count": len(enriched_results)
        }
    
    except Exception as e:
        print(f"Error searching candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))