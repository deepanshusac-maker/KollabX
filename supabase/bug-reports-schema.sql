-- Bug Reports Table for KollabX
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'bug' CHECK (category IN ('bug', 'feature_request', 'ui_issue', 'other')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can submit a bug report" ON public.bug_reports;
CREATE POLICY "Anyone can submit a bug report" 
ON public.bug_reports FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own bug reports" ON public.bug_reports;
CREATE POLICY "Users can view their own bug reports" 
ON public.bug_reports FOR SELECT 
USING (auth.uid() = reporter_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON public.bug_reports;
CREATE TRIGGER update_bug_reports_updated_at BEFORE UPDATE ON public.bug_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for status and priority
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter ON public.bug_reports(reporter_id);
