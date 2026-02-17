// Projects Database Operations
// Make sure supabase.js and auth.js are loaded before this file

// Helper function to ensure Supabase is ready
function ensureSupabase() {
  if (!window.supabase) {
    throw new Error('Supabase client not initialized. Make sure supabase.js is loaded first.');
  }
  return window.supabase;
}

// Create a new project
async function createProject(projectData) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in to create a project' };
    }

    // Prepare project data
    const skillsArray = projectData.requiredSkills
      ? projectData.requiredSkills.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];
    
    const rolesArray = projectData.rolesNeeded
      ? projectData.rolesNeeded.split(',').map(r => r.trim()).filter(r => r.length > 0)
      : [];

    const project = {
      creator_id: user.id,
      title: projectData.title,
      category: projectData.category,
      description: projectData.description,
      required_skills: skillsArray,
      team_size: parseInt(projectData.teamSize) || 1,
      roles_needed: rolesArray,
      timeline: projectData.timeline || null,
      visibility: projectData.visibility || 'public',
      status: 'open',
      current_members: 1 // Creator is first member
    };

    // Insert project
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (error) throw error;

    // Add creator as team member
    const { error: teamError } = await supabase
      .from('team_members')
      .insert({
        project_id: data.id,
        user_id: user.id,
        role: 'Creator'
      });

    if (teamError) {
      console.error('Error adding creator to team:', teamError);
      // Don't fail the whole operation, just log it
    }

    return { success: true, data };
  } catch (error) {
    console.error('Create project error:', error);
    return { success: false, error: error.message };
  }
}

// Get all public projects
async function getAllProjects(filters = {}) {
  try {
    const supabase = ensureSupabase();
    let query = supabase
      .from('projects')
      .select(`
        *,
        creator:profiles!projects_creator_id_fkey(full_name, avatar_url)
      `)
      .eq('visibility', 'public')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.category && filters.category !== 'All') {
      query = query.eq('category', filters.category);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.skills && filters.skills.length > 0) {
      query = query.contains('required_skills', filters.skills);
    }

    // Apply sorting
    if (filters.sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (filters.sort === 'popular') {
      // Sort by current_members descending (more members = more popular)
      query = query.order('current_members', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get projects error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Get project by ID
async function getProjectById(projectId) {
  try {
    const supabase = ensureSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        creator:profiles!projects_creator_id_fkey(*),
        team_members:team_members(
          user_id,
          role,
          joined_at,
          profile:profiles!team_members_user_id_fkey(full_name, avatar_url, skills)
        )
      `)
      .eq('id', projectId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Get project error:', error);
    return { success: false, error: error.message };
  }
}

// Get user's projects
async function getUserProjects(userId) {
  try {
    const supabase = ensureSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get user projects error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Update project
async function updateProject(projectId, updates) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Check if user is creator
    const { data: project } = await supabase
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single();

    if (!project || project.creator_id !== user.id) {
      return { success: false, error: 'You can only update your own projects' };
    }

    // Prepare updates
    const updateData = { ...updates };
    if (updateData.requiredSkills) {
      updateData.required_skills = updateData.requiredSkills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      delete updateData.requiredSkills;
    }
    if (updateData.rolesNeeded) {
      updateData.roles_needed = updateData.rolesNeeded
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0);
      delete updateData.rolesNeeded;
    }
    if (updateData.teamSize) {
      updateData.team_size = parseInt(updateData.teamSize);
      delete updateData.teamSize;
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Update project error:', error);
    return { success: false, error: error.message };
  }
}

// Delete project
async function deleteProject(projectId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    // Check if user is creator
    const { data: project } = await supabase
      .from('projects')
      .select('creator_id')
      .eq('id', projectId)
      .single();

    if (!project || project.creator_id !== user.id) {
      return { success: false, error: 'You can only delete your own projects' };
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete project error:', error);
    return { success: false, error: error.message };
  }
}

// Calculate match score between user and project
async function calculateMatchScore(userId, projectId) {
  try {
    const supabase = ensureSupabase();
    
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('skills')
      .eq('id', userId)
      .single();

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('required_skills')
      .eq('id', projectId)
      .single();

    if (!profile || !project) {
      return 0;
    }

    const userSkills = profile.skills || [];
    const requiredSkills = project.required_skills || [];

    if (requiredSkills.length === 0) {
      return 50; // Default match if no skills required
    }

    // Calculate match percentage
    const matchingSkills = userSkills.filter(skill => 
      requiredSkills.some(req => 
        req.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(req.toLowerCase())
      )
    );

    const matchScore = Math.round((matchingSkills.length / requiredSkills.length) * 100);
    return Math.min(matchScore, 100);
  } catch (error) {
    console.error('Calculate match score error:', error);
    return 0;
  }
}

// Export functions
window.projects = {
  createProject,
  getAllProjects,
  getProjectById,
  getUserProjects,
  updateProject,
  deleteProject,
  calculateMatchScore
};
