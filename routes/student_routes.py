from fastapi import APIRouter, HTTPException, Form
from typing import List
from pydantic import BaseModel
from services.resume_parser import ResumeParser
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore
from services.supabase_client import supabase
from services.cover_letter_service import coverLetterService
import tempfile
import os
import requests
import traceback

router = APIRouter()

parser = ResumeParser()
embedder = EmbeddingService()

class JobIDs(BaseModel):
    job_ids: List[str]

class CoverLetterRequest(BaseModel):
    student_id: str
    job_ids: List[str]

class RefinementRequest(BaseModel):
    original_letter: str
    instruction: str    

@router.post("/feedback")
async def get_resume_feedback(student_id: str = Form(...)):

    resume_data = VectorStore.get_resume_by_student_id(student_id)
    if not resume_data:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    feedback = coverLetterService.generate_resume_feedback(resume_data["resume_text"])
    
    return {"student_id": student_id, "feedback": feedback}


@router.post("/generate-cover-letters")
async def generate_cover_letters_package(payload: CoverLetterRequest):
    student_id = payload.student_id
    job_ids = payload.job_ids

    job = None
    try:
        profile_response = supabase.table("profiles").select("*").eq("id", student_id).single().execute()
        if not profile_response.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_profile = profile_response.data

        jobs = coverLetterService.get_jds_by_ids(job_ids)
        if not jobs:
            raise HTTPException(status_code=404, detail="No job descriptions found for given IDs")

        generated_cover_letters = []

        for job in jobs:
            jd_text = job.get("description")
            if not jd_text:
                continue
            
            # Embed the JD
            query_embedding = embedder.generate_embedding(jd_text)
            
            # Find relevant parts of the student's resume
            relevant_chunks_data = VectorStore.search_student_resume(
                student_id=student_id,
                query_embedding=query_embedding
            )
            relevant_texts = [chunk['resume_text'] for chunk in relevant_chunks_data]

            # Generate the cover letter
            cover_letter = coverLetterService.generate_cover_letter_for_job(
                job_description=jd_text,
                relevant_experience_chunks=relevant_texts,
                student_profile=student_profile
            )
            
            generated_cover_letters.append({
                "job_id": job.get("id"),
                "job_title": job.get("title"),
                "cover_letter": cover_letter
            })

        return {
            "student_id": student_id,
            "cover_letters": generated_cover_letters
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/refine-cover-letter")
async def refine_cover_letter_endpoint(payload: RefinementRequest):
    try:
        refined_text = coverLetterService.refine_cover_letter(
            original_letter=payload.original_letter,
            user_instruction=payload.instruction
        )
        return {"refined_letter": refined_text}
    except Exception as e:
        print("--- AN UNEXPECTED ERROR OCCURRED in refine-cover-letter ---")
        traceback.print_exc()
        print("-------------------------------------------------------")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")