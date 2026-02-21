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

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 5. RLS Policies for Channels
-- Anyone who is a member of the project can view the channels
CREATE POLICY "Team members can view channels" ON public.channels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.project_id = channels.project_id
            AND team_members.user_id = auth.uid()
        )
    );

-- Only project creators can manage channels
CREATE POLICY "Creators can manage channels" ON public.channels
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = channels.project_id
            AND projects.creator_id = auth.uid()
        )
    );

-- 6. RLS Policies for Messages
-- Team members can read messages in channels they have access to
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

-- Team members can send messages to channels they have access to
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

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE
    USING (auth.uid() = user_id);

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
