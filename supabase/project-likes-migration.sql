-- Migration to add Project Likes

-- 1. Create project_likes table
CREATE TABLE IF NOT EXISTS public.project_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Index for fast lookup by project or user
CREATE INDEX IF NOT EXISTS idx_project_likes_project ON public.project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_likes_user ON public.project_likes(user_id);

-- 2. Add likes_count to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0);

-- 3. Function to update likes_count
CREATE OR REPLACE FUNCTION public.update_project_likes_count()
RETURNS TRIGGER AS $$
DECLARE
    pid UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        pid := NEW.project_id;
    ELSIF TG_OP = 'DELETE' THEN
        pid := OLD.project_id;
    END IF;

    UPDATE public.projects
    SET likes_count = (
        SELECT COUNT(*)
        FROM public.project_likes
        WHERE project_id = pid
    )
    WHERE id = pid;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to maintain likes_count accuracy
DROP TRIGGER IF EXISTS on_project_like_change ON public.project_likes;
CREATE TRIGGER on_project_like_change
    AFTER INSERT OR DELETE ON public.project_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_project_likes_count();
