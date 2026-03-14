// Invite Link Handling Logic

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    lucide.createIcons();

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const inviteCard = document.getElementById('invite-card');

    if (!token) {
        showErrorState('Invalid Link', 'No invite token was found in the URL. Please check the link and try again.');
        return;
    }

    try {
        // Find the project associated with the invite token
        const { data: project, error } = await window.supabase
            .from('projects')
            .select(`
                id, title, creator_id, team_size, current_members, status, category,
                creator:profiles!projects_creator_id_fkey(full_name)
            `)
            .eq('invite_token', token)
            .single();

        if (error || !project) {
            console.error('Invite Error:', error);
            showErrorState('Invalid Invite', 'This invite link is invalid or has expired.');
            return;
        }

        if (project.status !== 'open') {
            showErrorState('Project Closed', 'This project is no longer accepting new members.');
            return;
        }

        if (project.current_members >= project.team_size) {
            showErrorState('Team Full', 'This project team is already full.');
            return;
        }

        // Project is valid. Check if user is logged in.
        const { data: { user } } = await window.supabase.auth.getUser();

        if (!user) {
            // User not logged in. Save token to session storage and redirect to sign in
            sessionStorage.setItem('pending_invite_token', token);
            sessionStorage.setItem('pending_invite_project', project.id);
            
            showSuccessState(project, false);
            return;
        }

        // Check if user is the creator
        if (project.creator_id === user.id) {
            showErrorState('You are the Creator', 'You are already the creator of this project!', 'dashboard.html?tab=teams', 'Go to Dashboard');
            return;
        }

        // Check if user is already a member
        const { data: existingMember } = await window.supabase
            .from('team_members')
            .select('id')
            .eq('project_id', project.id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingMember) {
            showErrorState('Already a Member', 'You are already a part of this project team!', 'dashboard.html?tab=teams', 'Go to Dashboard');
            return;
        }

        // Show join UI
        showSuccessState(project, true);

    } catch (err) {
        console.error('Unexpected Invite Error:', err);
        showErrorState('Server Error', 'An unexpected error occurred while processing the invite.');
    }
});

function showErrorState(title, description, btnLink = 'index.html', btnText = 'Go Home') {
    const inviteCard = document.getElementById('invite-card');
    inviteCard.innerHTML = `
        <div class="invite-icon" style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1);">
            <i data-lucide="alert-circle"></i>
        </div>
        <h1 class="invite-title">\${title}</h1>
        <p class="invite-desc">\${description}</p>
        <button class="btn-join" onclick="window.location.href='\${btnLink}'">\${btnText}</button>
    `;
    lucide.createIcons();
}

function showSuccessState(project, isLoggedIn) {
    const inviteCard = document.getElementById('invite-card');
    
    let actionHtml = '';
    if (isLoggedIn) {
        actionHtml = `<button class="btn-join" id="btn-join-project">Join Project Team</button>`;
    } else {
        actionHtml = `<button class="btn-join" onclick="window.location.href='signin.html'">Sign In to Join</button>
                      <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-mist);">You must sign in or create an account first.</p>`;
    }

    inviteCard.innerHTML = `
        <div class="invite-icon">
            <i data-lucide="users"></i>
        </div>
        <h1 class="invite-title">You've been invited!</h1>
        <p class="invite-desc"><strong>\${project.creator?.full_name || 'Someone'}</strong> invited you to join their project team on KollabX.</p>
        
        <div class="invite-project-details">
            <div class="detail-item">
                <div class="detail-label">Project Name</div>
                <div class="detail-value">\${project.title}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Category</div>
                <div class="detail-value">\${project.category}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Team Space</div>
                <div class="detail-value">\${project.current_members} / \${project.team_size} members</div>
            </div>
        </div>
        
        \${actionHtml}
    `;
    lucide.createIcons();

    if (isLoggedIn) {
        document.getElementById('btn-join-project').addEventListener('click', async (e) => {
            const btn = e.target;
            const originalText = btn.textContent;
            btn.innerHTML = '<div class="loader" style="display: block;"></div>';
            btn.disabled = true;

            try {
                const { data: { user } } = await window.supabase.auth.getUser();
                
                // Add to team members
                const { error: insertError } = await window.supabase
                    .from('team_members')
                    .insert({
                        project_id: project.id,
                        user_id: user.id,
                        role: 'Member'
                    });

                if (insertError) {
                    // Check for duplicate constraint 23505
                    if (insertError.code === '23505') {
                        throw new Error('You are already a member of this project.');
                    }
                    throw insertError;
                }

                // Create join notification
                await window.supabase
                    .from('notifications')
                    .insert({
                        user_id: project.creator_id,
                        type: 'member_joined_via_invite',
                        title: 'New Team Member',
                        message: `Someone joined your project '\${project.title}' via an invite link!`,
                        link: '/dashboard.html?tab=teams'
                    });

                // Clear any pending invites
                sessionStorage.removeItem('pending_invite_token');
                sessionStorage.removeItem('pending_invite_project');

                if (window.toast) {
                    window.toast.success('Successfully joined the project!');
                }
                
                // Redirect immediately
                setTimeout(() => {
                    window.location.href = 'dashboard.html?tab=teams';
                }, 1000);

            } catch (err) {
                console.error('Error joining project:', err);
                if (window.toast) {
                    window.toast.error(err.message || 'Failed to join project. Try again.');
                } else {
                    alert(err.message || 'Failed to join project. Try again.');
                }
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
}
