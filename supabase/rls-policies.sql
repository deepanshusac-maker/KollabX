-- Row Level Security (RLS) Policies for KollabX
-- Idempotent: safe to run multiple times (drops before re-creating)

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON projects;
CREATE POLICY "Public projects are viewable by everyone"
  ON projects FOR SELECT
  USING (visibility = 'public' OR creator_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update own projects" ON projects;
CREATE POLICY "Creators can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete own projects" ON projects;
CREATE POLICY "Creators can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================
-- APPLICATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own applications" ON applications;
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  USING (applicant_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM projects 
           WHERE projects.id = applications.project_id 
           AND projects.creator_id = auth.uid()
         ));

DROP POLICY IF EXISTS "Authenticated users can create applications" ON applications;
CREATE POLICY "Authenticated users can create applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Creators can update applications for their projects" ON applications;
CREATE POLICY "Creators can update applications for their projects"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = applications.project_id 
      AND projects.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can delete own applications" ON applications;
CREATE POLICY "Applicants can delete own applications"
  ON applications FOR DELETE
  USING (applicant_id = auth.uid() AND status = 'pending');

-- ============================================
-- TEAM MEMBERS POLICIES
-- ============================================

-- Helper function to check team membership (bypasses RLS to avoid circular reference)
DROP FUNCTION IF EXISTS is_team_member(uuid, uuid);
CREATE OR REPLACE FUNCTION is_team_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Team members can view team" ON team_members;
CREATE POLICY "Team members can view team"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    is_team_member(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Creators can add team members" ON team_members;
CREATE POLICY "Creators can add team members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = team_members.project_id
      AND projects.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators can remove team members" ON team_members;
CREATE POLICY "Creators can remove team members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = team_members.project_id
      AND projects.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can leave teams" ON team_members;
CREATE POLICY "Users can leave teams"
  ON team_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- System can create notifications (via SECURITY DEFINER triggers)
-- Users can only insert notifications targeting themselves
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- MATCHES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own matches" ON matches;
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create matches" ON matches;
CREATE POLICY "System can create matches"
  ON matches FOR INSERT
  WITH CHECK (true);

-- Restricted to match owner
DROP POLICY IF EXISTS "System can update matches" ON matches;
CREATE POLICY "System can update matches"
  ON matches FOR UPDATE
  USING (user_id = auth.uid());

-- Restricted to match owner
DROP POLICY IF EXISTS "System can delete matches" ON matches;
CREATE POLICY "System can delete matches"
  ON matches FOR DELETE
  USING (user_id = auth.uid());
