"""
TikTok API Routes
Simple endpoints to retrieve TikTok username and videos by student user ID
"""

from fastapi import APIRouter, HTTPException
from services.Tiktok.tiktok_supabase_service import TikTokSupabaseService

router = APIRouter()
tiktok_service = TikTokSupabaseService()


@router.get("/student/{student_id}/username", tags=["TikTok"])
def get_tiktok_username(student_id: str):
    """Get TikTok username for a student"""
    username = tiktok_service.get_tiktok_username_by_student_id(student_id)
    
    if not username:
        raise HTTPException(
            status_code=404,
            detail=f"No TikTok username found for student {student_id}"
        )
    
    return {
        "success": True,
        "student_id": student_id,
        "username": username
    }


@router.get("/student/{student_id}/videos", tags=["TikTok"])
def get_student_videos(student_id: str):
    """Get all TikTok videos for a student"""
    videos = tiktok_service.get_videos_by_student_id(student_id)
    
    return {
        "success": True,
        "student_id": student_id,
        "videos": videos,
        "count": len(videos)
    }


@router.get("/student/{student_id}/info", tags=["TikTok"])
def get_student_tiktok_info(student_id: str):
    """Get TikTok username and videos for a student in one call"""
    info = tiktok_service.get_student_tiktok_info(student_id)
    
    if not info["username"]:
        raise HTTPException(
            status_code=404,
            detail=f"No TikTok username found for student {student_id}"
        )
    
    return {
        "success": True,
        "data": info
    }


@router.post("/student/{student_id}/download", tags=["TikTok"])
def download_student_videos(
    student_id: str,
    max_videos: int = 10,
    random_selection: bool = False
):
    """
    Download TikTok videos for a student and store in Supabase
    
    Args:
        student_id: Student user ID
        max_videos: Maximum number of videos to download (default: 10)
        random_selection: Randomly select videos (default: False)
    """
    result = tiktok_service.download_and_store_student_videos(
        student_id=student_id,
        max_videos=max_videos,
        random_selection=random_selection
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=result.get("error", "Failed to download videos")
        )
    
    return result
