# Supabase Storage Setup Guide

## Setting Up Storage for Avatars

### Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `avatars`
   - **Public bucket**: ✅ Check this (so images can be accessed via URL)
   - **File size limit**: 5 MB (recommended)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Click **"Create bucket"**

### Step 2: Set Up Storage Policies

1. Still in **Storage**, click on the `avatars` bucket
2. Go to **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Allow authenticated users to upload their own avatars
- **Policy name**: `Users can upload their own avatars`
- **Allowed operation**: INSERT
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

#### Policy 2: Allow authenticated users to update their own avatars
- **Policy name**: `Users can update their own avatars`
- **Allowed operation**: UPDATE
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

#### Policy 3: Allow authenticated users to delete their own avatars
- **Policy name**: `Users can delete their own avatars`
- **Allowed operation**: DELETE
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

#### Policy 4: Allow public read access
- **Policy name**: `Public can read avatars`
- **Allowed operation**: SELECT
- **Policy definition**:
```sql
bucket_id = 'avatars'::text
```

### Step 3: Alternative - Use RLS Helper Function

Instead of folder-based policies, you can use a simpler approach:

1. Go to **SQL Editor** in Supabase
2. Run this SQL to create a helper function:

```sql
-- Function to check if user owns the avatar file
CREATE OR REPLACE FUNCTION public.user_owns_avatar(user_id UUID, file_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN file_path LIKE user_id::text || '/%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then create policies using this function
-- Policy for INSERT/UPDATE/DELETE:
-- (bucket_id = 'avatars'::text) AND public.user_owns_avatar(auth.uid(), name)
```

### Step 4: Test Storage

After setting up, you can test by:
1. Using the Supabase Storage UI to upload a test file
2. Or use the frontend code (which we'll implement next)

---

## File Naming Convention

We'll use this format:
- Path: `{user_id}/avatar.{extension}`
- Example: `550e8400-e29b-41d4-a716-446655440000/avatar.jpg`

This ensures:
- Each user has their own folder
- Easy to find and replace avatars
- Clean organization

---

## Next Steps

After setting up Storage:
1. Update `profile.html` to upload to Storage
2. Add image compression before upload
3. Update profile loading to fetch from Storage URL
