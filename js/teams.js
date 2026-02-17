// Teams Management Operations
// Make sure supabase.js and auth.js are loaded before this file

// Helper function to ensure Supabase is ready
function ensureSupabase() {
  if (!window.supabase) {
    throw new Error('Supabase client not initialized. Make sure supabase.js is loaded first.');
  }
  return window.supabase;
}

// Get team members for a project
async function getTeamMembers(projectId) {
  try {
    const supabase = ensureSupabase();
    
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profile:profiles!team_members_user_id_fkey(
          id,
          full_name,
          avatar_url,
          bio,
          skills,
          github_url,
          linkedin_url
        )
      `)
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get team members error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Get user's teams (all projects user is part of)
async function getUserTeams(userId = null) {
  try {
    const supabase = ensureSupabase();
    const user = userId ? { id: userId } : await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in', data: [] };
    }

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        project:projects!team_members_project_id_fkey(
          id,
          title,
          category,
          description,
          creator_id,
          current_members,
          team_size,
          status,
          created_at,
          creator:profiles!projects_creator_id_fkey(full_name, avatar_url)
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get user teams error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Remove team member (creator only)
async function removeTeamMember(projectId, userIdToRemove) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Verify user is the project creator
    const { data: project } = await supabase
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single();

    if (!project || project.creator_id !== user.id) {
      return { success: false, error: 'Only the project creator can remove team members' };
    }

    // Can't remove the creator
    if (userIdToRemove === project.creator_id) {
      return { success: false, error: 'Cannot remove the project creator' };
    }

    // Remove from team_members (trigger will update current_members count)
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userIdToRemove);

    if (error) throw error;

    // Create notification for removed member
    await supabase
      .from('notifications')
      .insert({
        user_id: userIdToRemove,
        type: 'team_member_removed',
        title: 'Removed from Team',
        message: `You have been removed from the project "${project.title}".`,
        link: '/dashboard.html?tab=teams'
      });

    return { success: true };
  } catch (error) {
    console.error('Remove team member error:', error);
    return { success: false, error: error.message };
  }
}

// Leave team (member leaves themselves)
async function leaveTeam(projectId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Verify user is a team member
    const { data: member } = await supabase
      .from('team_members')
      .select('project_id, user_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return { success: false, error: 'You are not a member of this team' };
    }

    // Get project info for notification
    const { data: project } = await supabase
      .from('projects')
      .select('id, title, creator_id')
      .eq('id', projectId)
      .single();

    // Can't leave if you're the creator
    if (project && project.creator_id === user.id) {
      return { success: false, error: 'Project creators cannot leave their own project. Delete the project instead.' };
    }

    // Remove from team_members (trigger will update current_members count)
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    if (error) throw error;

    // Create notification for project creator
    if (project) {
      await supabase
        .from('notifications')
        .insert({
          user_id: project.creator_id,
          type: 'team_member_left',
          title: 'Team Member Left',
          message: `${user.email?.split('@')[0] || 'A member'} left the project "${project.title}".`,
          link: `/dashboard.html?tab=teams`
        });
    }

    return { success: true };
  } catch (error) {
    console.error('Leave team error:', error);
    return { success: false, error: error.message };
  }
}

// Check if user is team member
async function isTeamMember(projectId, userId = null) {
  try {
    const supabase = ensureSupabase();
    const user = userId ? { id: userId } : await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return false;
    }

    const { data } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

// Check if user is project creator
async function isProjectCreator(projectId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return false;
    }

    const { data: project } = await supabase
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single();

    return project && project.creator_id === user.id;
  } catch (error) {
    return false;
  }
}

// Export functions
window.teams = {
  getTeamMembers,
  getUserTeams,
  removeTeamMember,
  leaveTeam,
  isTeamMember,
  isProjectCreator
};
