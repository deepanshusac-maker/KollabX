// Authentication Functions for KollabX
// Make sure supabase.js is loaded before this file

// Wait for Supabase to be ready
function ensureSupabase() {
  if (!window.supabase) {
    throw new Error('Supabase client not initialized. Make sure supabase.js is loaded first.');
  }
  return window.supabase;
}

// Helper to check if email is NITP domain
function isNITPEmail(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@nitp.ac.in');
}

// Sign up with email and password
async function signUp(email, password, fullName) {
  try {
    if (!isNITPEmail(email)) {
      throw new Error('Only @nitp.ac.in emails are allowed to join KollabX.');
    }
    const supabase = ensureSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) throw error;

    // Profile will be created automatically by database trigger
    return { success: true, data };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with email and password
async function signIn(email, password) {
  try {
    if (!isNITPEmail(email)) {
      throw new Error('Only @nitp.ac.in emails are allowed.');
    }
    const supabase = ensureSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
}

// Sign out
async function signOut() {
  try {
    const supabase = ensureSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear any local storage
    localStorage.removeItem('userProfile');

    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

// Reset password
async function resetPassword(email) {
  try {
    if (!isNITPEmail(email)) {
      throw new Error('Please enter your @nitp.ac.in email address.');
    }
    const supabase = ensureSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/signin.html`
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

// Get current session
async function getSession() {
  try {
    const supabase = ensureSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { success: true, session };
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with Google (OAuth)
async function signInWithGoogle() {
  try {
    const supabase = ensureSupabase();
    // Store that this is a new sign-in attempt
    sessionStorage.setItem('google_signin_attempt', 'true');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/signin.html`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          hd: 'nitp.ac.in' // Hint for Google to only show NITP accounts
        }
      }
    });

    if (error) throw error;

    // Redirect to Google OAuth page
    if (data?.url) {
      window.location.href = data.url;
      return { success: true, redirecting: true };
    }

    return { success: false, error: 'Could not get Google sign-in URL' };
  } catch (error) {
    console.error('Google sign-in error:', error);
    return { success: false, error: error.message };
  }
}

// Check if user is authenticated
async function checkAuth() {
  const result = await getSession();
  const session = result.session;

  if (session && session.user) {
    const email = session.user.email;
    if (!isNITPEmail(email)) {
      console.warn('Unauthorized email domain detected. Signing out.', email);
      await signOut();
      return false;
    }
    return true;
  }

  return false;
}

// Check if profile is complete (has required fields)
async function isProfileComplete() {
  try {
    const profile = await window.authHelpers.getCurrentProfile();
    if (!profile) return false;

    // Check if required fields are filled
    const requiredFields = ['full_name', 'college', 'bio', 'skills'];
    return requiredFields.every(field => {
      const value = profile[field];
      return value && value.toString().trim() !== '' &&
        (Array.isArray(value) ? value.length > 0 : true);
    });
  } catch (error) {
    console.error('Error checking profile completion:', error);
    return false;
  }
}

// Check if user is new (just signed up)
function isNewUser(session) {
  if (!session) return false;

  // Handle both direct session and wrapped session
  const actualSession = session.session || session;
  if (!actualSession || !actualSession.user) return false;

  // Check if user was created recently (within last 5 minutes)
  const createdAt = new Date(actualSession.user.created_at);
  const now = new Date();
  const minutesSinceCreation = (now - createdAt) / (1000 * 60);

  return minutesSinceCreation < 5;
}

// Listen to auth state changes
function onAuthStateChange(callback) {
  const supabase = ensureSupabase();
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// Export functions
window.auth = {
  signUp,
  signIn,
  signOut,
  signInWithGoogle,
  resetPassword,
  getSession,
  checkAuth,
  isProfileComplete,
  isNewUser,
  onAuthStateChange
};