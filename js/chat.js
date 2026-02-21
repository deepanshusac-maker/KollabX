/**
 * KollabX Real-time Chat Logic
 */

let currentProjectId = null;
let currentChannelId = null;
let chatSubscription = null;

// Initialize Chat
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to be ready
    setTimeout(async () => {
        const isAuth = await window.authHelpers.isAuthenticated();
        if (!isAuth) {
            window.location.href = 'signin.html';
            return;
        }

        await initChat();
        setupEventListeners();
    }, 500);
});

async function initChat() {
    console.log('Initializing Chat...');
    const user = await window.authHelpers.getCurrentUser();
    const profile = await window.authHelpers.getCurrentProfile();

    if (profile) {
        console.log('User profile loaded:', profile.full_name);
        renderCurrentUser(profile);
    }

    // Load User's Teams
    console.log('Loading user teams...');
    const result = await window.teams.getUserTeams();
    console.log('Teams result:', result);

    if (result.success && result.data && result.data.length > 0) {
        renderTeamSelector(result.data);

        // Check for project ID in URL or pick first team
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('project');

        let initialTeam = null;
        if (projectIdFromUrl) {
            initialTeam = result.data.find(t => t.project_id === projectIdFromUrl);
        }

        // Fallback to first team that has project data
        if (!initialTeam) {
            initialTeam = result.data.find(t => t.project !== null) || result.data[0];
        }

        if (initialTeam && initialTeam.project) {
            console.log('Selecting initial project:', initialTeam.project.title);
            selectProject(initialTeam.project);
        } else {
            console.warn('Initial team or project data is missing');
            renderNoTeamsState();
        }
    } else {
        console.log('No teams found for user');
        renderNoTeamsState();
    }
}

function setupEventListeners() {
    const sendBtn = document.getElementById('sendButton');
    const textarea = document.getElementById('chatTextarea');

    sendBtn.addEventListener('click', () => handleSendMessage());

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-expand textarea
    textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

function renderCurrentUser(profile) {
    const sidebarUser = document.getElementById('sidebarUser');
    if (!sidebarUser) return;

    sidebarUser.innerHTML = `
        <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.full_name}" alt="${profile.full_name}" class="user-avatar">
        <div class="user-info">
            <div class="user-name">${profile.full_name}</div>
            <div class="user-status">Online</div>
        </div>
    `;
}

function renderTeamSelector(teams) {
    const teamDropdown = document.getElementById('teamDropdown');
    const teamSelectBtn = document.getElementById('teamSelectBtn');

    if (!teamDropdown || !teamSelectBtn) return;

    teamDropdown.innerHTML = teams.map(t => `
        <button class="team-dropdown-item" data-project-id="${t.project.id}">
            <span class="dd-icon" style="background: var(--primary-bg); color: var(--primary)">${t.project.title.charAt(0)}</span>
            <span class="dd-name">${t.project.title}</span>
        </button>
    `).join('');

    teamSelectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        teamDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => teamDropdown.classList.remove('open'));

    teamDropdown.querySelectorAll('.team-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const team = teams.find(t => t.project.id === item.dataset.projectId);
            if (team) selectProject(team.project);
        });
    });
}

async function selectProject(project) {
    currentProjectId = project.id;

    // Update UI
    document.getElementById('teamLabel').textContent = project.title;
    document.getElementById('teamMemberCount').textContent = `${project.current_members} members`;
    document.getElementById('teamIcon').textContent = project.title.charAt(0);
    document.getElementById('teamIcon').style.background = 'var(--primary)';
    document.getElementById('teamIcon').style.color = 'white';

    // Load Channels
    await loadChannels(project.id);

    // Load Members
    await loadMembers(project.id);
}

async function loadChannels(projectId) {
    const channelList = document.getElementById('channelList');
    if (!channelList) return;

    const { data: channels, error } = await window.supabase
        .from('channels')
        .select('*')
        .eq('project_id', projectId);

    if (error) {
        console.error('Error loading channels:', error);
        return;
    }

    channelList.innerHTML = channels.map(c => `
        <button class="channel-item" data-channel-id="${c.id}">
            <span class="hash">#</span>
            <span class="channel-name">${c.name}</span>
        </button>
    `).join('');

    channelList.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channel = channels.find(c => c.id === item.dataset.channelId);
            if (channel) selectChannel(channel);
        });
    });

    // Select first channel (usually #general)
    if (channels.length > 0) {
        selectChannel(channels[0]);
    }
}

async function selectChannel(channel) {
    currentChannelId = channel.id;

    // Update Active UI
    document.querySelectorAll('.channel-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.channelId === channel.id);
    });

    document.getElementById('headerChannel').innerHTML = `
        <div class="channel-name"><span class="hash-lg">#</span> ${channel.name}</div>
        <div class="channel-desc">${channel.description || ''}</div>
    `;

    // Load Messages
    await loadMessages(channel.id);

    // Setup Real-time Subscription
    setupRealtimeSubscription(channel.id);
}

async function loadMessages(channelId) {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) return;

    chatBody.innerHTML = '<div class="loading">Loading messages...</div>';

    const { data: messages, error } = await window.supabase
        .from('messages')
        .select(`
            *,
            profile:profiles(full_name, avatar_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        console.error('Error loading messages:', error);
        chatBody.innerHTML = '<div class="error">Failed to load messages.</div>';
        return;
    }

    chatBody.innerHTML = '';
    if (messages.length === 0) {
        chatBody.innerHTML = '<div class="empty-chat">Start the conversation!</div>';
    } else {
        renderMessages(messages);
    }

    scrollToBottom();
}

function renderMessages(messages) {
    const chatBody = document.getElementById('chatBody');
    let lastUserId = null;
    let lastTime = null;

    messages.forEach(msg => {
        const msgTime = new Date(msg.created_at);
        const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Group messages from same user within 5 minutes
        const isContinuation = lastUserId === msg.user_id &&
            lastTime && (msgTime - lastTime) < 300000;

        if (isContinuation) {
            const lastMsgGroup = chatBody.lastElementChild;
            if (lastMsgGroup && lastMsgGroup.classList.contains('message-group')) {
                const content = lastMsgGroup.querySelector('.msg-content');
                const text = document.createElement('div');
                text.className = 'msg-text';
                text.textContent = msg.content;
                content.appendChild(text);
            } else {
                appendNewMessage(msg, timeStr, false);
            }
        } else {
            appendNewMessage(msg, timeStr, false);
        }

        lastUserId = msg.user_id;
        lastTime = msgTime;
    });
}

async function appendNewMessage(msg, timeStr, isRealtime = false) {
    const chatBody = document.getElementById('chatBody');
    const user = await window.authHelpers.getCurrentUser();
    const isMe = user && msg.user_id === user.id;

    // Remove empty state if present
    const emptyState = chatBody.querySelector('.empty-chat');
    if (emptyState) emptyState.remove();

    const group = document.createElement('div');
    group.className = `message-group ${isMe ? 'me' : 'them'}`;
    group.dataset.userId = msg.user_id;

    const avatar = msg.profile?.avatar_url || `https://ui-avatars.com/api/?name=${msg.profile?.full_name || 'User'}`;

    group.innerHTML = `
        <img src="${avatar}" class="msg-avatar" alt="Avatar">
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-sender">${isMe ? 'You' : (msg.profile?.full_name || 'Unknown')}</span>
                <span class="msg-timestamp">${timeStr}</span>
            </div>
            <div class="msg-text">${msg.content}</div>
        </div>
    `;

    chatBody.appendChild(group);
    if (isRealtime) scrollToBottom();
}

async function handleSendMessage() {
    const textarea = document.getElementById('chatTextarea');
    const content = textarea.value.trim();

    if (!content || !currentChannelId) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    const user = await window.authHelpers.getCurrentUser();

    const { error } = await window.supabase
        .from('messages')
        .insert({
            channel_id: currentChannelId,
            user_id: user.id,
            content: content
        });

    if (error) {
        console.error('Error sending message:', error);
        window.toast.error('Failed to send message.');
    }
}

function setupRealtimeSubscription(channelId) {
    if (chatSubscription) {
        window.supabase.removeChannel(chatSubscription);
    }

    chatSubscription = window.supabase
        .channel(`chat:${channelId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `channel_id=eq.${channelId}`
            },
            async (payload) => {
                const newMessage = payload.new;

                // Fetch profile for the new message
                const { data: profile } = await window.supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', newMessage.user_id)
                    .single();

                newMessage.profile = profile;
                const timeStr = new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                appendNewMessage(newMessage, timeStr, true);
            }
        )
        .subscribe();
}

async function loadMembers(projectId) {
    const memberList = document.getElementById('memberList');
    if (!memberList) return;

    const result = await window.teams.getTeamMembers(projectId);
    if (!result.success) return;

    memberList.innerHTML = result.data.map(m => `
        <div class="member-item">
            <img src="${m.profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + m.profile?.full_name}" class="member-avatar">
            <div class="member-info">
                <div class="member-name">${m.profile?.full_name}</div>
                <div class="member-role">${m.role || 'Member'}</div>
            </div>
            <div class="member-status-dot online"></div>
        </div>
    `).join('');
}

function scrollToBottom() {
    const chatBody = document.getElementById('chatBody');
    chatBody.scrollTop = chatBody.scrollHeight;
}

function renderNoTeamsState() {
    const chatLayout = document.getElementById('chatLayout');
    if (!chatLayout) return;

    chatLayout.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100%; text-align: center; padding: 20px;">
            <div style="font-size: 4rem; margin-bottom: 20px;">👋</div>
            <h1 style="margin-bottom: 10px;">No Teams Found</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 400px;">
                You haven't joined any project teams yet. You need to be part of a team to use the chat system.
            </p>
            <a href="explore.html" class="btn-primary" style="padding: 12px 24px; background: var(--primary); color: white; border-radius: 12px; text-decoration: none; font-weight: 600;">
                Explore Projects
            </a>
        </div>
    `;
}
