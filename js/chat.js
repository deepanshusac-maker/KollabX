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
let presenceSubscription = null;
let onlineUserIds = new Set();
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
    // Initialize Lucide Icons
    if (window.lucide) lucide.createIcons();
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
            if (e.key === 'Enter') handleCreateChannel();
        });
    }

    const editChannelSubmit = document.getElementById('editChannelSubmit');
    if (editChannelSubmit) editChannelSubmit.addEventListener('click', () => handleEditChannel());

    const editChannelModal = document.getElementById('editChannelModal');
    if (editChannelModal) {
        editChannelModal.addEventListener('click', (e) => { if (e.target === editChannelModal) closeEditChannelModal(); });
        document.getElementById('editChannelName')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeEditChannelModal();
            if (e.key === 'Enter') handleEditChannel();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('createChannelModal')?.classList.contains('open')) closeCreateChannelModal();
            if (document.getElementById('editChannelModal')?.classList.contains('open')) closeEditChannelModal();
        }
    });

    // Close any open channel dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.channel-options-container')) {
            document.querySelectorAll('.channel-dropdown.open').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        }
    });
}

function renderCurrentUser(profile) {
    const sidebarUser = document.getElementById('sidebarUser');
    if (!sidebarUser) return;

    const name = escapeHtml(profile.full_name || 'User');
    const rawAvatarUrl = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.full_name || 'User');
    const avatarUrl = window.authHelpers.sanitizeUrl(rawAvatarUrl) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.full_name || 'User');
    const safeAvatarUrl = window.authHelpers.sanitizeAttr(avatarUrl);
    sidebarUser.innerHTML = `
        <img src="${safeAvatarUrl}" alt="${name}" class="user-avatar">
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
    await loadChannels(project.id);
    await setupPresenceSubscription(project.id);
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
            ${isLeader && c.name.toLowerCase() !== 'general' ? `
            <div class="channel-options-container">
                <div class="channel-options-btn" aria-label="Channel options">
                    <i data-lucide="more-vertical" style="width: 16px; height: 16px;"></i>
                </div>
                <div class="channel-dropdown" data-dropdown-id="${c.id}">
                    <div class="channel-dropdown-item edit-channel" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-desc="${escapeHtml(c.description || '')}">
                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i> Edit Channel
                    </div>
                    <div class="channel-dropdown-item danger delete-channel" data-id="${c.id}" data-name="${escapeHtml(c.name)}">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete Channel
                    </div>
                </div>
            </div>
            ` : ''}
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
        item.addEventListener('click', (e) => {
            // Prevent selecting channel if clicking on options
            if (e.target.closest('.channel-options-container')) {
                return;
            }

            const channel = channels.find(c => c.id === item.dataset.channelId);
            if (channel) {
                if (chatLayout && window.matchMedia('(max-width: 768px)').matches) {
                    chatLayout.classList.add('chat-open');
                }
                selectChannel(channel);
            }
        });

        // Setup dropdown toggles
        const optionsBtn = item.querySelector('.channel-options-btn');
        if (optionsBtn) {
            optionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other open dropdowns
                document.querySelectorAll('.channel-dropdown.open').forEach(dropdown => {
                    dropdown.classList.remove('open');
                });
                const dropdown = item.querySelector('.channel-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('open');
                }
            });
        }
    });

    // Setup edit/delete actions
    channelList.querySelectorAll('.edit-channel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.closest('.channel-dropdown');
            if (dropdown) dropdown.classList.remove('open');
            openEditChannelModal(btn.dataset.id, btn.dataset.name, btn.dataset.desc);
        });
    });

    channelList.querySelectorAll('.delete-channel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.closest('.channel-dropdown');
            if (dropdown) dropdown.classList.remove('open');
            deleteChannel(btn.dataset.id, btn.dataset.name);
        });
    });

    if (window.lucide) lucide.createIcons();

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

// Edit Channel Modal logic variables
let editChannelIdTarget = null;

function openEditChannelModal(id, name, desc) {
    const modal = document.getElementById('editChannelModal');
    const nameInput = document.getElementById('editChannelName');
    const descInput = document.getElementById('editChannelDesc');

    if (modal && nameInput) {
        editChannelIdTarget = id;
        nameInput.value = name || '';
        if (descInput) descInput.value = desc || '';
        modal.classList.add('open');
        nameInput.focus();
    }
}

function closeEditChannelModal() {
    const modal = document.getElementById('editChannelModal');
    if (modal) modal.classList.remove('open');
    editChannelIdTarget = null;
}

async function handleEditChannel() {
    if (!editChannelIdTarget || !currentProjectId) return;

    const nameInput = document.getElementById('editChannelName');
    const descInput = document.getElementById('editChannelDesc');
    const newName = nameInput && nameInput.value.trim().toLowerCase().replace(/\s+/g, '-');

    if (!newName) {
        window.toast.error('Enter a channel name.');
        return;
    }

    if (newName === 'general') {
        window.toast.error('Cannot name a channel "general".');
        return;
    }

    const { error } = await window.supabase.from('channels')
        .update({
            name: newName,
            description: (descInput && descInput.value.trim()) || null
        })
        .eq('id', editChannelIdTarget);

    if (error) {
        window.toast.error(error.message || 'Failed to update channel.');
        return;
    }

    closeEditChannelModal();
    window.toast.success('Channel updated.');

    // Refresh channels and re-select if currently selected
    await loadChannels(currentProjectId);
    if (currentChannelId === editChannelIdTarget) {
        const { data: updatedChannel } = await window.supabase.from('channels').select('*').eq('id', currentChannelId).single();
        if (updatedChannel) {
            document.getElementById('headerChannel').innerHTML = `
                <div class="channel-name"><span class="hash-lg">#</span> ${escapeHtml(updatedChannel.name)}</div>
                <div class="channel-desc">${escapeHtml(updatedChannel.description || '')}</div>
            `;
            const chatTextarea = document.getElementById('chatTextarea');
            if (chatTextarea) chatTextarea.placeholder = `Message #${escapeHtml(updatedChannel.name)}…`;
        }
    }
}

async function deleteChannel(id, name) {
    if (!id || !currentProjectId) return;

    if (name.toLowerCase() === 'general') {
        window.toast.error('Cannot delete the #general channel.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the #${name} channel?\nAll messages inside will be permanently deleted.`)) {
        return;
    }

    const { error } = await window.supabase.from('channels').delete().eq('id', id);

    if (error) {
        window.toast.error('Failed to delete channel.');
        return;
    }

    window.toast.success('Channel deleted.');

    // If we deleted the current channel, load general
    if (currentChannelId === id) {
        currentChannelId = null;
    }

    await loadChannels(currentProjectId);
}

async function selectChannel(channel) {
    if (!channel) return;
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
    const rawAvatar = msg.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profile?.full_name || 'User')}`;
    const avatar = window.authHelpers.sanitizeUrl(rawAvatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profile?.full_name || 'User')}`;
    const actionsHtml = isMe
        ? `<div class="msg-actions"><button type="button" class="msg-action edit" data-message-id="${escapeHtml(msg.id)}" aria-label="Edit">Edit</button><button type="button" class="msg-action delete" data-message-id="${escapeHtml(msg.id)}" aria-label="Delete">Delete</button></div>`
        : '';

    group.innerHTML = `
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
    } else {
        if (window.kxAnalytics) window.kxAnalytics.trackEvent('send_message');
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

async function setupPresenceSubscription(projectId) {
    if (presenceSubscription) {
        window.supabase.removeChannel(presenceSubscription);
    }

    presenceSubscription = window.supabase
        .channel(`presence:${projectId}`)
        .on('presence', { event: 'sync' }, () => {
            const newState = presenceSubscription.presenceState();
            onlineUserIds.clear();
            for (const id in newState) {
                newState[id].forEach(p => {
                    if (p.user_id) onlineUserIds.add(p.user_id);
                });
            }
            loadMembers(projectId); // Re-render with online status
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceSubscription.track({
                    user_id: currentUser.id,
                    online_at: new Date().toISOString(),
                });
            }
        });
}

async function loadMembers(projectId) {
    const memberList = document.getElementById('memberList');
    const headerRight = document.getElementById('headerRight');
    if (!memberList) return;

    const result = await window.teams.getTeamMembers(projectId);
    if (!result.success) return;

    const members = result.data;

    // Sort current user to the top
    members.sort((a, b) => {
        if (currentUser && a.user_id === currentUser.id) return -1;
        if (currentUser && b.user_id === currentUser.id) return 1;
        return 0;
    });

    // Render sidebar member list
    memberList.innerHTML = members.map(m => {
        const isMe = currentUser && m.user_id === currentUser.id;
        const name = escapeHtml(m.profile?.full_name || 'Member');
        const rawAvatarUrl = m.profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.profile?.full_name || 'Member');
        const avatarUrl = window.authHelpers.sanitizeUrl(rawAvatarUrl) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.profile?.full_name || 'Member');
        const safeAvatarUrl = window.authHelpers.sanitizeAttr(avatarUrl);
        const isCreator = currentProject && m.user_id === currentProject.creator_id;
        const isOnline = onlineUserIds.has(m.user_id);
        const badge = isMe ? ' <span style="color: var(--green); font-size: 0.65rem; font-weight: 700;">(You)</span>'
            : isCreator ? ' <span style="color: var(--primary); font-size: 0.65rem; font-weight: 700;">(Lead)</span>'
                : '';
        return `
        <a href="portfolio.html?id=${m.user_id}" class="member-item" style="text-decoration: none; color: inherit; cursor: pointer;">
            <img src="${safeAvatarUrl}" alt="" class="member-avatar">
            <div class="member-info">
                <div class="member-name">${name}${badge}</div>
                <div class="member-role">${escapeHtml(m.role || (isCreator ? 'Project Lead' : 'Member'))}</div>
            </div>
            <div class="member-status-dot ${isOnline ? 'online' : 'offline'}"></div>
        </a>
    `;
    }).join('');

    // Render header avatar stack
    if (headerRight) {
        const maxShow = 4;
        const shown = members.slice(0, maxShow);
        const remaining = members.length - maxShow;

        const avatarsHtml = shown.map(m => {
            const rawUrl = m.profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.profile?.full_name || 'M');
            const url = window.authHelpers.sanitizeUrl(rawUrl) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.profile?.full_name || 'M');
            const safeUrl = window.authHelpers.sanitizeAttr(url);
            return `<a href="portfolio.html?id=${m.user_id}" title="${escapeHtml(m.profile?.full_name || 'Member')}"><img src="${safeUrl}" alt="${escapeHtml(m.profile?.full_name || 'Member')}"></a>`;
        }).join('');

        headerRight.innerHTML = `
            <div class="header-members-stack">
                ${avatarsHtml}
            </div>
            <span class="header-member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
        `;
    }

    // Update team member count in sidebar
    const teamMemberCount = document.getElementById('teamMemberCount');
    if (teamMemberCount) {
        teamMemberCount.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}`;
    }
}

function scrollToBottom() {
    const chatBody = document.getElementById('chatBody');
    chatBody.scrollTop = chatBody.scrollHeight;
}

function renderNoTeamsState() {
    const chatLayout = document.getElementById('chatLayout');
    if (!chatLayout) return;

    chatLayout.innerHTML = `
        <div class="empty-chat-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: calc(100vh - 3rem); width: 100%; text-align: center; padding: 40px; background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(20px); border-radius: var(--radius-lg); border: 1px solid rgba(255, 255, 255, 0.5);">
            <div style="font-size: 5rem; margin-bottom: 24px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));">🤝</div>
            <h1 style="font-size: 2.2rem; font-weight: 850; letter-spacing: -0.04em; margin-bottom: 12px; color: var(--text-primary);">No Teams Yet</h1>
            <p style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.6; margin-bottom: 32px; max-width: 420px; opacity: 0.8;">
                Collaborate and build with other creators. Join a project team to unlock the real-time chat.
            </p>
            <a href="explore.html" class="btn-primary" style="padding: 14px 32px; background: var(--maroon-grad); color: white; border-radius: var(--radius-md); text-decoration: none; font-weight: 700; font-size: 1rem; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 10px 25px rgba(179, 82, 106, 0.25);" onmouseover="this.style.transform='translateY(-2px)'; this.style.shadow='0 15px 30px rgba(179, 82, 106, 0.35)'" onmouseout="this.style.transform='translateY(0)'; this.style.shadow='0 10px 25px rgba(179, 82, 106, 0.25)'">
                Find Your Team
            </a>
        </div>
    `;
}
