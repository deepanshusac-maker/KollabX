// Session Management and Auth State

// Initialize auth state on page load
async function initAuth() {
  try {
    // Show loading state immediately
    showAuthLoading();

    // Wait for Supabase to be ready
    if (!window.supabase) {
      // Wait a bit for scripts to load
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!window.supabase) {
        console.warn('Supabase not initialized. Make sure to include supabase.js before this script.');
        // Show sign in button as fallback
        updateAuthUI(null);
        return;
      }
    }

    // Listen to auth state changes (only set up once)
    if (!window.supabase._authStateChangeListenerSet) {
      window.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session ? 'User logged in' : 'User logged out');

        // Update UI based on auth state
        updateAuthUI(session);

        // Store session info
        if (session) {
          localStorage.setItem('auth_session', JSON.stringify({
            user: session.user,
            expires_at: session.expires_at
          }));
        } else {
          localStorage.removeItem('auth_session');
        }
      });
      window.supabase._authStateChangeListenerSet = true;
    }

    // Check current session
    const { data: { session }, error } = await window.supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
    }
    updateAuthUI(session);

    return session;
  } catch (error) {
    console.error('Error initializing auth:', error);
    // Show sign in button on error
    updateAuthUI(null);
    return null;
  }
}

// Show loading state in navigation (hide existing auth UI without removing it)
function showAuthLoading() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  // Instead of removing elements (which causes layout shift),
  // just hide them visually — preserving their space in the layout
  const existingAuthBtns = navRight.querySelectorAll('.btn-signin, .btn-logout, .user-menu');
  existingAuthBtns.forEach(btn => {
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
    btn.dataset.authHidden = 'true';
  });
}

// Track if updateAuthUI is currently running to prevent duplicate calls
let isUpdatingAuthUI = false;

// Update navigation UI based on auth state
async function updateAuthUI(session) {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  // Prevent multiple simultaneous calls
  if (isUpdatingAuthUI) {
    return;
  }
  isUpdatingAuthUI = true;

  try {
    // Show/hide auth-only nav items
    const authOnlyNavItems = document.querySelectorAll('.nav-item-auth-only');

    if (session && session.user) {
      // User is logged in
      authOnlyNavItems.forEach(item => { item.style.display = 'list-item'; });

      // Remove the hidden Sign In btn (it will be replaced by user menu)
      const existingSignIn = navRight.querySelectorAll('.btn-signin, .btn-logout, .user-menu, .auth-loading');
      existingSignIn.forEach(btn => {
        if (btn._closeHandler) {
          document.removeEventListener('click', btn._closeHandler);
          delete btn._closeHandler;
        }
        btn.remove();
      });

      // Insert user menu
      try {
        const profile = await window.authHelpers.getCurrentProfile();
        const rawName = profile?.full_name || session.user.email?.split('@')[0] || 'User';
        // Use first name only and trim length so navbar stays clean
        const firstName = rawName.split(' ')[0] || rawName;
        const displayName = firstName.length > 12 ? firstName.slice(0, 11) + '…' : firstName;
        const avatarUrl = profile?.avatar_url ? `${profile.avatar_url}?t=${new Date().getTime()}` : null;
        const userMenu = createUserMenu(displayName, avatarUrl);
        navRight.insertBefore(userMenu, navRight.firstChild);
      } catch (error) {
        console.error('Error loading user profile:', error);
        const logoutBtn = createLogoutButton();
        navRight.insertBefore(logoutBtn, navRight.firstChild);
      }
    } else {
      // User is not logged in
      authOnlyNavItems.forEach(item => { item.style.display = 'none'; });

      // Try to restore any hidden btn-signin (from showAuthLoading) without DOM removal
      const existingSignIn = navRight.querySelector('.btn-signin[data-auth-hidden]');
      if (existingSignIn) {
        existingSignIn.style.opacity = '';
        existingSignIn.style.pointerEvents = '';
        delete existingSignIn.dataset.authHidden;
      } else {
        // Only create a new one if none exists
        const alreadyExists = navRight.querySelector('.btn-signin');
        if (!alreadyExists) {
          // Remove any stale user menus first
          navRight.querySelectorAll('.btn-logout, .user-menu, .auth-loading').forEach(el => el.remove());
          const signInBtn = document.createElement('a');
          signInBtn.href = 'signin.html';
          signInBtn.className = 'btn-signin';
          signInBtn.textContent = 'Sign In';
          navRight.appendChild(signInBtn);
        } else {
          // Restore any hidden sign-in button
          alreadyExists.style.opacity = '';
          alreadyExists.style.pointerEvents = '';
        }
      }
    }
  } finally {
    isUpdatingAuthUI = false;
  }
}

// Create user menu dropdown
function createUserMenu(userName, avatarUrl) {
  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  userMenu.innerHTML = `
    <button class="user-menu-btn" aria-label="User menu" aria-expanded="false">
      ${avatarUrl ? `<img src="${avatarUrl}" alt="${userName}" class="user-avatar" crossorigin="anonymous">` : `<div class="user-avatar-placeholder">${userName.charAt(0).toUpperCase()}</div>`}
      <span class="user-name">${userName}</span>
      <i data-lucide="chevron-down" class="chevron-icon"></i>
    </button>
    <div class="user-menu-dropdown">
      <a href="profile.html" class="user-menu-item">
        <i data-lucide="user"></i>
        <span>Profile</span>
      </a>
      <a href="dashboard.html" class="user-menu-item">
        <i data-lucide="layout-dashboard"></i>
        <span>Dashboard</span>
      </a>
      <a href="portfolio.html" class="user-menu-item">
        <i data-lucide="briefcase"></i>
        <span>Portfolio</span>
      </a>
      <div class="user-menu-divider"></div>
      <button class="user-menu-item logout-btn">
        <i data-lucide="log-out"></i>
        <span>Sign Out</span>
      </button>
    </div>
  `;

  // Add click handler for dropdown toggle
  const menuBtn = userMenu.querySelector('.user-menu-btn');
  const dropdown = userMenu.querySelector('.user-menu-dropdown');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', !isExpanded);
    dropdown.classList.toggle('active');
  });

  // Close dropdown when clicking outside (use a unique handler)
  const closeHandler = (e) => {
    if (!userMenu.contains(e.target)) {
      menuBtn.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('active');
    }
  };

  // Store handler on the menu element so we can remove it later if needed
  userMenu._closeHandler = closeHandler;
  document.addEventListener('click', closeHandler);

  // Logout handler
  const logoutBtn = userMenu.querySelector('.logout-btn');
  logoutBtn.addEventListener('click', async () => {
    await handleLogout();
  });

  // Initialize Lucide icons
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 100);
  }

  return userMenu;
}

// Create simple logout button (fallback)
function createLogoutButton() {
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-signin';
  logoutBtn.textContent = 'Sign Out';
  logoutBtn.addEventListener('click', handleLogout);
  return logoutBtn;
}

// Handle logout
async function handleLogout() {
  try {
    const result = await window.auth.signOut();
    if (result.success) {
      // Redirect to home page
      window.location.href = 'index.html';
    } else {
      console.error('Logout error:', result.error);
      alert('Failed to sign out. Please try again.');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('An error occurred during sign out.');
  }
}

// Check if route requires authentication
async function requireAuth(redirectTo = 'signin.html') {
  const isAuth = await window.auth.checkAuth();
  if (!isAuth) {
    // Store intended destination
    sessionStorage.setItem('redirect_after_login', window.location.pathname);
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// Get redirect destination after login
async function getRedirectAfterLogin(defaultPath = 'dashboard.html') {
  // Check if there's a stored redirect
  const redirect = sessionStorage.getItem('redirect_after_login');
  if (redirect) {
    sessionStorage.removeItem('redirect_after_login');
    return redirect;
  }

  // Only redirect to profile for brand-new sign-ups
  const isNewUser = sessionStorage.getItem('is_new_user');
  if (isNewUser === 'true') {
    sessionStorage.removeItem('is_new_user');
    return 'profile.html?onboarding=true';
  }

  return defaultPath;
}

// Export functions
window.session = {
  initAuth,
  updateAuthUI,
  requireAuth,
  getRedirectAfterLogin,
  handleLogout
};
