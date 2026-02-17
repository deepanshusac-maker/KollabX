# Authentication Setup Instructions

## ✅ What's Been Implemented

The authentication system is now set up with the following features:

1. **Supabase Client** (`js/supabase.js`)
   - Client initialization
   - Helper functions for auth state

2. **Authentication Functions** (`js/auth.js`)
   - Sign up
   - Sign in
   - Sign out
   - **Sign in with Google** (OAuth)
   - Password reset
   - Session management

3. **Session Management** (`js/session.js`)
   - Auth state initialization
   - User menu in navigation
   - Protected routes
   - Auto-redirect after login

4. **Updated Pages**
   - `signin.html` - Full authentication flow
   - All pages - Auth state in navigation
   - Protected routes (dashboard, profile, post)

---

## 🚀 Setup Steps

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: KollabX (or your choice)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Wait for project to be created (2-3 minutes)

### Step 2: Get Your API Keys

1. In your Supabase project dashboard
2. Go to **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### Step 3: Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Wait for success message

### Step 4: Set Up Security Policies

1. Still in **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `supabase/rls-policies.sql`
4. Click **Run**
5. Verify all policies are created

### Step 5: Configure Frontend

1. Open `js/supabase.js`
2. Replace these lines:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. With your actual values:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

### Step 6: Enable Email Auth (Optional but Recommended)

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize welcome email, password reset, etc.

### Step 7: Enable Sign in with Google

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to expand
3. Toggle **Enable Sign in with Google** to ON
4. Create Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project or select existing → **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: e.g. "KollabX"
   - **Authorized JavaScript origins**: add your site URLs, e.g.:
     - `http://localhost:5500` (or your local dev URL)
     - `https://yourdomain.com`
   - **Authorized redirect URIs**: add Supabase callback URL:
     - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
     - (Find YOUR_PROJECT_REF in Supabase **Settings** → **API** → Project URL)
5. Copy **Client ID** and **Client Secret** from Google
6. Paste them into Supabase **Google** provider (Client ID, Client Secret)
7. Click **Save**

### Step 8: Test Authentication

1. Open `signin.html` in your browser
2. Try signing up with a test email
3. Check your email for verification link (if email confirmation is enabled)
4. Sign in with your credentials
5. Or click **Continue with Google** to sign in with Google
6. You should see your name in the navigation menu

---

## 🔒 Protected Routes

These pages require authentication:
- `/dashboard.html` - Redirects to signin if not logged in
- `/profile.html` - Redirects to signin if not logged in
- `/post.html` - Redirects to signin if not logged in

Public pages:
- `/index.html` - Landing page
- `/explore.html` - Browse projects (public)
- `/signin.html` - Auth pages

---

## 🎨 User Menu Features

When logged in, users will see:
- **Avatar/Initial** - Profile picture or first letter
- **Name** - User's full name
- **Dropdown Menu**:
  - Profile
  - Dashboard
  - Portfolio
  - Sign Out

---

## 🔧 Troubleshooting

### "Supabase not initialized" Error
- Make sure `js/supabase.js` is loaded before other scripts
- Check that you've added your API keys

### "Invalid API key" Error
- Verify your Supabase URL and anon key are correct
- Make sure you copied the **anon public** key, not the service role key

### Email Not Sending
- Check Supabase **Authentication** → **Providers** → **Email**
- Verify email is enabled
- Check spam folder
- For development, you can disable email confirmation in Auth settings

### Database Errors
- Make sure you ran `schema.sql` first
- Then run `rls-policies.sql`
- Check SQL Editor for any error messages

### User Menu Not Showing
- Check browser console for errors
- Verify `js/session.js` is loaded
- Make sure user is actually logged in

---

## 📝 Next Steps

After authentication is working:

1. **Profile Management**
   - Update `profile.html` to save to database
   - Add avatar upload functionality

2. **Projects**
   - Update `post.html` to save projects
   - Update `explore.html` to fetch projects

3. **Applications**
   - Add application system
   - Real-time notifications

4. **Teams**
   - Team management
   - Member management

---

## 🔐 Security Notes

- **Never commit** your Supabase service role key
- The anon key is safe to use in frontend (it's public)
- RLS policies protect your data
- Always validate data on the server side
- Use environment variables for production

---

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## ✅ Checklist

- [ ] Supabase project created
- [ ] Database schema created
- [ ] RLS policies set up
- [ ] API keys added to `js/supabase.js`
- [ ] Google OAuth configured (optional)
- [ ] Test sign up works
- [ ] Test sign in works
- [ ] Test sign in with Google works
- [ ] Test logout works
- [ ] User menu appears when logged in
- [ ] Protected routes redirect correctly

---

**Need Help?** Check the Supabase dashboard logs or browser console for detailed error messages.
