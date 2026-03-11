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
      roles_needed: rolesArray,
      timeline: projectData.timeline || null,
      visibility: projectData.visibility || 'public',
      status: 'open',
      current_members: 1, // Creator is first member
      team_size: parseInt(projectData.teamSize) || 2
    };

    // Insert project
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (error) throw error;

    // Add creator as team member (idempotent)
    const { error: teamError } = await supabase
      .from('team_members')
      .upsert(
        {
          project_id: data.id,
          user_id: user.id,
          role: 'Creator'
        },
        { onConflict: 'project_id,user_id', ignoreDuplicates: true }
      );

    if (teamError) {
      console.error('Error adding creator to team:', teamError);
      // Don't fail the whole operation, just log it
    }

    if (window.kxAnalytics) window.kxAnalytics.trackEvent('create_project', {
      category: projectData.category,
      team_size: parseInt(projectData.teamSize) || 2
    });

    // Trigger match score updates for all users (new project may match existing users)
    // Do this in background to not block the response
    updateMatchScoresForNewProject(data.id).catch(err => {
      console.warn('Error updating match scores for new project:', err);
    });

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
      .eq('status', 'open');

    // Apply filters
    if (filters.category && filters.category !== 'All') {
      // Category hierarchy for group-based filtering
      const categoryGroups = {
        'Technical': ['Web Development', 'AI/ML', 'Robotics', 'IoT', 'Blockchain', 'Cybersecurity', 'Data Science', 'Hackathon',
          'Web', 'App', 'Iot'],  // Include legacy values
        'Sports': ['Cricket', 'Football', 'Basketball', 'Badminton', 'Other Sports'],
        'Cultural': ['Dance', 'Music', 'Drama', 'Art & Design', 'Other Cultural']
      };

      if (categoryGroups[filters.category]) {
        // Main category selected - filter by all sub-categories in the group
        query = query.in('category', categoryGroups[filters.category]);
      } else {
        // Direct sub-category match
        query = query.eq('category', filters.category);
      }
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.skills && filters.skills.length > 0) {
      // Filter projects that contain any of the specified skills
      // Build OR conditions for each skill (case-insensitive)
      const skillConditions = filters.skills.map(skill =>
        `required_skills.cs.{${skill}}`
      ).join(',');
      if (skillConditions) {
        query = query.or(skillConditions);
      }
    }

    // Filter by team size
    if (filters.teamSize) {
      if (filters.teamSize === 'small') {
        query = query.gte('team_size', 2).lte('team_size', 3);
      } else if (filters.teamSize === 'medium') {
        query = query.gte('team_size', 4).lte('team_size', 6);
      } else if (filters.teamSize === 'large') {
        query = query.gte('team_size', 7);
      }
    }

    // Filter by timeline
    if (filters.timeline) {
      query = query.eq('timeline', filters.timeline);
    }

    // Apply sorting
    if (filters.sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (filters.sort === 'popular') {
      // Sort by current_members descending (more members = more popular)
      query = query.order('current_members', { ascending: false });
    } else {
      // Default to latest
      query = query.order('created_at', { ascending: false });
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

    // Fire both queries simultaneously to save network round-trip time
    const [profileResult, projectResult] = await Promise.all([
      supabase.from('profiles').select('skills').eq('id', userId).single(),
      supabase.from('projects').select('required_skills').eq('id', projectId).single()
    ]);

    const profile = profileResult.data;
    const project = projectResult.data;

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

// Calculate and store match scores for a user against all open projects
async function updateUserMatchScores(userId) {
  try {
    const supabase = ensureSupabase();

    if (!userId) {
      return { success: false, error: 'User ID required' };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('skills')
      .eq('id', userId)
      .single();

    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    // Get all open public projects (excluding user's own projects)
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, required_skills, creator_id')
      .eq('visibility', 'public')
      .eq('status', 'open')
      .neq('creator_id', userId);

    if (projectsError) throw projectsError;

    if (!projects || projects.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    const userSkills = profile.skills || [];
    const matchesToInsert = [];

    // Calculate match scores for each project
    for (const project of projects) {
      const requiredSkills = project.required_skills || [];

      let matchScore = 0;
      if (requiredSkills.length === 0) {
        matchScore = 50; // Default match if no skills required
      } else {
        const matchingSkills = userSkills.filter(skill =>
          requiredSkills.some(req =>
            req.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(req.toLowerCase())
          )
        );
        matchScore = Math.round((matchingSkills.length / requiredSkills.length) * 100);
        matchScore = Math.min(matchScore, 100);
      }

      // Only store matches with score >= 10 (filter out very low matches)
      if (matchScore >= 10) {
        matchesToInsert.push({
          user_id: userId,
          project_id: project.id,
          match_score: matchScore
        });
      }
    }

    if (matchesToInsert.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    // Upsert matches (update if exists, insert if not)
    const { error: upsertError } = await supabase
      .from('matches')
      .upsert(matchesToInsert, {
        onConflict: 'user_id,project_id',
        ignoreDuplicates: false
      });

    if (upsertError) throw upsertError;

    return { success: true, data: { updated: matchesToInsert.length } };
  } catch (error) {
    console.error('Update user match scores error:', error);
    return { success: false, error: error.message };
  }
}

// Get recommended projects for a user (from matches table)
async function getRecommendedProjects(userId, limit = 6) {
  try {
    const supabase = ensureSupabase();

    if (!userId) {
      return { success: false, error: 'User ID required', data: [] };
    }

    // Get matches ordered by score descending
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        match_score,
        project:projects(
          id,
          title,
          category,
          description,
          required_skills,
          team_size,
          current_members,
          status,
          created_at,
          creator_id,
          creator:profiles(full_name, avatar_url)
        )
      `)
      .eq('user_id', userId)
      .order('match_score', { ascending: false })
      .limit(limit);

    if (matchesError) throw matchesError;

    if (!matches || matches.length === 0) {
      return { success: true, data: [] };
    }

    // Filter out projects that are closed or user's own projects
    const filteredMatches = matches.filter(match =>
      match.project &&
      match.project.status === 'open' &&
      match.project.creator_id !== userId
    );

    // Add match_score to project object
    const recommendedProjects = filteredMatches.map(match => ({
      ...match.project,
      match_score: match.match_score
    }));

    return { success: true, data: recommendedProjects };
  } catch (error) {
    console.error('Get recommended projects error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Update match scores for all users when a new project is created
async function updateMatchScoresForNewProject(projectId) {
  try {
    const supabase = ensureSupabase();

    // Get all users with profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, skills');

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    // Get the new project
    const { data: project } = await supabase
      .from('projects')
      .select('required_skills, creator_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const requiredSkills = project.required_skills || [];
    const matchesToInsert = [];

    // Calculate match scores for each user
    for (const profile of profiles) {
      // Skip project creator
      if (profile.id === project.creator_id) continue;

      const userSkills = profile.skills || [];
      let matchScore = 0;

      if (requiredSkills.length === 0) {
        matchScore = 50; // Default match if no skills required
      } else {
        const matchingSkills = userSkills.filter(skill =>
          requiredSkills.some(req =>
            req.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(req.toLowerCase())
          )
        );
        matchScore = Math.round((matchingSkills.length / requiredSkills.length) * 100);
        matchScore = Math.min(matchScore, 100);
      }

      // Only store matches with score >= 10
      if (matchScore >= 10) {
        matchesToInsert.push({
          user_id: profile.id,
          project_id: projectId,
          match_score: matchScore
        });
      }
    }

    if (matchesToInsert.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    // Upsert matches
    const { error: upsertError } = await supabase
      .from('matches')
      .upsert(matchesToInsert, {
        onConflict: 'user_id,project_id',
        ignoreDuplicates: false
      });

    if (upsertError) throw upsertError;

    return { success: true, data: { updated: matchesToInsert.length } };
  } catch (error) {
    console.error('Update match scores for new project error:', error);
    return { success: false, error: error.message };
  }
}

// Toggle project like status for a user
async function toggleProjectLike(projectId) {
  try {
    const supabase = ensureSupabase();
    const user = await window.authHelpers.getCurrentUser();
    if (!user) return { success: false, error: 'You must be logged in to like a project' };

    // Check if liked
    const { data: existing } = await supabase
      .from('project_likes')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error } = await supabase
        .from('project_likes')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { success: true, liked: false };
    } else {
      // Like
      const { error } = await supabase
        .from('project_likes')
        .insert({ project_id: projectId, user_id: user.id });
      if (error) throw error;
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return { success: false, error: error.message };
  }
}

// Fetch all project IDs that the current user has liked
async function getUserLikedProjects() {
  try {
    const supabase = window.supabase;
    if (!supabase) return { success: true, data: [] };

    // Check if authHelpers exists before trying to use it
    if (!window.authHelpers || !window.authHelpers.getCurrentUser) {
      return { success: true, data: [] };
    }

    const user = await window.authHelpers.getCurrentUser();
    if (!user) return { success: true, data: [] };

    const { data, error } = await supabase
      .from('project_likes')
      .select('project_id')
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true, data: data.map(like => like.project_id) };
  } catch (error) {
    console.error('Get user liked projects error:', error);
    return { success: false, error: error.message, data: [] };
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
  calculateMatchScore,
  updateUserMatchScores,
  getRecommendedProjects,
  updateMatchScoresForNewProject,
  toggleProjectLike,
  getUserLikedProjects
};
