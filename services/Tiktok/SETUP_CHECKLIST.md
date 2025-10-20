# Setup Checklist for TikTok Video Download & Storage

Follow these steps to set up video download and storage functionality.

## ✅ Prerequisites

- [ ] Python virtual environment activated
- [ ] FastAPI server working
- [ ] Supabase connected
- [ ] `yt-dlp` installed

## 📋 Step-by-Step Setup

### 1. Create Supabase Storage Bucket

**Go to Supabase Dashboard:**
1. Open your project at https://supabase.com/dashboard
2. Navigate to **Storage** (left sidebar)
3. Click **New Bucket**
4. Fill in:
   - Name: `tiktok-videos`
   - Public: ✅ (check this box)
5. Click **Create Bucket**

**Alternative: SQL Script**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('tiktok-videos', 'tiktok-videos', true);
```

---

### 2. Create Database Tables

**Run this SQL in Supabase SQL Editor:**

```sql
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
    local_path TEXT,  -- Supabase storage URL
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

-- Create policies (adjust as needed)
CREATE POLICY "Enable read access for all users" ON tiktok_users
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON tiktok_videos
    FOR SELECT USING (true);
```

---

### 3. Add Test TikTok Username

**Link a student to a TikTok username:**

```sql
-- Get a student ID from profiles table
SELECT id, full_name FROM profiles LIMIT 5;

-- Insert TikTok username (replace with actual values)
INSERT INTO tiktok_users (student_id, username)
VALUES ('YOUR_STUDENT_ID_HERE', 'tiktok_username');

-- Example:
INSERT INTO tiktok_users (student_id, username)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'cool_student');
```

---

### 4. Set Storage Policies (Optional)

**If you want public access to stored videos:**

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'tiktok-videos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tiktok-videos');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tiktok-videos');
```

---

### 5. Test the Setup

**PowerShell commands:**

```powershell
# 1. Start the server
python main.py

# 2. Get a student ID
curl http://127.0.0.1:8000/profiles

# 3. Check if student has TikTok username
curl http://127.0.0.1:8000/tiktok/student/STUDENT_ID/username

# 4. Download 3 videos
curl -X POST "http://127.0.0.1:8000/tiktok/student/STUDENT_ID/download?max_videos=3"

# 5. View downloaded videos
curl http://127.0.0.1:8000/tiktok/student/STUDENT_ID/videos
```

---

### 6. Verify in Supabase

**Check Storage:**
1. Go to **Storage** → **tiktok-videos** bucket
2. You should see folder: `tiktok/username/`
3. Videos should be inside: `video_id.mp4`

**Check Database:**
```sql
-- Check tiktok_users
SELECT * FROM tiktok_users;

-- Check tiktok_videos
SELECT 
    username, 
    video_id, 
    local_path,
    created_at 
FROM tiktok_videos 
ORDER BY created_at DESC;
```

---

## 🎯 Quick Test Checklist

- [ ] Storage bucket `tiktok-videos` created
- [ ] Tables `tiktok_users` and `tiktok_videos` exist
- [ ] At least one student linked to TikTok username
- [ ] Server starts without errors (`python main.py`)
- [ ] Can access API docs at http://127.0.0.1:8000/docs
- [ ] Can get student's TikTok username via API
- [ ] Can download videos via API
- [ ] Videos appear in Supabase Storage
- [ ] Video records appear in `tiktok_videos` table

---

## 🔧 Troubleshooting

### Error: "Bucket not found"
→ Create the `tiktok-videos` bucket in Supabase Storage

### Error: "No TikTok username found"
→ Insert a record in `tiktok_users` table linking student_id to username

### Error: "Permission denied"
→ Check storage policies or make bucket public

### Error: "yt-dlp not found"
→ Install with `pip install yt-dlp`

### Videos not downloading
→ Check if TikTok username is valid and public

### Slow downloads
→ Normal! Each video takes 2-5 seconds. Reduce `max_videos` for testing.

---

## 📝 Configuration

### Change Storage Bucket Name

If you want to use a different bucket name:

1. Change in `tiktok_supabase_service.py`:
```python
bucket_name = "your-bucket-name"  # Line ~195
```

2. Create that bucket in Supabase Storage

### Change Video Quality

In `download_user_videos()` method:
```python
ydl_opts = {
    'format': 'best',  # Change to 'worst' for lower quality
    ...
}
```

### Change Rate Limiting

In `download_user_videos()` method:
```python
time.sleep(0.5)  # Change to 1.0 for slower, safer downloads
```

---

## 📚 Next Steps

After setup is complete:

1. **Test with API docs**: http://127.0.0.1:8000/docs
2. **Run example script**: `python services/Tiktok/example_download.py`
3. **Read usage guide**: `VIDEO_DOWNLOAD_GUIDE.md`
4. **Integrate with frontend**: Use the API endpoints in your Next.js app

---

## 🎉 You're Ready!

Once all checkboxes are complete, you can:
- Download TikTok videos via API
- Store them in Supabase Storage
- Retrieve video URLs from database
- Access videos from frontend

**Main Endpoint:**
```
POST /tiktok/student/{student_id}/download?max_videos=10
```

Happy downloading! 🚀
