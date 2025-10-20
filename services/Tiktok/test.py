"""
Example script to download and store TikTok videos
Run this after setting up the database and storage bucket
"""

from tiktok_supabase_service import TikTokSupabaseService


def example_download_videos():
    """Example: Download videos for a student"""
    
    service = TikTokSupabaseService()
    
    # Replace with actual student ID from your database
    student_id = "YOUR_STUDENT_ID_HERE"
    
    print("=" * 60)
    print("TikTok Video Download Example")
    print("=" * 60)
    
    # 1. Check if student has TikTok username
    print("\n1. Checking TikTok username...")
    username = service.get_tiktok_username_by_student_id(student_id)
    
    if not username:
        print(f"✗ No TikTok username found for student {student_id}")
        print("\nPlease add a TikTok username to the database first:")
        print(f"  INSERT INTO tiktok_users (student_id, username)")
        print(f"  VALUES ('{student_id}', 'your_tiktok_username');")
        return
    
    print(f"✓ Found username: @{username}")
    
    # 2. Download videos
    print("\n2. Downloading videos...")
    print("   This will download 3 videos and store them in Supabase")
    print("   (You can change max_videos and random_selection)\n")
    
    result = service.download_and_store_student_videos(
        student_id=student_id,
        max_videos=3,  # Download 3 videos
        random_selection=False  # Get first 3 videos
    )
    
    # 3. Show results
    print("\n" + "=" * 60)
    print("Results:")
    print("=" * 60)
    
    if result['success']:
        print(f"\n✓ Success!")
        print(f"  Student ID: {result['student_id']}")
        print(f"  Username: @{result['username']}")
        print(f"  Downloaded: {result['count']} videos")
        
        print(f"\n📹 Videos:")
        for i, video in enumerate(result['videos'], 1):
            print(f"\n  Video {i}:")
            print(f"    ID: {video['video_id']}")
            print(f"    TikTok URL: {video['video_url']}")
            print(f"    Storage URL: {video['local_path']}")
    else:
        print(f"\n✗ Failed to download videos")
        print(f"  Error: {result.get('error', 'Unknown error')}")
    
    # 4. List all videos in database
    print("\n" + "=" * 60)
    print("All Videos in Database:")
    print("=" * 60)
    
    all_videos = service.get_videos_by_student_id(student_id)
    
    if all_videos:
        print(f"\nTotal videos: {len(all_videos)}")
        for i, video in enumerate(all_videos, 1):
            print(f"\n{i}. {video['video_id']}")
            print(f"   Created: {video.get('created_at', 'N/A')}")
            print(f"   URL: {video['local_path']}")
    else:
        print("\nNo videos found in database")


def example_download_by_username():
    """Example: Download videos directly by username"""
    
    service = TikTokSupabaseService()
    
    username = "your_tiktok_username"  # Replace with actual username
    
    print("=" * 60)
    print(f"Downloading videos for @{username}")
    print("=" * 60)
    
    videos = service.download_user_videos(
        username=username,
        max_videos=5,
        random_selection=True  # Randomly select 5 videos
    )
    
    print(f"\n✓ Downloaded {len(videos)} videos")
    
    for i, video in enumerate(videos, 1):
        print(f"\n{i}. Video ID: {video['video_id']}")
        print(f"   Storage: {video['local_path']}")


def example_get_videos():
    """Example: Just retrieve videos without downloading"""
    
    service = TikTokSupabaseService()
    student_id = "YOUR_STUDENT_ID_HERE"
    
    print("=" * 60)
    print("Retrieving Videos (No Download)")
    print("=" * 60)
    
    # Get username
    username = service.get_tiktok_username_by_student_id(student_id)
    print(f"\nUsername: @{username}")
    
    # Get videos
    videos = service.get_videos_by_student_id(student_id)
    print(f"Videos in database: {len(videos)}")
    
    for i, video in enumerate(videos, 1):
        print(f"\n{i}. {video['video_id']}")
        print(f"   TikTok: {video['video_url']}")
        print(f"   Storage: {video['local_path']}")


if __name__ == "__main__":
    # Run the example
    print("\n🎬 TikTok Video Download Example\n")
    
    # Choose which example to run:
    
    # Example 1: Download videos by student ID
    example_download_videos()
    
    # Example 2: Download videos directly by username
    # example_download_by_username()
    
    # Example 3: Just retrieve existing videos
    # example_get_videos()
    
    print("\n✓ Done!\n")
