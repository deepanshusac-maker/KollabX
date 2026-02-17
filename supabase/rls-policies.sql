-- Row Level Security (RLS) Policies for KollabX
-- Run this after creating the schema

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

-- Anyone can read profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (via trigger, but policy needed)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Anyone can read public projects
CREATE POLICY "Public projects are viewable by everyone"
  ON projects FOR SELECT
  USING (visibility = 'public' OR creator_id = auth.uid());

-- Authenticated users can create projects
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Project creators can update their projects
CREATE POLICY "Creators can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = creator_id);

-- Project creators can delete their projects
CREATE POLICY "Creators can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================
-- APPLICATIONS POLICIES
-- ============================================

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  USING (applicant_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM projects 
           WHERE projects.id = applications.project_id 
           AND projects.creator_id = auth.uid()
         ));

-- Authenticated users can create applications
CREATE POLICY "Authenticated users can create applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

-- Project creators can update applications for their projects
CREATE POLICY "Creators can update applications for their projects"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = applications.project_id 
      AND projects.creator_id = auth.uid()
    )
  );

-- Applicants can cancel their own applications
CREATE POLICY "Applicants can delete own applications"
  ON applications FOR DELETE
  USING (applicant_id = auth.uid() AND status = 'pending');

-- ============================================
-- TEAM MEMBERS POLICIES
-- ============================================

-- Team members can view team members for projects they're part of
CREATE POLICY "Team members can view team"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.project_id = team_members.project_id
      AND tm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = team_members.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- Project creators can add team members
CREATE POLICY "Creators can add team members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = team_members.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- Project creators can remove team members
CREATE POLICY "Creators can remove team members"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = team_members.project_id
      AND projects.creator_id = auth.uid()
    )
  );

-- Users can leave teams themselves
CREATE POLICY "Users can leave teams"
  ON team_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- System can create notifications (via triggers)
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- MATCHES POLICIES
-- ============================================

-- Users can view their own matches
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  USING (user_id = auth.uid());

-- System can create matches
CREATE POLICY "System can create matches"
  ON matches FOR INSERT
  WITH CHECK (true);
