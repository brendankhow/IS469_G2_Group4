from fastapi import APIRouter, HTTPException, Form, Request
from typing import List, Optional
from pydantic import BaseModel, Field
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
    Process resume for a student by fetching their resume_url from profiles table.
    Downloads PDF, extracts text, generates embeddings, stores in pgvector (both full text + chunks).
    """
    temp_path = None

    try:
        # Fetch resume_url
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

        # Download PDF
        print("Downloading resume...")
        response = requests.get(resume_url, timeout=30)
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Could not download resume. Status: {response.status_code}"
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(response.content)
            temp_path = temp_file.name

        print("Extracting text from PDF...")
        resume_text = parser.extract_text_from_pdf(temp_path)
        resume_text = parser.clean_text(resume_text)

        if not resume_text or len(resume_text) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract meaningful text from PDF. Make sure it's a text-based PDF."
            )

        print(f"Extracted {len(resume_text)} characters")

        # === 1️⃣ Generate full resume embedding ===
        print("Generating full resume embedding...")
        embedding = embedder.generate_embedding(resume_text)
        print(f"Generated embedding with {len(embedding)} dimensions")

        # Store or update full resume embedding
        existing = VectorStore.get_resume_by_student_id(student_id)
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
            action = "updated"
        else:
            print("Creating new resume embedding...")
            result = VectorStore.store_resume_embedding(
                student_id=student_id,
                resume_text=resume_text,
                embedding=embedding,
                filename=filename,
                metadata={"resume_url": resume_url}
            )
            action = "created"

        # === 2️⃣ Chunk the resume and store embedded chunks ===
        print("Chunking resume text...")
        chunks = parser.chunk_text(resume_text)  # You should already have this helper
        print(f"Generated {len(chunks)} chunks")

        chunk_embeddings = [embedder.generate_embedding(chunk) for chunk in chunks]
        print(f"Generated embedding with {len(embedding)} dimensions")

        chunk_result = VectorStore.store_resume_chunks(
            student_id=student_id,
            chunks=chunks,
            embeddings=chunk_embeddings,
            filename=filename,
            metadata={"resume_url": resume_url}
        )

        # === 3️⃣ Return response ===
        return {
            "success": True,
            "message": "Resume processed, vectorized, and chunked successfully.",
            "embedding_id": result["id"],
            "student_id": student_id,
            "text_length": len(resume_text),
            "embedding_dimension": len(embedding),
            "chunks_stored": len(chunk_result),
            "action": action
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing resume: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
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
    
class CandidateSearchRequest(BaseModel):
    job_description: str = Field(..., description="Job description to match against")
    top_k: int = Field(10, description="Number of results to return", ge=1, le=100)
    student_ids: Optional[List[str]] = Field(None, description="Filter results to only these student IDs")

# example usage 
@router.post("/search")
async def search_candidates(request: CandidateSearchRequest):
    """
    Search for candidates matching a job description.
    Optionally filter by student_ids for specific applicants (e.g., for a specific job).
    
    Returns top-k most similar resumes ranked by match percentage with profile data.
    """
    try:
        job_description = request.job_description
        top_k = request.top_k
        student_ids = request.student_ids  # Optional filter for specific applicants
        
        print(f"Searching for top {top_k} candidates...")
        if student_ids:
            print(f"Filtering by {len(student_ids)} student IDs: {student_ids}")
        
        # Generate embedding for job description
        query_embedding = embedder.generate_embedding(job_description)
        
        # Search vector database - get MORE results if we're filtering to ensure we capture all applicants
        # Even if they're not the top matches globally, we need to include them in the search
        if student_ids:
            # Get significantly more results to ensure we capture all applicants
            # This is necessary because the top global matches might not have applied to this job
            search_limit = max(len(student_ids) * 3, 50)  # Get at least 3x the applicants or 50 results
            print(f"Expanding search to {search_limit} results to capture all {len(student_ids)} applicants")
        else:
            search_limit = top_k
        
        results = VectorStore.search_similar_resumes(
            query_embedding=query_embedding,
            top_k=search_limit,
            threshold=0.0
        )
        
        # Filter by student_ids if provided (only show applicants for this job)
        if student_ids:
            print(f"Before filtering: {len(results)} results")
            # Debug: Print actual student IDs from results
            for r in results:
                print(f"  Result student_id: {r.get('student_id')} (type: {type(r.get('student_id'))})")
            print(f"  Expected student_ids: {student_ids}")
            
            # Convert both to strings for comparison (in case one is UUID object)
            results = [r for r in results if str(r.get("student_id")) in student_ids]
            print(f"After filtering: {len(results)} results matching student IDs")
            # Limit to top_k after filtering
            results = results[:top_k]
        
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
            "count": len(enriched_results),
            "filtered": bool(student_ids)  # Indicates if filtering was applied
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error searching candidates: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))