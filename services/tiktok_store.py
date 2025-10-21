"""
TikTok Service
Service for retrieving and storing TikTok data by student user ID
Follows the same static method pattern as VectorStore
"""

from supabase_client import supabase
from typing import Dict, List, Optional
import os
import time
import tempfile
import random


class TikTokService:
    """Service for TikTok data operations - static methods following VectorStore pattern"""
    
    BUCKET_NAME = "tiktok-videos"  # Class constant for bucket name
    
    # ========== TikTok User Methods ==========
    
    @staticmethod
    def get_tiktok_user_by_student_id(student_id: str) -> Optional[Dict]:
        """
        Get TikTok user record for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            TikTok user record (id, student_id, username) or None if not found
        """
        try:
            result = (
                supabase.table("tiktok_users")
                .select("id, username, student_id")
                .eq("student_id", student_id)
                .single()
                .execute()
            )
            
            return result.data if result.data else None
            
        except Exception as e:
            print(f"✗ Error fetching TikTok user for student {student_id}: {str(e)}")
            return None
    
    @staticmethod
    def get_tiktok_username_by_student_id(student_id: str) -> Optional[str]:
        """
        Get TikTok username for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            TikTok username or None if not found
        """
        user = TikTokService.get_tiktok_user_by_student_id(student_id)
        return user.get("username") if user else None
    
    # ========== TikTok Video Methods ==========
    
    @staticmethod
    def get_videos_by_student_id(student_id: str) -> List[Dict]:
        """
        Get all TikTok videos for a student
        
        Args:
            student_id: UUID of student from profiles table
        
        Returns:
            List of video records with storage paths and URLs
        """
        try:
            tiktok_user = TikTokService.get_tiktok_user_by_student_id(student_id)
            
            if not tiktok_user:
                print(f"✗ No TikTok user found for student {student_id}")
                return []
            
            user_id = tiktok_user['id']
            
            result = (
                supabase.table("tiktok_videos")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"✗ Error fetching videos for student {student_id}: {str(e)}")
            return []
    
    @staticmethod
    def get_video_by_id(video_id: str) -> Optional[Dict]:
        """
        Get a specific video by video_id
        
        Args:
            video_id: TikTok video ID
        
        Returns:
            Video record or None if not found
        """
        try:
            result = (
                supabase.table("tiktok_videos")
                .select("*")
                .eq("video_id", video_id)
                .single()
                .execute()
            )
            return result.data if result.data else None
        except Exception as e:
            print(f"✗ Error fetching video {video_id}: {str(e)}")
            return None
    
    # # ========== Storage Methods ==========
    
    @staticmethod
    def get_signed_url(
        storage_path: str,
        expires_in: int = 3600
    ) -> Optional[str]:
        """
        Get a signed URL for private bucket access
        
        Args:
            storage_path: Path in storage (e.g., "user_id/video.mp4")
            expires_in: Expiration time in seconds (default: 1 hour)
        
        Returns:
            Signed URL or None if error
        """
        try:
            response = supabase.storage.from_(TikTokService.BUCKET_NAME).create_signed_url(
                storage_path,
                expires_in
            )
            return response.get('signedURL') if response else None
        except Exception as e:
            print(f"✗ Error creating signed URL: {str(e)}")
            return None
    
    @staticmethod
    def get_public_url(storage_path: str) -> str:
        """
        Get public URL for a video in storage
        
        Args:
            storage_path: Path in storage (e.g., "user_id/video.mp4")
        
        Returns:
            Public URL
        """
        return supabase.storage.from_(TikTokService.BUCKET_NAME).get_public_url(storage_path)
    
    @staticmethod
    def delete_video_from_storage(storage_path: str) -> bool:
        """
        Delete a video from Supabase Storage
        
        Args:
            storage_path: Path in storage to delete
        
        Returns:
            True if successful, False otherwise
        """
        try:
            supabase.storage.from_(TikTokService.BUCKET_NAME).remove([storage_path])
            return True
        except Exception as e:
            print(f"✗ Error deleting video: {str(e)}")
            return False
    
    @staticmethod
    def delete_video_record(video_id: str) -> bool:
        """
        Delete a video record from database
        
        Args:
            video_id: TikTok video ID
        
        Returns:
            True if successful, False otherwise
        """
        try:
            supabase.table("tiktok_videos").delete().eq("video_id", video_id).execute()
            return True
        except Exception as e:
            print(f"✗ Error deleting video record: {str(e)}")
            return False
    
    @staticmethod
    def delete_video_complete(video_id: str) -> bool:
        """
        Delete video from both storage and database
        
        Args:
            video_id: TikTok video ID
        
        Returns:
            True if successful, False otherwise
        """
        video = TikTokService.get_video_by_id(video_id)
        if not video:
            print(f"✗ Video {video_id} not found")
            return False
        
        storage_path = video.get('storage_path')
        if storage_path:
            TikTokService.delete_video_from_storage(storage_path)
        
        return TikTokService.delete_video_record(video_id)
    
    # ========== Download and Store Methods ==========
    
    @staticmethod
    def download_and_store_videos(
        student_id: str,
        max_videos: int = 2,
        random_selection: bool = False
    ) -> Dict:
        """
        Download TikTok videos for a student and store in Supabase Storage
        
        Args:
            student_id: UUID of student from profiles table
            max_videos: Maximum number of videos to download
            random_selection: Whether to randomly select videos or get the latest ones
        
        Returns:
            Dictionary with download results including storage info and URLs
        """
        import yt_dlp

        result_summary = {
            "student_id": student_id,
            "username": None,
            "videos": [],
            "count": 0,
            "success": False,
            "error": None
        }

        try:
            # 1. Get TikTok user record
            tiktok_user = TikTokService.get_tiktok_user_by_student_id(student_id)
            if not tiktok_user:
                result_summary["error"] = f"No TikTok username found for student {student_id}"
                return result_summary

            user_id = tiktok_user['id']
            username = tiktok_user['username']
            result_summary["username"] = username

            user_url = f'https://www.tiktok.com/@{username}'
            
            # 2. Get list of all available videos
            print(f"📱 Fetching video list for @{username}...")
            
            ydl_opts_list = {
                'quiet': False,  # Show errors for debugging
                'no_warnings': False,
                'extract_flat': True,
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                },
            }
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts_list) as ydl:
                    info = ydl.extract_info(user_url, download=False)
                    all_video_ids = [
                        entry.get('id') for entry in info.get('entries', [])
                        if entry.get('id')
                    ]
            except Exception as extract_error:
                error_msg = str(extract_error)
                result_summary["error"] = (
                    f"Unable to extract video data from TikTok for @{username}.\n\n"
                    f"Error: {error_msg}\n\n"
                    f"This usually happens when:\n"
                    f"  • TikTok changed their site structure (yt-dlp needs update)\n"
                    f"  • The account is private or restricted\n"
                    f"  • TikTok is blocking automated access\n\n"
                    f"Try these solutions:\n"
                    f"  1. Update yt-dlp: pip install -U yt-dlp\n"
                    f"  2. Check if @{username} is public and accessible in browser\n"
                    f"  3. Try a different TikTok username\n"
                    f"  4. Wait and try again later (rate limiting)\n"
                )
                return result_summary
            
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
            
            # 4. Download and upload each video
            for i, video_id in enumerate(selected_ids):
                print(f"  Processing video {i+1}/{len(selected_ids)}...", end=' ')
                
                video_url = f'https://www.tiktok.com/@{username}/video/{video_id}'
                filename = f'{username}_{video_id}.mp4'
                
                # Create temporary file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
                temp_path = temp_file.name
                temp_file.close()
                
                try:
                    # Download video to temp file
                    ydl_opts = {
                        'outtmpl': temp_path,
                        'format': 'best',
                        'quiet': True,
                        'no_warnings': True,
                    }
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([video_url])
                    
                    # Verify download
                    if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                        print("✗ Download failed")
                        continue
                    
                    # Get file size
                    file_size_bytes = os.path.getsize(temp_path)
                    file_size_mb = file_size_bytes / (1024 * 1024)
                    
                    # Upload to Supabase Storage
                    storage_path = f"{user_id}/{filename}"
                    
                    with open(temp_path, 'rb') as f:
                        upload_resp = supabase.storage.from_(TikTokService.BUCKET_NAME).upload(
                            storage_path,
                            f,
                            file_options={"content-type": "video/mp4"}
                        )
                    
                    # Check for upload errors
                    if hasattr(upload_resp, 'error') and upload_resp.error:
                        print(f"✗ Upload error: {upload_resp.error}")
                        continue
                    
                    # Get public URL
                    public_url = TikTokService.get_public_url(storage_path)
                    
                    # Store video record in database
                    video_record = {
                        "user_id": user_id,
                        "video_id": video_id,
                        "video_url": video_url,
                        "storage_bucket": TikTokService.BUCKET_NAME,
                        "storage_path": storage_path,
                        "file_size_mb": round(file_size_mb, 2),
                        "public_url": public_url,
                    }
                    
                    supabase.table("tiktok_videos").insert(video_record).execute()
                    
                    result_summary["videos"].append({
                        "video_id": video_id,
                        "video_url": video_url,
                        "storage_path": storage_path,
                        "public_url": public_url,
                        "file_size_mb": round(file_size_mb, 2)
                    })
                    result_summary["count"] += 1
                    print(f"✓ ({round(file_size_mb, 1)}MB)")
                    
                except Exception as e:
                    print(f"✗ Error: {str(e)}")
                    continue
                
                finally:
                    # Clean up temporary file
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except Exception:
                            pass
                
                time.sleep(0.5)  # Rate limiting
            
            print(f"\n✓ Successfully uploaded {result_summary['count']}/{len(selected_ids)} videos to Supabase Storage")
            result_summary["success"] = result_summary["count"] > 0
            return result_summary
            
        except Exception as e:
            result_summary["error"] = str(e)
            print(f"✗ Error: {str(e)}")
            return result_summary
    
    # # ========== Summary Methods ==========
    
    @staticmethod
    def get_student_tiktok_summary(student_id: str) -> Dict:
        """
        Get TikTok portfolio summary for a student
        
        Args:
            student_id: Student ID (UUID)
        
        Returns:
            Summary dictionary with stats
        """
        tiktok_user = TikTokService.get_tiktok_user_by_student_id(student_id)
        videos = TikTokService.get_videos_by_student_id(student_id)
        
        total_size_mb = sum(v.get('file_size_mb', 0) for v in videos)
        
        return {
            "student_id": student_id,
            "username": tiktok_user.get('username') if tiktok_user else None,
            "total_videos": len(videos),
            "total_size_mb": round(total_size_mb, 2),
            "latest_video": videos[0] if videos else None
        }