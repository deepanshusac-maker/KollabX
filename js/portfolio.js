/* 
 * KollabX Portfolio JS
 * Handles real data fetching from Supabase for User Portfolios
 */

// Escape HTML to prevent XSS
function escapePortfolioHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Auth and wait for dependencies
    await window.session.initAuth();

    // 2. Resolve User ID from URL or Session
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get('id');

    if (!userId) {
        const currentUser = await window.authHelpers.getCurrentUser();
        if (currentUser) {
            userId = currentUser.id;
        } else {
            console.warn('No user ID provided and no user logged in.');
            // Optional: Redirect to explore or show a generic message
            showPortfolioError('Please provide a user ID or sign in to view your portfolio.');
            return;
        }
    }

    // 3. Load the data
    loadPortfolio(userId);

    // 4. Track portfolio view
    if (window.kxAnalytics) window.kxAnalytics.trackEvent('view_portfolio', { viewed_user_id: userId });
});

/**
 * Main loading orchestrated function
 */
async function loadPortfolio(userId) {
    try {

        // Parallel fetch for speed
        const [profileRes, teamsRes] = await Promise.all([
            window.supabase.from('profiles').select('*').eq('id', userId).single(),
            window.teams.getUserTeams(userId)
        ]);

        if (profileRes.error) {
            console.error('Profile fetch error:', profileRes.error);
            showPortfolioError('Builder profile not found.');
            return;
        }

        const profile = profileRes.data;
        const projects = teamsRes.data || [];

        // Distribute data to UI
        updateProfileUI(profile);
        updateStatsUI(userId, projects);
        updateProjectsTab(projects);
        updateContributionsTab(projects);
        updateSkillsTab(profile);
        updateExtraTabsUI(userId);

        // Re-initialize icons since we've added dynamic content
        if (window.lucide) {
            lucide.createIcons();
        }

        // 4. Hide Loader
        const loader = document.getElementById('portfolioLoader');
        if (loader) {
            loader.classList.add('hidden');
        }

    } catch (err) {
        console.error('Portfolio critical error:', err);
        showPortfolioError('An unexpected error occurred while loading this portfolio.');
    }
}

/**
 * Updates the Hero section with profile data
 */
function updateProfileUI(profile) {
    const nameEl = document.getElementById('profileName');
    const usernameEl = document.getElementById('profileUsername');
    const collegeEl = document.getElementById('profileCollege');
    const majorEl = document.getElementById('profileMajor');
    const headlineEl = document.getElementById('profileHeadline');
    const bioEl = document.getElementById('profileBio');
    const statusEl = document.getElementById('profileStatus');
    const imgEl = document.getElementById('profileImg');

    if (nameEl) {
        const name = profile.full_name || 'Anonymous Builder';
        nameEl.textContent = name;
        document.title = `${name} | KollabX Portfolio`;
    }
    if (usernameEl) usernameEl.textContent = `@${profile.full_name?.toLowerCase().replace(/\s+/g, '_') || 'user'}`;
    if (collegeEl) collegeEl.textContent = profile.college || 'Collaboration Hub';
    if (majorEl) majorEl.textContent = profile.availability || 'Building for Future';

    if (headlineEl) {
        headlineEl.textContent = profile.bio ? profile.bio.split('.')[0] + '.' : 'Passionate collaborator building the next big thing.';
    }

    if (bioEl) bioEl.textContent = profile.bio || 'No bio provided yet.';

    if (statusEl) {
        statusEl.textContent = profile.availability === 'Open' ? 'Open to Projects' : 'Currently Building';
    }

    if (imgEl && profile.avatar_url) {
        imgEl.src = profile.avatar_url;
    } else if (imgEl) {
        imgEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'U')}&background=b3526a&color=fff&size=128`;
    }

    // Social links — show only if the user has set them
    const githubLink = document.getElementById('socialGithub');
    const linkedinLink = document.getElementById('socialLinkedin');

    if (githubLink) {
        if (profile.github_url) {
            githubLink.href = profile.github_url;
            githubLink.style.display = '';
        } else {
            githubLink.style.display = 'none';
        }
    }

    if (linkedinLink) {
        if (profile.linkedin_url) {
            linkedinLink.href = profile.linkedin_url;
            linkedinLink.style.display = '';
        } else {
            linkedinLink.style.display = 'none';
        }
    }

    // Populate Hero Chips (Looking to Join & Skills)
    const lookingForContainer = document.getElementById('lookingForChips');
    const skillsHeroContainer = document.getElementById('skillsHeroChips');

    if (lookingForContainer) {
        const interests = profile.interests || [];
        lookingForContainer.innerHTML = interests.length > 0
            ? interests.map(i => `<span class="chip">${escapePortfolioHtml(i)}</span>`).join('')
            : '<span style="color: var(--text-mist); font-size: 14px;">No specific interests listed</span>';
    }

    if (skillsHeroContainer) {
        const skills = profile.skills || [];
        skillsHeroContainer.innerHTML = skills.length > 0
            ? skills.map(s => `<span class="chip">${escapePortfolioHtml(s)}</span>`).join('')
            : '<span style="color: var(--text-mist); font-size: 14px;">No skills listed yet</span>';
    }
}

/**
 * Calculates and updates impact statistics
 */
async function updateStatsUI(userId, projects) {
    const activeEl = document.getElementById('activeProjectsCount');
    const completedEl = document.getElementById('completedProjectsCount');
    const collaboratorsEl = document.getElementById('collaboratorsCount');
    const projectsTotalEl = document.getElementById('statProjectsCount');

    // Stats calculations
    const active = projects.filter(m => m.project.status !== 'completed').length;
    const completed = projects.filter(m => m.project.status === 'completed').length;

    if (activeEl) activeEl.textContent = active;
    if (completedEl) completedEl.textContent = completed;
    if (projectsTotalEl) projectsTotalEl.textContent = projects.length;

    // Fetch collaborators (unique members in all projects)
    try {
        const collaboratorIds = new Set();
        const projectIds = projects.map(m => m.project_id);

        if (projectIds.length > 0) {
            const { data: allMembers, error } = await window.supabase
                .from('team_members')
                .select('user_id')
                .in('project_id', projectIds);

            if (!error && allMembers) {
                allMembers.forEach(m => {
                    if (m.user_id !== userId) collaboratorIds.add(m.user_id);
                });
            }
        }
        if (collaboratorsEl) collaboratorsEl.textContent = collaboratorIds.size;
    } catch (e) {
        console.warn('Collaborator count failed:', e);
    }
}

/**
 * Populates the Missions tab with real project cards
 */
function updateProjectsTab(projects) {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;

    if (projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-mist);">
                <i data-lucide="folder-open" size="48" style="opacity: 0.3; margin-bottom: 20px;"></i>
                <p>No projects joined or created yet.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = projects.map(m => {
        const p = m.project;
        const isCompleted = p.status === 'completed';
        const statusClass = isCompleted ? 'pill-completed' : 'pill-active';
        const categoryClass = p.category?.toLowerCase() === 'technical' ? 'pill-tech' : 'pill-startup';

        return `
            <div class="project-card">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${escapePortfolioHtml(p.title)}</h3>
                        <div class="project-badges" style="margin-top: 8px;">
                            <span class="pill ${categoryClass}">${escapePortfolioHtml(p.category || 'Project')}</span>
                            <span class="pill ${statusClass}">${escapePortfolioHtml(p.status.toUpperCase())}</span>
                        </div>
                    </div>
                </div>
                <div class="role-played">${escapePortfolioHtml(m.role || 'Contributor')}</div>
                <p class="project-impact">${p.description ? escapePortfolioHtml(p.description.substring(0, 120)) + '...' : 'Building great things together.'}</p>
                <div class="outcome-metrics">
                    <div class="outcome-item">
                        <span class="outcome-value">${p.current_members}</span>
                        <span class="outcome-label">Team Size</span>
                    </div>
                </div>
                <div class="project-footer">
                    <div class="project-meta">
                        <span>Joined: ${new Date(m.joined_at).toLocaleDateString()}</span>
                    </div>
                    <a href="explore.html#project-${p.id}" class="case-study-link">
                        View Project <i data-lucide="arrow-right" size="14"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Updates the timeline tab (Contributions)
 */
function updateContributionsTab(projects) {
    const timeline = document.getElementById('contributionTimeline');
    if (!timeline) return;

    if (projects.length === 0) {
        timeline.innerHTML = '<p style="color: var(--text-mist); padding: 40px; text-align: center;">No history of contributions found yet.</p>';
        return;
    }

    // Just use join dates for now as "contributions"
    // In a real app, this would fetch commits, PRs, or specific task finishes
    timeline.innerHTML = projects.slice(0, 5).map(m => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <p class="timeline-date">${new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <div class="contribution-card">
                <h4 style="margin-bottom: 8px;">Joined ${escapePortfolioHtml(m.project.title)}</h4>
                <p style="font-size: 14px; color: var(--text-mist);">Role: ${escapePortfolioHtml(m.role || 'Collaborator')}</p>
                <p style="font-size: 14px; margin-top: 12px;">Started working on this ${escapePortfolioHtml(m.project.category || 'project')} alongside ${m.project.current_members} team members.</p>
            </div>
        </div>
    `).join('');
}

/**
 * Populates the Skills tab
 */
function updateSkillsTab(profile) {
    const container = document.getElementById('skillsTabsContent');
    if (!container) return;

    const skills = profile.skills || [];
    const interests = profile.interests || [];

    if (skills.length === 0 && interests.length === 0) {
        container.innerHTML = '<p style="color: var(--text-mist); padding: 40px; grid-column: 1/-1; text-align: center;">No skills listed yet.</p>';
        return;
    }

    container.innerHTML = `
        <div class="skill-section">
            <h3>Verified Skills</h3>
            <div class="chips">
                ${skills.length > 0 ? skills.map(s => `<span class="chip">${escapePortfolioHtml(s)}</span>`).join('') : '<span style="color: var(--text-mist); font-size: 14px;">None listed</span>'}
            </div>
        </div>
        <div class="skill-section">
            <h3>Focus Areas</h3>
            <div class="chips">
                ${interests.length > 0 ? interests.map(i => `<span class="chip">${escapePortfolioHtml(i)}</span>`).join('') : '<span style="color: var(--text-mist); font-size: 14px;">None listed</span>'}
            </div>
        </div>
    `;
}

/**
 * Handles empty states for tabs without DB support yet
 */
function updateExtraTabsUI(userId) {
    const achievements = document.getElementById('achievements');
    const reviews = document.getElementById('reviews');

    if (achievements) {
        achievements.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-mist);">
                <i data-lucide="award" size="48" style="opacity: 0.2; margin-bottom: 20px;"></i>
                <p>Achievements will appear here as you complete projects and win challenges.</p>
            </div>
        `;
    }

    if (reviews) {
        reviews.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-mist);">
                <i data-lucide="message-square" size="48" style="opacity: 0.2; margin-bottom: 20px;"></i>
                <p>No reviews yet. Reviews are automatically generated after successful project delivery.</p>
            </div>
        `;
    }
}

/**
 * Generic Error View
 */
function showPortfolioError(message) {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div style="text-align: center; padding: 100px 20px; color: var(--text-mist);">
                <i data-lucide="user-x" size="64" style="margin-bottom: 24px; opacity: 0.5;"></i>
                <h2 style="color: var(--text-main); margin-bottom: 12px;">Profile Restricted or Not Found</h2>
                <p>${message}</p>
                <a href="explore.html" class="btn btn-primary-maroon" style="margin-top: 32px; display: inline-flex;">Go to Explore</a>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    // Hide loader on error too
    const loader = document.getElementById('portfolioLoader');
    if (loader) {
        loader.classList.add('hidden');
    }
}
