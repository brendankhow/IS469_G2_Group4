"""
TikTok Supabase Service
Simple service to retrieve TikTok username and videos based on student user ID
"""

from services.supabase_client import supabase
from typing import Dict, List, Optional
import os
import time
import tempfile


class TikTokSupabaseService:
    """Service for retrieving TikTok data by student user ID"""
    
    def __init__(self):
        self.supabase = supabase
    
    def get_tiktok_username_by_student_id(self, student_id: str) -> Optional[str]:
        """
        Get TikTok username for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            TikTok username or None if not found
        """
        try:
            result = (
                self.supabase.table("tiktok_users")
                .select("username")
                .eq("student_id", student_id)
                .single()
                .execute()
            )
            
            if result.data:
                return result.data.get("username")
            return None
            
        except Exception as e:
            print(f"✗ Error fetching TikTok username for student {student_id}: {str(e)}")
            return None
    
    def get_videos_by_student_id(self, student_id: str) -> List[Dict]:
        """
        Get all TikTok videos for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            List of video records
        """
        try:
            # First get the username
            username = self.get_tiktok_username_by_student_id(student_id)
            
            if not username:
                print(f"✗ No TikTok username found for student {student_id}")
                return []
            
            #get videos by username from tiktok and store in supabase table

            tiktok_videos = []  # This will hold the videos fetched from TikTok
            
            # Get videos by username
            result = (
                self.supabase.table("tiktok_videos")
                .select("*")
                .eq("username", username)
                .order("created_at", desc=True)
                .execute()
            )
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"✗ Error fetching videos for student {student_id}: {str(e)}")
            return []
    
    # def get_student_tiktok_info(self, student_id: str) -> Dict:
    #     """
    #     Get TikTok username and all videos for a student in one call
        
    #     Args:
    #         student_id: UUID of student from profiles table
        
    #     Returns:
    #         Dictionary with username and videos
    #     """
    #     username = self.get_tiktok_username_by_student_id(student_id)
    #     videos = self.get_videos_by_student_id(student_id) if username else []
        
    #     return {
    #         "student_id": student_id,
    #         "username": username,
    #         "videos": videos,
    #         "video_count": len(videos)
    #     }
