// Notifications Management
// Fetch and display notification count with real-time updates

let notificationSubscription = null;
let notificationDropdownEl = null;
let isNotificationDropdownOpen = false;

async function getNotificationCount() {
  try {
    const supabase = window.supabase;
    if (!supabase) {
      return 0;
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) {
      return 0;
    }

    // Get unread notification count
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
}

async function updateNotificationBadge() {
  const badges = document.querySelectorAll('.notification-badge');
  if (badges.length === 0) return;

  const count = await getNotificationCount();

  badges.forEach(badge => {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  });

  // Update aria-label on notification icon
  const notificationIcons = document.querySelectorAll('.notification-icon');
  notificationIcons.forEach(icon => {
    if (count > 0) {
      icon.setAttribute('aria-label', `Notifications (${count} unread)`);
    } else {
      icon.setAttribute('aria-label', 'Notifications');
    }
  });
}

// Helper: format relative time for notification timestamps
function formatNotificationTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

// Helper: map notification type to icon
function getNotificationIconName(type) {
  const icons = {
    application_received: 'user-plus',
    application_accepted: 'check-circle-2',
    application_rejected: 'x-circle',
    team_member_added: 'users',
    project_update: 'message-square',
    project_created: 'rocket'
  };
  return icons[type] || 'bell';
}

// Helper: escape HTML
function escapeNotificationText(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Create or get dropdown element
function ensureNotificationDropdown() {
  if (notificationDropdownEl) return notificationDropdownEl;

  const navRight = document.querySelector('.nav-right');
  if (!navRight) return null;

  const dropdown = document.createElement('div');
  dropdown.className = 'notification-dropdown';
  dropdown.innerHTML = `
    <div class="notification-dropdown-header">
      <span class="notification-dropdown-header-title">Notifications</span>
      <button type="button" class="notification-dropdown-header-action" data-action="mark-all-read">
        Mark all as read
      </button>
    </div>
    <div class="notification-dropdown-body">
      <div class="notification-dropdown-empty">Loading notifications...</div>
      <div class="notification-dropdown-list"></div>
    </div>
    <div class="notification-dropdown-footer">
      <a href="notifications.html">Open full inbox</a>
    </div>
  `;

  navRight.appendChild(dropdown);
  notificationDropdownEl = dropdown;
  return dropdown;
}

// Render dropdown content
async function renderNotificationDropdown() {
  const dropdown = ensureNotificationDropdown();
  if (!dropdown) return;

  const emptyEl = dropdown.querySelector('.notification-dropdown-empty');
  const listEl = dropdown.querySelector('.notification-dropdown-list');
  if (!emptyEl || !listEl) return;

  emptyEl.textContent = 'Loading notifications...';
  listEl.innerHTML = '';

  const result = await getAllNotifications();
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    emptyEl.textContent = 'No notifications yet. You’ll see updates here when something changes.';
    return;
  }

  emptyEl.textContent = '';

  listEl.innerHTML = result.data
    .map((n) => {
      const timeAgo = formatNotificationTime(n.created_at);
      const iconName = getNotificationIconName(n.type);
      const unreadClass = n.read ? '' : ' notification-dropdown-item-unread';

      return `
        <div class="notification-dropdown-item${unreadClass}" data-notification-id="${n.id}" data-notification-link="${n.link || ''}">
          <div class="notification-dropdown-item-icon">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="notification-dropdown-item-content">
            <div class="notification-dropdown-item-title">${escapeNotificationText(n.title)}</div>
            <div class="notification-dropdown-item-message">${escapeNotificationText(n.message)}</div>
            <div class="notification-dropdown-item-meta">${timeAgo}</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Initialize icons
  if (window.lucide) {
    try {
      window.lucide.createIcons();
    } catch (e) {
      console.warn('Error initializing lucide icons in notifications dropdown:', e);
    }
  }

  // Item click handlers
  listEl.querySelectorAll('.notification-dropdown-item').forEach((item) => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = item.getAttribute('data-notification-id');
      const link = item.getAttribute('data-notification-link');

      if (id) {
        await markNotificationAsRead(id);
        item.classList.remove('notification-dropdown-item-unread');
      }

      if (link) {
        window.location.href = link;
      }
    });
  });

  // Mark all as read
  const markAllBtn = dropdown.querySelector('[data-action="mark-all-read"]');
  if (markAllBtn) {
    markAllBtn.onclick = async (e) => {
      e.stopPropagation();
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        dropdown
          .querySelectorAll('.notification-dropdown-item-unread')
          .forEach((el) => el.classList.remove('notification-dropdown-item-unread'));
      } else if (window.toast) {
        window.toast.error(result.error || 'Failed to mark all as read.');
      }
    };
  }
}

async function openNotificationDropdown() {
  const dropdown = ensureNotificationDropdown();
  if (!dropdown) return;

  // Require auth for notifications
  const user = await window.authHelpers.getCurrentUser().catch(() => null);
  if (!user) {
    if (window.toast) window.toast.info('Sign in to see your notifications.');
    setTimeout(() => {
      window.location.href = 'signin.html';
    }, 400);
    return;
  }

  await renderNotificationDropdown();
  dropdown.classList.add('open');
  isNotificationDropdownOpen = true;
}

function closeNotificationDropdown() {
  if (!notificationDropdownEl) return;
  notificationDropdownEl.classList.remove('open');
  isNotificationDropdownOpen = false;
}

async function toggleNotificationDropdown() {
  if (isNotificationDropdownOpen) {
    closeNotificationDropdown();
  } else {
    await openNotificationDropdown();
  }
}

// Set up real-time subscription for notifications
async function setupNotificationSubscription() {
  try {
    const supabase = window.supabase;
    if (!supabase) {
      return;
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) {
      return;
    }

    // Unsubscribe from existing subscription if any
    if (notificationSubscription) {
      await supabase.removeChannel(notificationSubscription);
    }

    // Record when we subscribed — ignore any INSERT events from before this time
    // (Supabase real-time may replay recent events when the subscription first connects)
    const subscriptionSetupTime = Date.now();

    // Subscribe to notifications for this user
    notificationSubscription = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Notification change:', payload);
          // Update badge when notifications change
          updateNotificationBadge();

          // Only show toast for genuinely new notifications (created after subscription started)
          if (payload.eventType === 'INSERT' && payload.new) {
            const n = payload.new;
            const notifCreatedAt = n.created_at ? new Date(n.created_at).getTime() : 0;
            const isGenuinelyNew = notifCreatedAt > subscriptionSetupTime - 3000;

            if (isGenuinelyNew && window.toast) {
              const title = n.title || 'New notification';
              window.toast.info(title);
            }
            if (isNotificationDropdownOpen) {
              renderNotificationDropdown();
            }
          }
        }
      )
      .subscribe();

  } catch (error) {
    console.error('Error setting up notification subscription:', error);
  }
}

// Get all notifications for current user
async function getAllNotifications() {
  try {
    const supabase = window.supabase;
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized', data: [] };
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not logged in', data: [] };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  try {
    const supabase = window.supabase;
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not logged in' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) throw error;

    // Update badge after marking as read
    await updateNotificationBadge();

    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
  try {
    const supabase = window.supabase;
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not logged in' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    // Update badge after marking all as read
    await updateNotificationBadge();

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
}

// Initialize notification badge and dropdown on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Small delay to ensure auth has had a chance to initialize elsewhere
  setTimeout(async () => {
    await updateNotificationBadge();
    await setupNotificationSubscription();

    // Hook up dropdown toggling on bell icon
    const icons = document.querySelectorAll('.notification-icon');
    icons.forEach((icon) => {
      icon.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await toggleNotificationDropdown();
      });
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!isNotificationDropdownOpen) return;
      if (e.target.closest('.notification-dropdown') || e.target.closest('.notification-icon')) {
        return;
      }
      closeNotificationDropdown();
    });
  }, 500);
});

// Clean up subscription on page unload
window.addEventListener('beforeunload', async () => {
  if (notificationSubscription && window.supabase) {
    await window.supabase.removeChannel(notificationSubscription);
  }
});

// Export functions
window.notifications = {
  getNotificationCount,
  updateNotificationBadge,
  getAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  setupNotificationSubscription
};
