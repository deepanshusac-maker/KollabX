// Supabase Client Initialization
// IMPORTANT: Replace these with your actual Supabase project credentials
// Get them from: https://app.supabase.com/project/_/settings/api

const SUPABASE_URL = 'https://ssoqnnokeuxznfdyihob.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_EI2rbwU-KWMHEb-hvWi5Nw_xiwBbToc'; // Public anon key

// Initialize Supabase client (supabase is loaded from CDN)
let supabaseClient = null;

// Wait for supabase to be loaded from CDN
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = supabaseClient;
} else {
  // If supabase isn't loaded yet, wait for it
  window.addEventListener('DOMContentLoaded', () => {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabase = supabaseClient;
    } else {
      console.error('Supabase library not loaded. Make sure to include the Supabase CDN script before this file.');
    }
  });
}

// Helper function to check if user is authenticated
const isAuthenticated = async () => {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Helper function to get current user
const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Helper function to get current user's profile
const getCurrentProfile = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
};

// Export functions for use in other files
window.authHelpers = {
  isAuthenticated,
  getCurrentUser,
  getCurrentProfile,
  supabase: supabaseClient
};
