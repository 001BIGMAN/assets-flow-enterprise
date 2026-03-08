// Supabase Configuration
const SUPABASE_URL = 'https://xdsmthoenrwvbqetigjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc210aG9lbnJ3dmJxZXRpZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTAyMjUsImV4cCI6MjA4ODIyNjIyNX0.s6RL7lQLDodzai_y0uQl_7ph2ht44s9sNfF8jJ3iwXE';

let sb;

async function initSupabase() {
    let retries = 0;
    while (typeof window.supabase === 'undefined' && retries < 10) {
        await new Promise(r => setTimeout(r, 500));
        retries++;
    }

    if (typeof window.supabase !== 'undefined') {
        try {
            sb = window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
            return true;
        } catch (e) {
            console.error("Failed to create Supabase client:", e);
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    const initialized = await initSupabase();

    if (!initialized) {
        alert("Failed to connect to database.");
        return;
    }

    // 1. Authenticate and Verify Admin Role
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
        window.location.href = 'auth.html';
        return;
    }

    const userId = session.user.id;
    
    // Check if user is admin in the profiles table
    const { data: profile, error: profileErr } = await sb
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (profileErr || !profile || profile.role !== 'admin') {
        console.error("Access Denied. Not an admin.", profileErr);
        // If not an admin, send them to the regular dashboard
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Get user metadata for the name
    const { data: { user } } = await sb.auth.getUser();
    const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
    
    // Set Welcome text
    const welcomeTitle = document.getElementById('admin-welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `Welcome, ${fullName}`;
    }

    // If we reach here, the user is an admin. Remove loading screen and show content.
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('admin-content').style.display = 'flex';

    // 2. Setup Navigation
    setupAdminNavigation();

    // 3. Load Data
    loadStudentsOverview();

    // 4. Setup Forms
    setupNotificationForm();
    setupAudioForm();
    setupAdminChat(userId, fullName);

    // Setup Logout
    document.getElementById('btn-logout-sidebar').addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = 'index.html';
    });
});

function setupAdminNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a[data-target]');
    const sections = document.querySelectorAll('.admin-section');
    
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('mobile-sidebar-toggle');

    const toggleSidebar = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        const icon = toggle.querySelector('i');
        const text = toggle.querySelector('span');
        if (sidebar.classList.contains('active')) {
            icon.className = 'fas fa-times';
            if(text) text.textContent = 'CLOSE';
        } else {
            icon.className = 'fas fa-bars';
            if(text) text.textContent = 'ADMIN MENU';
        }
    };

    if(toggle) toggle.addEventListener('click', toggleSidebar);
    if(overlay) overlay.addEventListener('click', toggleSidebar);

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active link class
            document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
            link.parentElement.classList.add('active');

            // Show target section
            const targetId = link.getAttribute('data-target');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === targetId) sec.classList.add('active');
            });

            // Close sidebar on mobile
            if (window.innerWidth <= 991 && sidebar.classList.contains('active')) {
                toggleSidebar();
            }
        });
    });
}

async function loadStudentsOverview() {
    const { data: profiles, error } = await sb
        .from('student_profiles')
        .select('id, email, full_name, created_at');

    const tbody = document.getElementById('students-table-body');
    const totalEl = document.getElementById('stat-total-students');

    if (error) {
        console.error("Error loading students:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="color: red; padding: 20px;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; opacity: 0.6;">No students found yet.</td></tr>';
        totalEl.textContent = '0';
        return;
    }

    totalEl.textContent = profiles.length;
    tbody.innerHTML = '';

    // Also populate the notification target dropdown with individual students
    const individualGroup = document.getElementById('individual-students-group');
    const individualAudioGroup = document.getElementById('individual-audio-students-group');
    if (individualGroup) individualGroup.innerHTML = '';
    if (individualAudioGroup) individualAudioGroup.innerHTML = '';

    profiles.forEach(p => {
        const name = p.full_name || 'N/A';
        const email = p.email || 'Unknown';
        const date = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
        const plan = localStorage.getItem(`plan_${p.id}`) || '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 18px; font-weight: bold;">${name}</td>
            <td style="padding: 18px; opacity: 0.7;">${email}</td>
            <td style="padding: 18px;"><span style="color: var(--accent-gold); font-weight: 600; text-transform: uppercase; font-size: 0.85rem;">${plan}</span></td>
            <td style="padding: 18px; opacity: 0.6; font-size: 0.9rem;">${date}</td>
        `;
        tbody.appendChild(tr);

        // Helper to build an option element
        const buildOpt = () => {
            const opt = document.createElement('option');
            opt.value = `user:${p.id}`;
            opt.textContent = `${name} (${email})`;
            opt.style.background = '#111';
            opt.style.color = '#fff';
            return opt;
        };

        // Add to notification dropdown
        if (individualGroup) individualGroup.appendChild(buildOpt());
        // Add to audio dropdown
        if (individualAudioGroup) individualAudioGroup.appendChild(buildOpt());
    });

    const emptyMsg = 'No students available';
    if (individualGroup && individualGroup.children.length === 0) {
        const e = document.createElement('option'); e.disabled = true; e.textContent = emptyMsg; individualGroup.appendChild(e);
    }
    if (individualAudioGroup && individualAudioGroup.children.length === 0) {
        const e = document.createElement('option'); e.disabled = true; e.textContent = emptyMsg; individualAudioGroup.appendChild(e);
    }
}

function setupNotificationForm() {
    const form = document.getElementById('notify-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('notify-alert');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        const target = document.getElementById('notify-target').value;
        const title = document.getElementById('notify-title').value;
        const message = document.getElementById('notify-message').value;

        // Check if targeting an individual student (value starts with "user:")
        let targetTier = target;
        let targetUserId = null;
        if (target.startsWith('user:')) {
            targetUserId = target.replace('user:', '');
            targetTier = 'individual';
        }

        try {
            const insertPayload = {
                target_tier: targetTier,
                title: title,
                message: message
            };
            if (targetUserId) {
                insertPayload.target_user_id = targetUserId;
            }

            const { error } = await sb.from('notifications').insert(insertPayload);

            if (error) throw error;

            alertEl.textContent = 'Notification sent successfully to students!';
            alertEl.className = 'admin-alert success';
            alertEl.style.display = 'block';
            form.reset();
            
            setTimeout(() => { alertEl.style.display = 'none'; }, 4000);
            
        } catch (err) {
            console.error("Error sending notification:", err);
            alertEl.textContent = 'Failed to send notification: ' + err.message;
            alertEl.className = 'admin-alert error';
            alertEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

function setupAudioForm() {
    const form = document.getElementById('audio-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertEl = document.getElementById('audio-alert');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading... Please wait.';
        
        const fileInput = document.getElementById('audio-file');
        const file = fileInput.files[0];
        const title = document.getElementById('audio-title').value;
        const target = document.getElementById('audio-target').value;

        if (!file) return;

        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `class_recordings/${fileName}`;

            const { error: uploadError } = await sb.storage
                .from('audio_files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = sb.storage
                .from('audio_files')
                .getPublicUrl(filePath);

            // 3. Save reference to database table
            // Handle individual student targeting
            let targetTier = target;
            let targetUserId = null;
            if (target.startsWith('user:')) {
                targetUserId = target.replace('user:', '');
                targetTier = 'individual';
            }

            const audioPayload = {
                title: title,
                target_tier: targetTier,
                file_url: publicUrl,
                file_path: filePath
            };
            if (targetUserId) audioPayload.target_user_id = targetUserId;

            const { error: dbError } = await sb.from('audio_recordings').insert(audioPayload);

            if (dbError) throw dbError;

            alertEl.textContent = 'Audio recording uploaded successfully!';
            alertEl.className = 'admin-alert success';
            alertEl.style.display = 'block';
            form.reset();
            
            setTimeout(() => { alertEl.style.display = 'none'; }, 5000);

        } catch (err) {
            console.error("Error uploading audio:", err);
            alertEl.textContent = 'Upload failed: ' + err.message;
            alertEl.className = 'admin-alert error';
            alertEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

function setupAdminChat(currentUserId, currentUserName) {
    const chatContainer = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    if (!chatContainer || !chatForm) return;

    async function loadMessages() {
        const { data: messages, error } = await sb
            .from('admin_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error loading chat:', error);
            chatContainer.innerHTML = '<p style="color: #ff4d4d; text-align:center;">Failed to load messages.</p>';
            return;
        }

        if (!messages || messages.length === 0) {
            chatContainer.innerHTML = `
                <div style="text-align:center; padding: 60px 20px; opacity: 0.4;">
                    <i class="fas fa-comments fa-3x" style="color: var(--accent-gold); margin-bottom: 15px;"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>`;
            return;
        }

        chatContainer.innerHTML = messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

            return `
                <div style="display: flex; justify-content: ${isMe ? 'flex-end' : 'flex-start'}; width: 100%;" data-chat-id="${msg.id}">
                    <div style="max-width: 75%; padding: 14px 18px; border-radius: ${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMe ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isMe ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)'}; position: relative;">
                        <button onclick="deleteAdminMsg('${msg.id}')" style="position:absolute; top:6px; right:6px; background:none; border:none; color:rgba(255,255,255,0.2); cursor:pointer; font-size:0.7rem; padding:4px 6px; border-radius:4px; transition:all 0.2s;" onmouseover="this.style.color='#ff4d4d'; this.style.background='rgba(255,0,0,0.15)'" onmouseout="this.style.color='rgba(255,255,255,0.2)'; this.style.background='none'" title="Delete message">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <div style="font-size: 0.75rem; font-weight: 700; color: ${isMe ? 'var(--accent-gold)' : '#aaa'}; margin-bottom: 6px; padding-right: 20px;">
                            ${isMe ? 'You' : msg.sender_name}
                        </div>
                        <p style="font-size: 0.95rem; line-height: 1.5; margin: 0; color: #ddd;">${msg.message}</p>
                        <div style="font-size: 0.65rem; opacity: 0.4; margin-top: 8px; text-align: right;">${date}, ${time}</div>
                    </div>
                </div>`;
        }).join('');

        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    loadMessages();
    setInterval(loadMessages, 5000);

    // Global delete function
    window.deleteAdminMsg = async function(msgId) {
        if (!confirm('Delete this message?')) return;
        const { error } = await sb.from('admin_messages').delete().eq('id', msgId);
        if (error) {
            alert('Failed to delete: ' + error.message);
        } else {
            const el = document.querySelector(`[data-chat-id="${msgId}"]`);
            if (el) {
                el.style.transition = 'opacity 0.3s, transform 0.3s';
                el.style.opacity = '0';
                el.style.transform = 'scale(0.9)';
                setTimeout(() => { el.remove(); }, 300);
            }
        }
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.disabled = true;

        const { error } = await sb.from('admin_messages').insert({
            sender_id: currentUserId,
            sender_name: currentUserName,
            message: text
        });

        if (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message: ' + error.message);
        } else {
            chatInput.value = '';
            await loadMessages();
        }

        chatInput.disabled = false;
        chatInput.focus();
    });
}
