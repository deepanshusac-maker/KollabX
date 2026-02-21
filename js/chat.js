/**
 * KollabX Real-time Chat Logic
 */

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let currentProjectId = null;
let currentChannelId = null;
let currentUser = null;
let currentProject = null; // full project (includes creator_id) for leader checks
let chatSubscription = null;
const MAX_CHANNELS_PER_PROJECT = 3; // 1 general + 2 created by leader

function waitForSupabase(maxMs) {
    maxMs = maxMs || 2500;
    return new Promise((resolve) => {
        if (window.supabase) return resolve();
        const start = Date.now();
        const t = setInterval(() => {
            if (window.supabase || Date.now() - start >= maxMs) {
                clearInterval(t);
                resolve();
            }
        }, 30);
    });
}

// Initialize Chat
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    document.getElementById('chatBody').innerHTML = '<div class="loading">Loading…</div>';

    await waitForSupabase();
    if (!window.supabase) {
        document.getElementById('chatBody').innerHTML = '<div class="error">Failed to connect. Refresh the page.</div>';
        return;
    }

    const isAuth = await window.authHelpers.isAuthenticated();
    if (!isAuth) {
        window.location.href = 'signin.html';
        return;
    }

    currentUser = await window.authHelpers.getCurrentUser();
    const [profile, result] = await Promise.all([
        window.authHelpers.getCurrentProfile(),
        window.teams.getUserTeams()
    ]);

    if (profile) renderCurrentUser(profile);

    if (result.success && result.data && result.data.length > 0) {
        renderTeamSelector(result.data);

        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('project');
        let initialTeam = result.data.find(t => t.project_id === projectIdFromUrl);
        if (!initialTeam) {
            initialTeam = result.data.find(t => t.project !== null) || result.data[0];
        }

        if (initialTeam && initialTeam.project) {
            selectProject(initialTeam.project);
        } else {
            renderNoTeamsState();
        }
    } else {
        renderNoTeamsState();
    }
});

async function initChat() {
    // Kept for any external call; main init runs in DOMContentLoaded above
}

function setupEventListeners() {
    const sendBtn = document.getElementById('sendButton');
    const textarea = document.getElementById('chatTextarea');
    const backBtn = document.getElementById('backButton');
    const chatLayout = document.getElementById('chatLayout');

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

    // Mobile: back button shows sidebar, hides chat area
    if (backBtn && chatLayout) {
        backBtn.addEventListener('click', () => {
            chatLayout.classList.remove('chat-open');
        });
    }

    const createChannelSubmit = document.getElementById('createChannelSubmit');
    if (createChannelSubmit) createChannelSubmit.addEventListener('click', () => handleCreateChannel());

    const createChannelModal = document.getElementById('createChannelModal');
    if (createChannelModal) {
        createChannelModal.addEventListener('click', (e) => { if (e.target === createChannelModal) closeCreateChannelModal(); });
        document.getElementById('newChannelName')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCreateChannelModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('createChannelModal')?.classList.contains('open')) closeCreateChannelModal();
    });
}

function renderCurrentUser(profile) {
    const sidebarUser = document.getElementById('sidebarUser');
    if (!sidebarUser) return;

    const name = escapeHtml(profile.full_name || 'User');
    const avatarUrl = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.full_name || 'User');
    sidebarUser.innerHTML = `
        <img src="${avatarUrl}" alt="${name}" class="user-avatar">
        <div class="user-info">
            <div class="user-name">${name}</div>
            <div class="user-status">Online</div>
        </div>
    `;
}

function renderTeamSelector(teams) {
    const teamDropdown = document.getElementById('teamDropdown');
    const teamSelectBtn = document.getElementById('teamSelectBtn');

    if (!teamDropdown || !teamSelectBtn) return;

    const teamsWithProject = teams.filter(t => t.project);
    teamDropdown.innerHTML = teamsWithProject.map(t => `
        <button class="team-dropdown-item" data-project-id="${t.project.id}">
            <span class="dd-icon" style="background: var(--primary-bg); color: var(--primary)">${escapeHtml(t.project.title).charAt(0)}</span>
            <span class="dd-name">${escapeHtml(t.project.title)}</span>
        </button>
    `).join('');

    teamSelectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        teamDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => teamDropdown.classList.remove('open'));

    teamDropdown.querySelectorAll('.team-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const projectId = item.dataset.projectId;
            const team = teamsWithProject.find(t => t.project.id === projectId);
            if (team) {
                teamDropdown.classList.remove('open');
                selectProject(team.project);
            }
        });
    });
}

async function selectProject(project) {
    if (!project) return;
    currentProjectId = project.id;
    currentProject = project;

    // Clear previous chat state UI
    const chatBody = document.getElementById('chatBody');
    if (chatBody) chatBody.innerHTML = '<div class="loading">Loading team chat...</div>';

    const channelList = document.getElementById('channelList');
    if (channelList) channelList.innerHTML = '';

    const memberList = document.getElementById('memberList');
    if (memberList) memberList.innerHTML = '';

    // Update Project Sidebar UI
    const teamLabel = document.getElementById('teamLabel');
    const teamMemberCount = document.getElementById('teamMemberCount');
    const teamIcon = document.getElementById('teamIcon');

    if (teamLabel) teamLabel.textContent = project.title;
    if (teamMemberCount) teamMemberCount.textContent = `${project.current_members || 1} members`;
    if (teamIcon) {
        teamIcon.textContent = project.title.charAt(0);
        teamIcon.style.background = 'var(--maroon-grad)';
        teamIcon.style.color = 'white';
    }

    // Load Channels and Members
    await Promise.all([
        loadChannels(project.id),
        loadMembers(project.id)
    ]);
}

async function loadChannels(projectId) {
    const channelList = document.getElementById('channelList');
    const channelListContainer = document.getElementById('channelListContainer');
    const chatLayout = document.getElementById('chatLayout');
    if (!channelList) return;

    let channels = [];
    let error = null;
    const { data, error: fetchError } = await window.supabase
        .from('channels')
        .select('*')
        .eq('project_id', projectId);
    error = fetchError;
    channels = data || [];

    if (channels.length === 0 && !error) {
        try {
            const { data: rpcId, error: rpcErr } = await window.supabase.rpc('ensure_general_channel', { p_project_id: projectId });
            if (!rpcErr && rpcId) {
                const { data: refetch } = await window.supabase.from('channels').select('*').eq('project_id', projectId);
                channels = refetch || [];
            }
        } catch (_) {
            /* RPC may not exist yet; backfill SQL or trigger will provide #general */
        }
    }

    if (error) {
        const chatBody = document.getElementById('chatBody');
        if (chatBody) chatBody.innerHTML = '<div class="error">Failed to load channels.</div>';
        return;
    }

    const isLeader = currentProject && currentUser && currentProject.creator_id === currentUser.id;
    const canAddChannel = isLeader && channels.length < MAX_CHANNELS_PER_PROJECT;

    channelList.innerHTML = channels.map(c => `
        <button class="channel-item" data-channel-id="${c.id}">
            <span class="hash">#</span>
            <span class="channel-name">${escapeHtml(c.name)}</span>
        </button>
    `).join('');

    if (channelListContainer) {
        let addBtn = channelListContainer.querySelector('.add-channel-btn');
        if (canAddChannel) {
            if (!addBtn) {
                addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'add-channel-btn';
                addBtn.setAttribute('aria-label', 'Create channel');
                addBtn.innerHTML = '<span class="hash">+</span> Add channel';
                addBtn.addEventListener('click', () => openCreateChannelModal());
                channelListContainer.appendChild(addBtn);
            }
            addBtn.style.display = '';
        } else if (addBtn) addBtn.style.display = 'none';
    }

    channelList.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channel = channels.find(c => c.id === item.dataset.channelId);
            if (channel) {
                if (chatLayout && window.matchMedia('(max-width: 768px)').matches) {
                    chatLayout.classList.add('chat-open');
                }
                selectChannel(channel);
            }
        });
    });

    if (channels.length > 0) {
        selectChannel(channels[0]);
        if (chatLayout && window.matchMedia('(max-width: 768px)').matches) {
            chatLayout.classList.add('chat-open');
        }
    } else {
        currentChannelId = null;
        const chatBody = document.getElementById('chatBody');
        const headerChannel = document.getElementById('headerChannel');
        const chatTextarea = document.getElementById('chatTextarea');
        if (chatBody) chatBody.innerHTML = '<div class="empty-chat">No channels in this project. Ask the project creator to add a channel.</div>';
        if (headerChannel) headerChannel.innerHTML = '';
        if (chatTextarea) chatTextarea.placeholder = 'Select a channel…';
    }
}

function openCreateChannelModal() {
    const modal = document.getElementById('createChannelModal');
    const nameInput = document.getElementById('newChannelName');
    const descInput = document.getElementById('newChannelDesc');
    if (modal && nameInput) {
        nameInput.value = '';
        if (descInput) descInput.value = '';
        modal.classList.add('open');
        nameInput.focus();
    }
}

function closeCreateChannelModal() {
    const modal = document.getElementById('createChannelModal');
    if (modal) modal.classList.remove('open');
}

async function handleCreateChannel() {
    const nameInput = document.getElementById('newChannelName');
    const descInput = document.getElementById('newChannelDesc');
    const name = nameInput && nameInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !currentProjectId) {
        window.toast.error('Enter a channel name.');
        return;
    }
    const { data: existing } = await window.supabase.from('channels').select('id').eq('project_id', currentProjectId);
    if (existing && existing.length >= MAX_CHANNELS_PER_PROJECT) {
        window.toast.error('Maximum 3 channels per project (1 general + 2 custom).');
        closeCreateChannelModal();
        return;
    }
    const { data: newChannel, error } = await window.supabase.from('channels').insert({
        project_id: currentProjectId,
        name: name,
        description: (descInput && descInput.value.trim()) || null
    }).select().single();
    if (error) {
        window.toast.error(error.message || 'Failed to create channel.');
        return;
    }
    closeCreateChannelModal();
    await loadChannels(currentProjectId);
    if (newChannel) selectChannel(newChannel);
    window.toast.success('Channel created.');
}

async function selectChannel(channel) {
    if (!channel) return;
    console.log('Selecting channel:', channel.name, channel.id);
    currentChannelId = channel.id;

    // Update Active UI
    document.querySelectorAll('.channel-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.channelId === channel.id);
    });

    document.getElementById('headerChannel').innerHTML = `
        <div class="channel-name"><span class="hash-lg">#</span> ${escapeHtml(channel.name)}</div>
        <div class="channel-desc">${escapeHtml(channel.description || '')}</div>
    `;

    const chatTextarea = document.getElementById('chatTextarea');
    if (chatTextarea) chatTextarea.placeholder = `Message #${escapeHtml(channel.name)}…`;

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
                const isMe = currentUser && msg.user_id === currentUser.id;
                const actionsHtml = isMe
                    ? `<div class="msg-actions"><button type="button" class="msg-action edit" data-message-id="${escapeHtml(msg.id)}" aria-label="Edit">Edit</button><button type="button" class="msg-action delete" data-message-id="${escapeHtml(msg.id)}" aria-label="Delete">Delete</button></div>`
                    : '';
                const row = document.createElement('div');
                row.className = 'msg-row';
                row.dataset.messageId = msg.id;
                row.innerHTML = `<div class="msg-text">${escapeHtml(msg.content)}</div>${actionsHtml}`;
                content.appendChild(row);
                if (isMe) bindMessageActions(lastMsgGroup);
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

function appendNewMessage(msg, timeStr, isRealtime = false) {
    const chatBody = document.getElementById('chatBody');
    const isMe = currentUser && msg.user_id === currentUser.id;

    const emptyState = chatBody.querySelector('.empty-chat');
    if (emptyState) emptyState.remove();

    const group = document.createElement('div');
    group.className = `message-group ${isMe ? 'me' : 'them'}`;
    group.dataset.userId = msg.user_id;

    const displayName = isMe ? 'You' : escapeHtml(msg.profile?.full_name || 'Unknown');
    const avatar = msg.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profile?.full_name || 'User')}`;
    const actionsHtml = isMe
        ? `<div class="msg-actions"><button type="button" class="msg-action edit" data-message-id="${escapeHtml(msg.id)}" aria-label="Edit">Edit</button><button type="button" class="msg-action delete" data-message-id="${escapeHtml(msg.id)}" aria-label="Delete">Delete</button></div>`
        : '';

    group.innerHTML = `
        <img src="${avatar}" class="msg-avatar" alt="">
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-sender">${displayName}</span>
                <span class="msg-timestamp">${escapeHtml(timeStr)}</span>
            </div>
            <div class="msg-row" data-message-id="${escapeHtml(msg.id)}">
                <div class="msg-text">${escapeHtml(msg.content)}</div>
                ${actionsHtml}
            </div>
        </div>
    `;

    if (isMe) bindMessageActions(group);
    chatBody.appendChild(group);
    if (isRealtime) scrollToBottom();
}

function bindMessageActions(container) {
    container.querySelectorAll('.msg-action.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const messageId = btn.dataset.messageId;
            const row = container.querySelector(`.msg-row[data-message-id="${messageId}"]`);
            const textEl = row?.querySelector('.msg-text');
            if (!row || !textEl) return;
            startEditMessage(messageId, textEl, row);
        });
    });
    container.querySelectorAll('.msg-action.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const messageId = btn.dataset.messageId;
            const row = container.querySelector(`.msg-row[data-message-id="${messageId}"]`);
            if (confirm('Delete this message?')) deleteMessage(messageId, row);
        });
    });
}

function startEditMessage(messageId, textEl, row) {
    const currentText = textEl.textContent;
    const input = document.createElement('textarea');
    input.className = 'msg-edit-input';
    input.value = currentText;
    input.rows = Math.min(4, (currentText.match(/\n/g) || []).length + 1);
    const wrap = document.createElement('div');
    wrap.className = 'msg-edit-wrap';
    wrap.innerHTML = '<div class="msg-edit-actions"><button type="button" class="msg-edit-save">Save</button><button type="button" class="msg-edit-cancel">Cancel</button></div>';
    wrap.prepend(input);
    row.replaceChildren(wrap);
    input.focus();
    input.select();

    wrap.querySelector('.msg-edit-save').addEventListener('click', () => saveEditMessage(messageId, input.value.trim(), row, textEl));
    wrap.querySelector('.msg-edit-cancel').addEventListener('click', () => {
        row.innerHTML = '';
        row.appendChild(textEl);
        textEl.textContent = currentText;
        const actionsHtml = `<div class="msg-actions"><button type="button" class="msg-action edit" data-message-id="${escapeHtml(messageId)}" aria-label="Edit">Edit</button><button type="button" class="msg-action delete" data-message-id="${escapeHtml(messageId)}" aria-label="Delete">Delete</button></div>`;
        row.insertAdjacentHTML('beforeend', actionsHtml);
        bindMessageActions(row.closest('.message-group'));
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') wrap.querySelector('.msg-edit-cancel').click();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            wrap.querySelector('.msg-edit-save').click();
        }
    });
}

async function saveEditMessage(messageId, newContent, row, originalTextEl) {
    if (!newContent) {
        window.toast.error('Message cannot be empty.');
        return;
    }
    const { error } = await window.supabase.from('messages').update({ content: newContent }).eq('id', messageId);
    if (error) {
        window.toast.error('Failed to update message.');
        return;
    }
    originalTextEl.textContent = newContent;
    const actionsHtml = `<div class="msg-actions"><button type="button" class="msg-action edit" data-message-id="${escapeHtml(messageId)}" aria-label="Edit">Edit</button><button type="button" class="msg-action delete" data-message-id="${escapeHtml(messageId)}" aria-label="Delete">Delete</button></div>`;
    row.innerHTML = '';
    row.appendChild(originalTextEl);
    row.insertAdjacentHTML('beforeend', actionsHtml);
    bindMessageActions(row.closest('.message-group'));
    window.toast.success('Message updated.');
}

async function deleteMessage(messageId, rowEl) {
    const { error } = await window.supabase.from('messages').delete().eq('id', messageId);
    if (error) {
        window.toast.error('Failed to delete message.');
        return;
    }
    if (rowEl) {
        const group = rowEl.closest('.message-group');
        rowEl.remove();
        const remainingRows = group?.querySelectorAll('.msg-row');
        if (group && (!remainingRows || remainingRows.length === 0)) group.remove();
    }
    const chatBody = document.getElementById('chatBody');
    if (chatBody && !chatBody.querySelector('.message-group') && !chatBody.querySelector('.empty-chat')) {
        chatBody.innerHTML = '<div class="empty-chat">Start the conversation!</div>';
    }
    window.toast.success('Message deleted.');
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

    memberList.innerHTML = result.data.map(m => {
        const name = escapeHtml(m.profile?.full_name || 'Member');
        const avatarUrl = m.profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.profile?.full_name || 'Member');
        return `
        <div class="member-item">
            <img src="${avatarUrl}" alt="" class="member-avatar">
            <div class="member-info">
                <div class="member-name">${name}</div>
                <div class="member-role">${escapeHtml(m.role || 'Member')}</div>
            </div>
            <div class="member-status-dot online"></div>
        </div>
    `;
    }).join('');
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
