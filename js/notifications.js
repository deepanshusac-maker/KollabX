// Notifications Management
// Fetch and display notification count with real-time updates

let notificationSubscription = null;

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

// Initialize notification badge on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for auth to initialize
  if (window.session) {
    await window.session.initAuth();
  }
  
  // Small delay to ensure user is loaded
  setTimeout(async () => {
    await updateNotificationBadge();
    // Set up real-time subscription
    await setupNotificationSubscription();
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
