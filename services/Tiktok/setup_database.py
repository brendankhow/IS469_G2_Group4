"""
Database Setup Script for TikTok Video Storage
Run this script to create tables and add test data
"""

from services.supabase_client import supabase
import sys


def create_tables():
    """Create tiktok_users and tiktok_videos tables"""
    
    print("=" * 60)
    print("Creating Database Tables")
    print("=" * 60)
    
    # SQL to create tables
    sql_schema = """
    -- Create tiktok_users table
    CREATE TABLE IF NOT EXISTS tiktok_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        username TEXT UNIQUE NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create tiktok_videos table
    CREATE TABLE IF NOT EXISTS tiktok_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES tiktok_users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        video_id TEXT UNIQUE NOT NULL,
        video_url TEXT NOT NULL,
        local_path TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_tiktok_users_student_id ON tiktok_users(student_id);
    CREATE INDEX IF NOT EXISTS idx_tiktok_users_username ON tiktok_users(username);
    CREATE INDEX IF NOT EXISTS idx_tiktok_videos_username ON tiktok_videos(username);
    CREATE INDEX IF NOT EXISTS idx_tiktok_videos_video_id ON tiktok_videos(video_id);

    -- Enable Row Level Security
    ALTER TABLE tiktok_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tiktok_videos ENABLE ROW LEVEL SECURITY;

    -- Create policies
    DROP POLICY IF EXISTS "Enable read access for all users" ON tiktok_users;
    CREATE POLICY "Enable read access for all users" ON tiktok_users
        FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tiktok_users;
    CREATE POLICY "Enable insert for authenticated users" ON tiktok_users
        FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable read access for all users" ON tiktok_videos;
    CREATE POLICY "Enable read access for all users" ON tiktok_videos
        FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tiktok_videos;
    CREATE POLICY "Enable insert for authenticated users" ON tiktok_videos
        FOR INSERT WITH CHECK (true);
    """
    
    print("\n⚠️  NOTE: Run this SQL manually in Supabase SQL Editor:")
    print("\n" + "─" * 60)
    print(sql_schema)
    print("─" * 60)
    print("\nOr go to: https://supabase.com/dashboard")
    print("Navigate to: SQL Editor → New Query → Paste the above SQL\n")


def get_student_ids():
    """Get list of available student IDs from profiles table"""
    
    print("\n" + "=" * 60)
    print("Available Students")
    print("=" * 60)
    
    try:
        result = supabase.table("profiles").select("id, full_name, email").limit(10).execute()
        
        if result.data:
            print(f"\nFound {len(result.data)} students:\n")
            for i, student in enumerate(result.data, 1):
                print(f"{i}. {student.get('full_name', 'Unknown')}")
                print(f"   Email: {student.get('email', 'N/A')}")
                print(f"   ID: {student['id']}")
                print()
            
            return result.data
        else:
            print("\n✗ No students found in profiles table")
            return []
            
    except Exception as e:
        print(f"\n✗ Error fetching students: {str(e)}")
        return []


def add_tiktok_username(student_id: str, username: str):
    """
    Add TikTok username for a student
    
    Args:
        student_id: UUID of student from profiles table
        username: TikTok username (without @)
    """
    
    print("\n" + "=" * 60)
    print("Adding TikTok Username")
    print("=" * 60)
    
    try:
        # Check if username already exists
        check_result = (
            supabase.table("tiktok_users")
            .select("*")
            .eq("student_id", student_id)
            .execute()
        )
        
        if check_result.data:
            print(f"\n⚠️  Student already has TikTok username: @{check_result.data[0]['username']}")
            
            # Ask if user wants to update
            response = input("\nUpdate username? (y/n): ").lower()
            if response == 'y':
                update_result = (
                    supabase.table("tiktok_users")
                    .update({"username": username})
                    .eq("student_id", student_id)
                    .execute()
                )
                print(f"\n✓ Updated username to: @{username}")
            else:
                print("\n✓ Keeping existing username")
            return
        
        # Insert new username
        result = (
            supabase.table("tiktok_users")
            .insert({
                "student_id": student_id,
                "username": username,
                "metadata": {}
            })
            .execute()
        )
        
        if result.data:
            print(f"\n✓ Successfully added TikTok username!")
            print(f"  Student ID: {student_id}")
            print(f"  Username: @{username}")
        else:
            print(f"\n✗ Failed to add username")
            
    except Exception as e:
        print(f"\n✗ Error adding username: {str(e)}")


def list_tiktok_users():
    """List all TikTok usernames in database"""
    
    print("\n" + "=" * 60)
    print("TikTok Users in Database")
    print("=" * 60)
    
    try:
        result = supabase.table("tiktok_users").select("*").execute()
        
        if result.data:
            print(f"\nFound {len(result.data)} TikTok users:\n")
            for i, user in enumerate(result.data, 1):
                print(f"{i}. @{user['username']}")
                print(f"   Student ID: {user['student_id']}")
                print(f"   Created: {user.get('created_at', 'N/A')}")
                print()
        else:
            print("\n✗ No TikTok users found")
            
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")


def interactive_setup():
    """Interactive setup wizard"""
    
    print("\n" + "=" * 60)
    print("🎬 TikTok Database Setup Wizard")
    print("=" * 60)
    
    # Step 1: Get students
    students = get_student_ids()
    
    if not students:
        print("\n✗ No students found. Please add students to the profiles table first.")
        return
    
    # Step 2: Select student
    print("\n" + "─" * 60)
    try:
        choice = int(input(f"\nSelect student (1-{len(students)}): "))
        if choice < 1 or choice > len(students):
            print("✗ Invalid selection")
            return
        
        selected_student = students[choice - 1]
        student_id = selected_student['id']
        
        print(f"\n✓ Selected: {selected_student.get('full_name', 'Unknown')}")
        print(f"  Student ID: {student_id}")
        
    except (ValueError, IndexError):
        print("\n✗ Invalid input")
        return
    
    # Step 3: Get TikTok username
    print("\n" + "─" * 60)
    username = input("\nEnter TikTok username (without @): ").strip()
    
    if not username:
        print("✗ Username cannot be empty")
        return
    
    # Remove @ if user included it
    username = username.lstrip('@')
    
    # Step 4: Add to database
    add_tiktok_username(student_id, username)
    
    # Step 5: Verify
    print("\n" + "─" * 60)
    print("Verification:")
    print("─" * 60)
    list_tiktok_users()


def quick_add(student_id: str, username: str):
    """Quick add without interactive prompts"""
    
    print("\n🎬 Quick Add TikTok Username\n")
    
    username = username.lstrip('@')
    add_tiktok_username(student_id, username)
    
    print("\n✓ Done!")


def main():
    """Main setup function"""
    
    print("\n" + "=" * 60)
    print("🎬 TikTok Database Setup")
    print("=" * 60)
    print("\nChoose an option:")
    print("1. Show SQL schema (to run manually)")
    print("2. List available students")
    print("3. Add TikTok username (interactive)")
    print("4. List TikTok users")
    print("5. Quick add (requires student_id and username)")
    print("0. Exit")
    
    try:
        choice = input("\nEnter choice (0-5): ").strip()
        
        if choice == "1":
            create_tables()
        elif choice == "2":
            get_student_ids()
        elif choice == "3":
            interactive_setup()
        elif choice == "4":
            list_tiktok_users()
        elif choice == "5":
            student_id = input("Student ID: ").strip()
            username = input("TikTok username: ").strip()
            quick_add(student_id, username)
        elif choice == "0":
            print("\n✓ Goodbye!")
        else:
            print("\n✗ Invalid choice")
            
    except KeyboardInterrupt:
        print("\n\n✓ Cancelled by user")
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")


if __name__ == "__main__":
    main()
