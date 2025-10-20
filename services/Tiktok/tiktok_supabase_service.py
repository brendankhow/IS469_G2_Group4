"""
TikTok Supabase Service
Simple service to retrieve TikTok username and videos based on student user ID
"""

from services.supabase_client import supabase
from typing import Dict, List, Optional
import os
import time
import tempfile
import random


class TikTokSupabaseService:
    """Service for retrieving TikTok data by student user ID"""
    
    def __init__(self):
        self.supabase = supabase
    
    def get_tiktok_user_by_student_id(self, student_id: str) -> Optional[Dict]:
        """
        Get TikTok user record for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            TikTok user record (id, student_id, username) or None if not found
        """
        try:
            result = (
                self.supabase.table("tiktok_users")
                .select("id, username, student_id")
                .eq("student_id", student_id)
                .single()
                .execute()
            )
            
            if result.data:
                return result.data
            return None
            
        except Exception as e:
            print(f"✗ Error fetching TikTok user for student {student_id}: {str(e)}")
            return None
    
    def get_tiktok_username_by_student_id(self, student_id: str) -> Optional[str]:
        """
        Get TikTok username for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            TikTok username or None if not found
        """
        user = self.get_tiktok_user_by_student_id(student_id)
        return user.get("username") if user else None
    
    def get_videos_by_student_id(self, student_id: str) -> List[Dict]:
        """
        Get all TikTok videos for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            List of video records
        """
        try:
            # First get the TikTok user record
            tiktok_user = self.get_tiktok_user_by_student_id(student_id)
            
            if not tiktok_user:
                print(f"✗ No TikTok user found for student {student_id}")
                return []
            
            user_id = tiktok_user['id']
            
            # Get videos by user_id (proper foreign key relationship)
            result = (
                self.supabase.table("tiktok_videos")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"✗ Error fetching videos for student {student_id}: {str(e)}")
            return []
    

    def download_and_store_videos(self, student_id: str, max_videos: int = 2, random_selection: bool = False) -> Dict:
        """
        Download TikTok videos for a student and store in Supabase
        Uses the same logic as the working TikTokDownloader class

        Args:
            student_id: UUID of student from profiles table
            max_videos: Maximum number of videos to download
            random_selection: Whether to randomly select videos or get the latest ones  
        Returns:
            Dictionary with download results
        """ 
        import yt_dlp

        result_summary = {
            "student_id": student_id,
            "username": None,
            "videos": [],
            "count": 0,
            "success": False
        }

        try:
            # 1. Get TikTok user record (includes user_id)
            tiktok_user = self.get_tiktok_user_by_student_id(student_id)
            if not tiktok_user:
                result_summary["error"] = f"No TikTok username found for student {student_id}"
                return result_summary

            user_id = tiktok_user['id']
            username = tiktok_user['username']
            result_summary["username"] = username

            user_url = f'https://www.tiktok.com/@{username}'
            
            # 2. First, get list of all available videos WITHOUT downloading
            print(f"📱 Fetching video list for @{username}...")
            
            ydl_opts_list = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,  # Don't download, just get video info
            }
            
            all_video_ids = []
            
            with yt_dlp.YoutubeDL(ydl_opts_list) as ydl:
                info = ydl.extract_info(user_url, download=False)
                
                if 'entries' in info:
                    all_video_ids = [entry.get('id') for entry in info['entries'] if entry.get('id')]
            
            if not all_video_ids:
                result_summary["error"] = f"No videos found for @{username}"
                return result_summary
            
            print(f"✓ Found {len(all_video_ids)} videos from @{username}")
            
            # 3. Select videos to download
            if random_selection and len(all_video_ids) > max_videos:
                selected_ids = random.sample(all_video_ids, max_videos)
                print(f"✓ Randomly selected {max_videos} videos")
            else:
                selected_ids = all_video_ids[:max_videos]
                print(f"✓ Selected first {len(selected_ids)} videos")
            
            # 4. Download selected videos one by one
            for i, video_id in enumerate(selected_ids):
                print(f"  Downloading video {i+1}/{len(selected_ids)}...", end=' ')
                
                video_url = f'https://www.tiktok.com/@{username}/video/{video_id}'
                filename = f'{username}_{video_id}.mp4'
                output_path = os.path.join(tempfile.gettempdir(), filename)
                
                ydl_opts = {
                    'outtmpl': output_path,
                    'format': 'best',
                    'quiet': True,
                    'no_warnings': True,
                }
                
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([video_url])
                    
                    # Verify file exists
                    if os.path.exists(output_path):
                        # Store video record in Supabase with user_id foreign key
                        video_record = {
                            "user_id": user_id,
                            "video_id": video_id,
                            "video_url": video_url,
                            "local_path": output_path,
                        }

                        db_result = self.supabase.table("tiktok_videos").insert(video_record).execute()

                        result_summary["videos"].append({
                            "video_id": video_id,
                            "video_url": video_url,
                            "local_path": output_path
                        })
                        result_summary["count"] += 1
                        print("✓")
                    else:
                        print("✗ File not found")
                        
                except Exception as e:
                    print(f"✗ Error: {str(e)}")
                    continue
                
                time.sleep(0.5)  # Rate limiting
            
            print(f"\n✓ Successfully downloaded {result_summary['count']}/{len(selected_ids)} videos")
            result_summary["success"] = True if result_summary["count"] > 0 else False
            return result_summary
            
        except Exception as e:
            result_summary["error"] = str(e)
            print(f"✗ Error: {str(e)}")
            return result_summary