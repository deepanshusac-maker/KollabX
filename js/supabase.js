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

// Use client from window if our ref is not set yet (script load order)
function getSupabase() {
  return window.supabase || supabaseClient;
}

// Helper function to check if user is authenticated
const isAuthenticated = async () => {
  try {
    const client = getSupabase();
    if (!client) return false;
    const { data: { session } } = await client.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Helper function to get current user
const getCurrentUser = async () => {
  try {
    const client = getSupabase();
    if (!client) return null;

    // Use getSession first to avoid console noise if no session exists
    const { data: { session } } = await client.auth.getSession();
    if (!session) return null;

    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    // Only log if it's not a simple missing session
    if (error.name !== 'AuthSessionMissingError') {
      console.error('Error getting current user:', error);
    }
    return null;
  }
};

// Helper function to get current user's profile
const getCurrentProfile = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client
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

// Sanitize a URL to prevent XSS when interpolated into innerHTML.
// Returns the sanitized href or null if invalid / non-http(s).
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// Escape a string for safe use inside an HTML attribute value.
// Prevents breaking out of src="..." or alt="..." contexts.
function sanitizeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Export functions for use in other files
window.authHelpers = {
  isAuthenticated,
  getCurrentUser,
  getCurrentProfile,
  sanitizeUrl,
  sanitizeAttr,
  supabase: supabaseClient
};
