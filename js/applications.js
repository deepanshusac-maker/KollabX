// Applications Database Operations
// Make sure supabase.js and auth.js are loaded before this file

// Helper function to ensure Supabase is ready
function ensureSupabase() {
  if (!window.supabase) {
    throw new Error('Supabase client not initialized. Make sure supabase.js is loaded first.');
  }
  return window.supabase;
}

// Apply to a project
async function applyToProject(projectId, applicationData) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in to apply to projects' };
    }

    // Check if user is the project creator
    const { data: project } = await supabase
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    if (project.creator_id === user.id) {
      return { success: false, error: 'You cannot apply to your own project' };
    }

    // Check if user is already a team member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return { success: false, error: 'You are already a member of this project' };
    }

    // Check if user already applied
    const { data: existingApplication } = await supabase
      .from('applications')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('applicant_id', user.id)
      .single();

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        return { success: false, error: 'You have already applied to this project' };
      } else if (existingApplication.status === 'accepted') {
        return { success: false, error: 'Your application was already accepted' };
      }
    }

    // Create application
    const application = {
      project_id: projectId,
      applicant_id: user.id,
      message: applicationData.message || '',
      role: applicationData.role || null,
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('applications')
      .insert(application)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Apply to project error:', error);
    return { success: false, error: error.message };
  }
}

// Get applications for a project (for project creator)
async function getProjectApplications(projectId) {
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
      return { success: false, error: 'You can only view applications for your own projects' };
    }

    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        applicant:profiles!applications_applicant_id_fkey(
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
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get project applications error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Get user's applications
async function getUserApplications(userId = null) {
  try {
    const supabase = ensureSupabase();
    const user = userId ? { id: userId } : await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        project:projects!applications_project_id_fkey(
          id,
          title,
          category,
          description,
          creator_id,
          current_members,
          team_size,
          status,
          creator:profiles!projects_creator_id_fkey(full_name, avatar_url)
        )
      `)
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get user applications error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Accept an application
async function acceptApplication(applicationId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Get application and verify permissions
    const { data: application } = await supabase
      .from('applications')
      .select(`
        *,
        project:projects!applications_project_id_fkey(
          id,
          creator_id,
          current_members,
          team_size,
          status
        )
      `)
      .eq('id', applicationId)
      .single();

    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    if (application.project.creator_id !== user.id) {
      return { success: false, error: 'You can only accept applications for your own projects' };
    }

    if (application.status !== 'pending') {
      return { success: false, error: 'Application is not pending' };
    }

    if (application.project.current_members >= application.project.team_size) {
      return { success: false, error: 'Project team is already full' };
    }

    // Update application status (trigger will handle adding to team and notification)
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Accept application error:', error);
    return { success: false, error: error.message };
  }
}

// Reject an application
async function rejectApplication(applicationId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Get application and verify permissions
    const { data: application } = await supabase
      .from('applications')
      .select(`
        *,
        project:projects!applications_project_id_fkey(creator_id)
      `)
      .eq('id', applicationId)
      .single();

    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    if (application.project.creator_id !== user.id) {
      return { success: false, error: 'You can only reject applications for your own projects' };
    }

    if (application.status !== 'pending') {
      return { success: false, error: 'Application is not pending' };
    }

    // Update application status
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    // Create notification for applicant
    await supabase
      .from('notifications')
      .insert({
        user_id: application.applicant_id,
        type: 'application_rejected',
        title: 'Application Rejected',
        message: `Your application to "${application.project.title}" was not accepted.`,
        link: '/dashboard.html?tab=applications'
      });

    return { success: true, data };
  } catch (error) {
    console.error('Reject application error:', error);
    return { success: false, error: error.message };
  }
}

// Cancel an application (applicant cancels their own application)
async function cancelApplication(applicationId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Get application and verify ownership
    const { data: application } = await supabase
      .from('applications')
      .select('applicant_id, status')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    if (application.applicant_id !== user.id) {
      return { success: false, error: 'You can only cancel your own applications' };
    }

    if (application.status !== 'pending') {
      return { success: false, error: 'You can only cancel pending applications' };
    }

    // Delete the application
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', applicationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Cancel application error:', error);
    return { success: false, error: error.message };
  }
}

// Get incoming applications (for user's projects)
async function getIncomingApplications() {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in', data: [] };
    }

    // Get user's projects
    const { data: userProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('creator_id', user.id);

    if (!userProjects || userProjects.length === 0) {
      return { success: true, data: [] };
    }

    const projectIds = userProjects.map(p => p.id);

    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        project:projects!applications_project_id_fkey(
          id,
          title,
          category
        ),
        applicant:profiles!applications_applicant_id_fkey(
          id,
          full_name,
          avatar_url,
          bio,
          skills
        )
      `)
      .in('project_id', projectIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get incoming applications error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Export functions
window.applications = {
  applyToProject,
  getProjectApplications,
  getUserApplications,
  acceptApplication,
  rejectApplication,
  cancelApplication,
  getIncomingApplications
};
