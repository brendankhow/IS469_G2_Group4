"""
TikTok Service Test
File location: services/Tiktok/test.py
Service location: services/tiktok_service.py
"""

# Now we can import from services
from tiktok_store import TikTokService


def example_download_videos():
    """Example: Download videos for a student"""
    
    student_id = "eb4dc476-c30a-420e-9218-b996d45ce878"
    
    print("=" * 60)
    print("TikTok Video Download Example")
    print("=" * 60)
    
    # 1. Check if student has TikTok username
    print("\n1. Checking TikTok user...")
    tiktok_user = TikTokService.get_tiktok_user_by_student_id(student_id)
    
    if not tiktok_user:
        print(f"✗ No TikTok user found for student {student_id}")
        print("\nPlease add a TikTok username to the database first:")
        print(f"  INSERT INTO tiktok_users (student_id, username)")
        print(f"  VALUES ('{student_id}', 'your_tiktok_username');")
        return
    
    print(f"✓ Found TikTok user:")
    print(f"  User ID: {tiktok_user['id']}")
    print(f"  Username: @{tiktok_user['username']}")
    
    # 2. Download videos
    print("\n2. Downloading videos...")
    
    result = TikTokService.download_and_store_videos(
        student_id=student_id,
        max_videos=3,
        random_selection=False
    )
    
    # 3. Show results
    print("\n3. Results:")
    
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
            print(f"    Public URL: {video['public_url']}")
            print(f"    Storage: {video['storage_path']}")
            print(f"    Size: {video['file_size_mb']}MB")
    else:
        print(f"\n✗ Failed to download videos")
        print(f"  Error: {result.get('error', 'Unknown error')}")
    
    # 4. List all videos in database
    print("\n4. All videos in database:")
    all_videos = TikTokService.get_videos_by_student_id(student_id)
    
    if all_videos:
        print(f"\nTotal videos: {len(all_videos)}")
        for i, video in enumerate(all_videos, 1):
            print(f"\n{i}. Video ID: {video['video_id']}")
            print(f"   Created: {video.get('created_at', 'N/A')}")
            print(f"   URL: {video.get('public_url', 'N/A')}")
            print(f"   Size: {video.get('file_size_mb', 0)}MB")
    else:
        print("\nNo videos found in database")
    
    # # 5. Get summary
    # print("\n5. Portfolio Summary:")
    # summary = TikTokService.get_student_tiktok_summary(student_id)
    # print(f"  Username: @{summary['username']}")
    # print(f"  Total Videos: {summary['total_videos']}")
    # print(f"  Total Size: {summary['total_size_mb']}MB")


def example_get_videos():
    """Example: Just retrieve videos without downloading"""
    
    student_id = "0cc080d8-fb54-48c3-9885-17f680d0e5f6"
    
    print("=" * 60)
    print("Retrieving Videos (No Download)")
    print("=" * 60)
    
    # Get TikTok user
    tiktok_user = TikTokService.get_tiktok_user_by_student_id(student_id)
    
    if tiktok_user:
        print(f"\n✓ TikTok User:")
        print(f"  User ID: {tiktok_user['id']}")
        print(f"  Username: @{tiktok_user['username']}")
        print(f"  Student ID: {tiktok_user['student_id']}")
    else:
        print(f"\n✗ No TikTok user found for student {student_id}")
        return
    
    # Get videos
    videos = TikTokService.get_videos_by_student_id(student_id)
    print(f"\nVideos in database: {len(videos)}")
    
    for i, video in enumerate(videos, 1):
        print(f"\n{i}. Video ID: {video['video_id']}")
        print(f"   TikTok: {video['video_url']}")
        print(f"   Public URL: {video.get('public_url', 'N/A')}")
        print(f"   Created: {video.get('created_at', 'N/A')}")
    
    # Get summary
    summary = TikTokService.get_student_tiktok_summary(student_id)
    print(f"\n📊 Summary:")
    print(f"  @{summary['username']}: {summary['total_videos']} videos ({summary['total_size_mb']}MB)")


if __name__ == "__main__":
    print("\n🎬 TikTok Video Service Examples\n")
    
    # Choose which example to run:
    
    # Example 1: Download videos by student ID
    example_download_videos()
    
    # Example 2: Just retrieve existing videos
    # example_get_videos()

    
    print("\n✓ Done!\n")