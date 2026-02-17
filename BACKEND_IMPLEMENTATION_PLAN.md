# Backend Implementation Plan - KollabX with Supabase

## Why Supabase? ✅

**Supabase Advantages:**
- ✅ PostgreSQL database (perfect for relational data)
- ✅ Built-in authentication (email, OAuth)
- ✅ Real-time subscriptions (notifications, updates)
- ✅ Row Level Security (RLS) for data protection
- ✅ Storage for profile pictures and project images
- ✅ Free tier: 500MB database, 1GB storage, 2GB bandwidth
- ✅ Open source (less vendor lock-in)
- ✅ Better for complex queries and relationships

**vs Firebase:**
- Firebase is NoSQL (less ideal for relational data)
- More expensive as you scale
- Stronger vendor lock-in
- Less flexible for complex queries

---

## Database Schema Design

### 1. **profiles** table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  college TEXT,
  bio TEXT,
  skills TEXT[], -- Array of skills
  interests TEXT[],
  github_url TEXT,
  linkedin_url TEXT,
  availability TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. **projects** table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[],
  team_size INTEGER NOT NULL,
  roles_needed TEXT[],
  timeline TEXT,
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'open', -- open, closed, completed
  current_members INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. **applications** table
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, applicant_id)
);
```

### 4. **team_members** table
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
```

### 5. **notifications** table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- application_received, application_accepted, team_update, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL to related page
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. **matches** table (for recommendations)
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  match_score INTEGER, -- 0-100 based on skills/interests
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);
```

---

## Required Features to Implement

### 🔐 Authentication
- [ ] Sign up with email/password
- [ ] Sign in
- [ ] Password reset
- [ ] OAuth (Google, GitHub) - optional
- [ ] Session management
- [ ] Protected routes

### 👤 User Profile
- [ ] Create/update profile
- [ ] Upload avatar image
- [ ] View other users' profiles
- [ ] Profile validation

### 📝 Projects/Posts
- [ ] Create project
- [ ] List all projects (with filters)
- [ ] View project details
- [ ] Update project (creator only)
- [ ] Delete project (creator only)
- [ ] Search projects
- [ ] Filter by category, skills, etc.

### ✉️ Applications
- [ ] Apply to project
- [ ] View applications (for project creator)
- [ ] Accept/reject applications
- [ ] View my applications
- [ ] Cancel application

### 👥 Teams
- [ ] Add member to team (when application accepted)
- [ ] Remove team member
- [ ] View team members
- [ ] Leave team

### 🔔 Notifications
- [ ] Real-time notifications
- [ ] Mark as read
- [ ] Notification count badge
- [ ] Email notifications (optional)

### 🎯 Recommendations
- [ ] Skill-based matching algorithm
- [ ] Show recommended projects
- [ ] Match score calculation

### 🔍 Search & Filter
- [ ] Full-text search
- [ ] Filter by category
- [ ] Filter by skills
- [ ] Sort (latest, popular, etc.)

---

## Implementation Steps

### Phase 1: Setup & Authentication (Week 1)
1. Create Supabase project
2. Set up database schema
3. Configure RLS policies
4. Implement authentication (sign up/in)
5. Add auth state management
6. Protect routes

### Phase 2: Core Features (Week 2)
1. User profiles CRUD
2. Project creation/listing
3. Image upload (avatars, project images)
4. Basic search

### Phase 3: Applications & Teams (Week 3)
1. Application system
2. Team management
3. Notifications (basic)

### Phase 4: Advanced Features (Week 4)
1. Real-time notifications
2. Recommendations algorithm
3. Advanced search/filtering
4. Email notifications

### Phase 5: Polish & Deploy (Week 5)
1. Error handling
2. Loading states
3. Performance optimization
4. Deploy to Vercel/Netlify

---

## Files to Create/Modify

### New Files Needed:
1. `js/supabase.js` - Supabase client initialization
2. `js/auth.js` - Authentication functions
3. `js/db.js` - Database operations
4. `js/realtime.js` - Real-time subscriptions
5. `supabase/migrations/` - Database migrations
6. `.env.example` - Environment variables template

### Files to Modify:
1. All HTML files - Add Supabase integration
2. `signin.html` - Connect to Supabase Auth
3. `profile.html` - Save to database instead of localStorage
4. `post.html` - Save projects to database
5. `explore.html` - Fetch projects from database
6. `dashboard.html` - Fetch user data from database
7. `notifications.html` - Real-time notifications

---

## Security Considerations

### Row Level Security (RLS) Policies Needed:

1. **profiles**: Users can read all, update own
2. **projects**: All can read public, creators can update/delete own
3. **applications**: Users can read own, project creators can read for their projects
4. **team_members**: Team members can read, creators can add/remove
5. **notifications**: Users can only read own notifications

---

## Additional Services Needed

### Required:
- ✅ **Supabase** - Database, Auth, Storage, Real-time
- ✅ **Vercel/Netlify** - Hosting (free)
- ⚠️ **Email Service** (optional) - SendGrid, Resend, or Supabase built-in

### Optional:
- 📧 **Email notifications** - Resend, SendGrid, or Supabase
- 🔍 **Search** - Supabase full-text search or Algolia
- 📊 **Analytics** - Plausible, Posthog, or Google Analytics
- 🐛 **Error tracking** - Sentry

---

## Cost Estimate

### Free Tier (Good for MVP):
- Supabase: Free (500MB DB, 1GB storage, 2GB bandwidth)
- Vercel: Free (unlimited static sites)
- **Total: $0/month**

### Growth Tier (~$25/month):
- Supabase Pro: $25/month (8GB DB, 100GB storage)
- Vercel Pro: Free (if under limits)
- **Total: ~$25/month**

---

## Next Steps

1. **Create Supabase account** at supabase.com
2. **Set up project** and get API keys
3. **Create database schema** using SQL migrations
4. **Set up RLS policies** for security
5. **Integrate Supabase client** into frontend
6. **Implement authentication** first
7. **Migrate localStorage data** to database
8. **Add real-time features**

Would you like me to start implementing the Supabase integration?
