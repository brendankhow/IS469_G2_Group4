# 📚 Database Setup Guide - Store TikTok Usernames

Complete guide to set up the database and store TikTok usernames for students.

---

## 🎯 Quick Start (3 Steps)

```powershell
# 1. Run SQL schema in Supabase (see below)
# 2. Get student IDs
python services/Tiktok/add_username.py

# 3. Add username using quick_add.py (edit file first)
python services/Tiktok/quick_add.py
```

---

## 📋 Step 1: Create Database Tables

### Option A: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

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
```

6. Click **Run** or press `Ctrl+Enter`
7. Verify: Go to **Table Editor** → should see `tiktok_users` and `tiktok_videos`

---

## 📋 Step 2: Get Student IDs

### Option A: Using Python Script

```powershell
python services/Tiktok/add_username.py
```

This will list all students with their IDs.

### Option B: Using Supabase Dashboard

1. Go to **Table Editor**
2. Select `profiles` table
3. Copy the `id` column value for your student

### Option C: Using API

```powershell
curl http://127.0.0.1:8000/profiles
```

---

## 📋 Step 3: Add TikTok Username

### Option A: Quick Add Script (Easiest)

1. **Edit** `services/Tiktok/quick_add.py`:
   ```python
   STUDENT_ID = "abc123-def456-..."  # Paste student ID here
   TIKTOK_USERNAME = "cool_student"   # TikTok username here
   ```

2. **Run**:
   ```powershell
   python services/Tiktok/quick_add.py
   ```

3. **Done!** The script will:
   - Add username to database
   - Verify the entry
   - Show next steps

### Option B: Interactive Setup

```powershell
python services/Tiktok/setup_database.py
```

Then select option `3` for interactive setup.

### Option C: Direct Python

```python
from services.Tiktok.add_username import add_tiktok_username_simple

add_tiktok_username_simple(
    student_id="your-student-id",
    tiktok_username="tiktok_username"
)
```

### Option D: Direct SQL

```sql
INSERT INTO tiktok_users (student_id, username)
VALUES ('your-student-id', 'tiktok_username');
```

---

## 🧪 Step 4: Verify Setup

### Test with API

```powershell
# Get username
curl http://127.0.0.1:8000/tiktok/student/YOUR_STUDENT_ID/username

# Expected response:
# {
#   "success": true,
#   "student_id": "...",
#   "username": "cool_student"
# }
```

### Test with Python

```python
from services.Tiktok.tiktok_supabase_service import TikTokSupabaseService

service = TikTokSupabaseService()
username = service.get_tiktok_username_by_student_id("your-student-id")
print(f"Username: @{username}")
```

---

## 📁 Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `quick_add.py` | **Easiest** - Add username with edited values | Edit and run |
| `add_username.py` | List students and TikTok users | `python add_username.py` |
| `setup_database.py` | Interactive setup wizard | `python setup_database.py` |

---

## 🎯 Complete Example Workflow

```powershell
# 1. Create tables (run SQL in Supabase)

# 2. Get student IDs
python services/Tiktok/add_username.py

# Output:
# Found 5 students:
# 1. John Doe
#    Email: john@example.com
#    ID: abc123-def456-ghi789-...

# 3. Edit quick_add.py
# Set STUDENT_ID = "abc123-def456-ghi789-..."
# Set TIKTOK_USERNAME = "johndoe_official"

# 4. Run quick_add
python services/Tiktok/quick_add.py

# Output:
# ✓ Added successfully!
# ✓ Confirmed in database:
#   Student ID: abc123-def456-ghi789-...
#   Username: @johndoe_official

# 5. Test API
curl http://127.0.0.1:8000/tiktok/student/abc123.../username

# 6. Download videos
curl -X POST "http://127.0.0.1:8000/tiktok/student/abc123.../download?max_videos=3"
```

---

## 🔧 Troubleshooting

### Error: "No module named 'services'"

**Solution:** Run from project root:
```powershell
cd c:\Users\xinya\GitHub\IS469_G2_Group4
python services/Tiktok/add_username.py
```

### Error: "relation 'tiktok_users' does not exist"

**Solution:** Run SQL schema in Supabase first (Step 1)

### Error: "violates foreign key constraint"

**Solution:** Student ID doesn't exist. Check profiles table:
```powershell
python services/Tiktok/add_username.py
```

### Error: "duplicate key value violates unique constraint"

**Solution:** Username already exists. Use different username or update existing.

---

## 📊 Database Structure

```
profiles table (existing)
  ├─ id (UUID)
  ├─ full_name
  └─ email

tiktok_users table (new)
  ├─ id (UUID)
  ├─ student_id → profiles.id
  ├─ username (unique)
  └─ created_at

tiktok_videos table (new)
  ├─ id (UUID)
  ├─ user_id → tiktok_users.id
  ├─ username
  ├─ video_id
  ├─ video_url
  ├─ local_path (Supabase storage URL)
  └─ created_at
```

---

## 🎬 Next Steps After Setup

Once you've added a TikTok username:

1. **Download videos**:
   ```powershell
   curl -X POST "http://127.0.0.1:8000/tiktok/student/STUDENT_ID/download?max_videos=5"
   ```

2. **View videos**:
   ```powershell
   curl http://127.0.0.1:8000/tiktok/student/STUDENT_ID/videos
   ```

3. **Get complete info**:
   ```powershell
   curl http://127.0.0.1:8000/tiktok/student/STUDENT_ID/info
   ```

---

## 💡 Tips

- **Multiple Students**: Run `quick_add.py` multiple times with different IDs
- **Update Username**: Just run `quick_add.py` again with same student ID
- **List All Users**: Run `add_username.py` to see all TikTok users
- **Test First**: Use 3-5 videos for initial testing (`max_videos=3`)

---

## ✅ Checklist

- [ ] SQL schema executed in Supabase
- [ ] Tables `tiktok_users` and `tiktok_videos` exist
- [ ] Student ID obtained from profiles table
- [ ] TikTok username added using one of the scripts
- [ ] Verified with API endpoint
- [ ] Ready to download videos!

---

## 📚 Related Documentation

- **VIDEO_DOWNLOAD_GUIDE.md** - How to download videos
- **SETUP_CHECKLIST.md** - Full setup checklist
- **QUICK_REFERENCE.md** - Quick command reference

---

**You're all set! Ready to download TikTok videos! 🚀**
