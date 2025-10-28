# routes/personality_routes.py
"""
Personality Analysis Routes
Endpoints for video-based personality prediction
"""


from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Optional
from services.personality_service import personality_service
from services.supabase_client import supabase
import tempfile
import os
from pathlib import Path
from datetime import datetime


router = APIRouter()




class PersonalityAnalysisResponse(BaseModel):
    success: bool
    results: Optional[List[Dict]] = None
    error: Optional[str] = None
    storage_path: Optional[str] = None  # Add storage path to response




class PersonalityResult(BaseModel):
    trait: str
    score: float
    raw_score: float
    description: str
    level: str




@router.post("/analyze", response_model=PersonalityAnalysisResponse)
async def analyze_personality_from_upload(
    video: UploadFile = File(...),
    student_id: Optional[str] = Form(None),
    upload_to_storage: bool = Form(False)
):
    """
    Analyze personality traits from uploaded video.
   
    Args:
        video: Video file (mp4, avi, mov, mkv)
        student_id: Optional student ID to store results
        upload_to_storage: Whether to upload video to Supabase storage
       
    Returns:
        Personality analysis with Big Five traits + interview score
       
    Example:
        curl -X POST "http://localhost:8000/personality/analyze" \
             -F "video=@interview.mp4" \
             -F "student_id=your-student-id" \
             -F "upload_to_storage=true"
    """
    temp_path = None
    storage_path = None
   
    try:
        # Validate file type
        allowed_types = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska']
        if video.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: mp4, avi, mov, mkv. Got: {video.content_type}"
            )
       
        # Validate file size (100MB max)
        content = await video.read()
        if len(content) > 100 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File too large. Maximum size: 100MB"
            )
       
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(video.filename).suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
       
        print(f"[Personality API] Analyzing video: {video.filename}")
       
        # Upload to Supabase storage if requested
        if upload_to_storage:
            try:
                # Generate unique filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                file_ext = Path(video.filename).suffix
                unique_filename = f"{student_id or 'anonymous'}_{timestamp}{file_ext}"
                storage_path = f"personality/{unique_filename}"
               
                print(f"[Personality API] Uploading to storage: {storage_path}")
               
                # Upload to interview-videos bucket
                with open(temp_path, 'rb') as f:
                    supabase.storage.from_("interview-videos").upload(
                        path=storage_path,
                        file=f,
                        file_options={"content-type": video.content_type}
                    )
               
                # Get public URL
                video_url = supabase.storage.from_("interview-videos").get_public_url(storage_path)
                print(f"[Personality API] Video uploaded successfully: {video_url}")
               
            except Exception as storage_error:
                print(f"[Personality API] Storage upload failed: {storage_error}")
                # Continue with analysis even if upload fails
                storage_path = None
       
        # Analyze video
        result = personality_service.analyze_video(temp_path)
       
        # Add storage path to result
        if storage_path:
            result["storage_path"] = storage_path
       
        # Store results in database if student_id provided
        if student_id and result.get("success"):
            try:
                # Get video URL if uploaded
                video_url = None
                if storage_path:
                    video_url = supabase.storage.from_("interview-videos").get_public_url(storage_path)
               
                # Store in personality_analyses table
                analysis_data = {
                    "student_id": student_id,
                    "video_filename": video.filename,
                    "video_url": video_url,
                    "storage_path": storage_path,
                    "extraversion": result["results"][0]["raw_score"],
                    "agreeableness": result["results"][1]["raw_score"],
                    "conscientiousness": result["results"][2]["raw_score"],
                    "neuroticism": result["results"][3]["raw_score"],
                    "openness": result["results"][4]["raw_score"],
                    "interview_score": result["results"][5]["raw_score"]
                }
               
                supabase.table("personality_analyses").insert(analysis_data).execute()
                print(f"[Personality API] Stored results for student: {student_id}")
               
            except Exception as db_error:
                print(f"[Personality API] Warning: Could not store results: {db_error}")
                # Don't fail the request if DB storage fails
       
        return PersonalityAnalysisResponse(**result)
   
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Personality API] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
   
    finally:
        # Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass




@router.get("/student/{student_id}/history")
async def get_student_personality_history(student_id: str):
    """
    Get all personality analysis history for a student.
   
    Args:
        student_id: Student ID
       
    Returns:
        List of past personality analyses
    """
    try:
        response = supabase.table("personality_analyses")\
            .select("*")\
            .eq("student_id", student_id)\
            .order("created_at", desc=True)\
            .execute()
       
        return {
            "success": True,
            "student_id": student_id,
            "analyses": response.data,
            "count": len(response.data)
        }
   
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))







