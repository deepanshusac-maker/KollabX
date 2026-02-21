-- KollabX Chat Schema
-- Run this in your Supabase SQL Editor

-- 1. Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Enable Realtime (idempotent: skip if already in publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 5. RLS Policies for Channels (idempotent: drop if exists then create)
DROP POLICY IF EXISTS "Team members can view channels" ON public.channels;
CREATE POLICY "Team members can view channels" ON public.channels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.project_id = channels.project_id
            AND team_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Creators can manage channels" ON public.channels;
CREATE POLICY "Creators can manage channels" ON public.channels
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = channels.project_id
            AND projects.creator_id = auth.uid()
        )
    );

-- 6. RLS Policies for Messages (idempotent)
DROP POLICY IF EXISTS "Team members can read messages" ON public.messages;
CREATE POLICY "Team members can read messages" ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.channels
            JOIN public.team_members ON channels.project_id = team_members.project_id
            WHERE channels.id = messages.channel_id
            AND team_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Team members can send messages" ON public.messages;
CREATE POLICY "Team members can send messages" ON public.messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.channels
            JOIN public.team_members ON channels.project_id = team_members.project_id
            WHERE channels.id = messages.channel_id
            AND team_members.user_id = auth.uid()
        )
        AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. Trigger to automatically create #general channel for new projects
CREATE OR REPLACE FUNCTION public.handle_new_project_channel()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.channels (project_id, name, description)
    VALUES (NEW.id, 'general', 'General discussion for the team');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created_add_channel ON public.projects;
CREATE TRIGGER on_project_created_add_channel
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project_channel();

-- 8. Backfill #general for existing projects that have no channels (run once)
INSERT INTO public.channels (project_id, name, description)
SELECT p.id, 'general', 'General discussion for the team'
FROM public.projects p
WHERE NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.project_id = p.id);

-- 9. RPC: ensure #general exists for a project (team member can call; creates if missing)
CREATE OR REPLACE FUNCTION public.ensure_general_channel(p_project_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch_id UUID;
  is_member BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  ) INTO is_member;
  IF NOT is_member THEN
    RETURN NULL;
  END IF;

  SELECT id INTO ch_id FROM public.channels
  WHERE project_id = p_project_id AND name = 'general'
  LIMIT 1;
  IF ch_id IS NOT NULL THEN
    RETURN ch_id;
  END IF;

  INSERT INTO public.channels (project_id, name, description)
  VALUES (p_project_id, 'general', 'General discussion for the team')
  RETURNING id INTO ch_id;
  RETURN ch_id;
END;
$$;
