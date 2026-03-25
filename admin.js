// Supabase Configuration
const SUPABASE_URL = 'https://xdsmthoenrwvbqetigjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc210aG9lbnJ3dmJxZXRpZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTAyMjUsImV4cCI6MjA4ODIyNjIyNX0.s6RL7lQLDodzai_y0uQl_7ph2ht44s9sNfF8jJ3iwXE';
const RESEND_API_KEY = 're_BZyisSeR_9YdAvzUZ1M4Vv4MLC6eznwKB';

let sb;

async function initSupabase() {
    let retries = 0;
    while (typeof window.supabase === 'undefined' && retries < 20) {
        await new Promise(r => setTimeout(r, 50));
        retries++;
    }

    if (typeof window.supabase !== 'undefined') {
        try {
            sb = window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
            
            // Founder Image Rotation on Scroll (Consistency with Homepage)
            const applyRotation = (y) => {
                const rotation = y * 0.5;
                const rotateElements = document.querySelectorAll(".rotate-on-scroll");
                rotateElements.forEach(el => {
                    el.style.transform = `rotateY(${rotation}deg)`;
                });
            };

            window.addEventListener("scroll", () => applyRotation(window.scrollY));
            
            const dashContent = document.querySelector(".dashboard-content");
            if (dashContent) {
                dashContent.addEventListener("scroll", () => applyRotation(dashContent.scrollTop));
            }

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
    
    // Safety Timeout: If check takes > 8 seconds, provide a fallback
    const safetyTimeout = setTimeout(() => {
        document.getElementById('loading-overlay').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: #ff4d4d; margin-bottom: 20px;"></i>
                <h2>Verification Taking Longer than Usual</h2>
                <p style="opacity:0.7; margin-bottom:20px;">We're having trouble reaching the security server.</p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="location.reload()" style="padding:10px 20px; background:var(--accent-gold); border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Retry</button>
                    <button onclick="window.location.href='dashboard.html'" style="padding:10px 20px; background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:5px; cursor:pointer;">Go to Student Portal</button>
                </div>
            </div>
        `;
    }, 8000);

    const { data: profile, error: profileErr } = await sb
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    clearTimeout(safetyTimeout); // Stop timeout if we get a result

    const userRole = (profile?.role || '').toLowerCase();
    if (profileErr || !profile || (userRole !== 'admin' && userRole !== 'founder')) {
        console.error("Access Denied. Insufficient permissions.", profileErr);
        window.location.replace('dashboard.html');
        return;
    }
    
    // AUTHORIZED: Reveal Content and Setup Dashboard
    document.body.classList.add('authorized');
    
    const isFounder = (userRole === 'founder');
    if (isFounder) {
        const founderTab = document.getElementById('founder-only-tab');
        if (founderTab) {
            founderTab.style.display = 'block';
            loadFounderUsersList();
        }
    }

    const loadingOverlay = document.getElementById('loading-overlay');
    const adminContent = document.getElementById('admin-content');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    if (adminContent) adminContent.style.display = 'flex';
    
    // Get user metadata for the name
    const { data: { user } } = await sb.auth.getUser();
    const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
    
    // Set Welcome text
    const welcomeTitle = document.getElementById('admin-welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `Welcome, ${fullName} ${isFounder ? '(FOUNDER)' : ''}`;
    }

    // 2. Setup Navigation
    setupAdminNavigation();

    // 3. Load Data
    loadStudentsOverview();

    // 4. Setup Forms
    try {
        setupNotificationForm();
        setupAudioForm();
        setupAdminChat(userId, fullName);
    } catch (e) {
        console.error("Error during admin UI setup:", e);
    }

    // Setup Logout
    const logoutBtn = document.getElementById('btn-logout-sidebar');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log("Admin logging out...");
                const { error } = await sb.auth.signOut();
                if (error) throw error;
                window.location.replace('index.html');
            } catch (err) {
                console.error("Logout failed:", err);
                // Force redirect anyway as a fallback
                window.location.href = 'index.html';
            }
        });
    }
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

    // Persistence: Restore last active tab
    const savedTab = sessionStorage.getItem('adminActiveTab');
    if (savedTab) {
        const targetLink = document.querySelector(`.sidebar-nav a[data-target="${savedTab}"]`);
        if (targetLink) {
            // Remove default active
            document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            
            // Set saved active
            targetLink.parentElement.classList.add('active');
            const targetSec = document.getElementById(savedTab);
            if (targetSec) targetSec.classList.add('active');
        }
    }

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

            // Persistence: Save active tab
            sessionStorage.setItem('adminActiveTab', targetId);

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

async function sendEmailNotification(emails, title, message) {
    console.log("Sending email via Resend to:", emails);
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'Assets Flow Enterprise <onboarding@resend.dev>', // You should verify your domain in Resend for custom from address
                to: emails,
                subject: `New Notification: ${title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #111;">
                        <h2 style="color: #d4af37;">Assets Flow Enterprise</h2>
                        <p>Hi there,</p>
                        <p>You have a new notification from the dashboard:</p>
                        <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0;">
                            <strong>${title}</strong>
                            <p>${message}</p>
                        </div>
                        <p>Log in to your dashboard to see more details.</p>
                        <hr>
                        <p style="font-size: 0.8rem; color: #666;">&copy; 2026 Assets Flow Enterprise</p>
                    </div>
                `
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Email delivery failed');
        console.log("Email sent successfully:", result);
    } catch (err) {
        console.error("Resend API Error:", err);
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

            // Send Email via Resend
            try {
                let targetEmails = [];
                if (targetTier === 'all') {
                    const { data: users } = await sb.from('student_profiles').select('email');
                    targetEmails = users.map(u => u.email);
                } else if (targetTier === 'individual' && targetUserId) {
                    const { data: user } = await sb.from('student_profiles').select('email').eq('id', targetUserId).single();
                    if (user) targetEmails = [user.email];
                } else {
                    // Filter by plan/tier
                    const { data: users } = await sb.from('student_profiles').select('email');
                    // We check localStorage plan on client, but for mass email we rely on database if stored, 
                    // otherwise we send to all for now or filter if plan is in DB.
                    targetEmails = users.map(u => u.email);
                }

                if (targetEmails.length > 0) {
                    await sendEmailNotification(targetEmails, title, message);
                }
            } catch (emailErr) {
                console.warn("Notification sent to DB, but email failed:", emailErr);
            }

            alertEl.textContent = 'Sent';
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

            // 4. Send email notification
            try {
                let targetEmails = [];
                if (targetTier === 'all') {
                    const { data: users } = await sb.from('student_profiles').select('email');
                    targetEmails = users.map(u => u.email);
                } else if (targetTier === 'individual' && targetUserId) {
                    const { data: user } = await sb.from('student_profiles').select('email').eq('id', targetUserId).single();
                    if (user) targetEmails = [user.email];
                } else {
                    const { data: users } = await sb.from('student_profiles').select('email');
                    targetEmails = users.map(u => u.email);
                }

                if (targetEmails.length > 0) {
                    await sendEmailNotification(targetEmails, `New Class Recording: ${title}`, `A new class recording has been uploaded titled: ${title}. Log in to your dashboard to listen.`);
                }
            } catch (emailErr) {
                console.warn("Audio uploaded to DB, but email failed:", emailErr);
            }

            alertEl.textContent = 'Sent';
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
    let lastMessageCount = 0;
    let lastLatestMessageId = null;
    if (!chatContainer || !chatForm) return;

    async function loadMessages() {
        // Calculate the date 48 hours ago
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
        
        const { data: messages, error } = await sb
            .from('admin_messages')
            .select('*')
            .gte('created_at', fortyEightHoursAgo.toISOString())
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

        const htmlContent = messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

            return `
                <div style="display: flex; justify-content: ${isMe ? 'flex-end' : 'flex-start'}; width: 100%;" data-chat-id="${msg.id}">
                    <div style="max-width: 75%; padding: 14px 18px; border-radius: ${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isMe ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}; position: relative;">
                        <button onclick="deleteAdminMsg('${msg.id}')" style="position:absolute; top:6px; right:6px; background:none; border:none; color:rgba(255,255,255,0.3); cursor:pointer; font-size:0.7rem; padding:4px 6px; border-radius:4px; transition:all 0.2s;" onmouseover="this.style.color='#ff4d4d'; this.style.background='rgba(255,0,0,0.15)'" onmouseout="this.style.color='rgba(255,255,255,0.3)'; this.style.background='none'" title="Delete message">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #fff; margin-bottom: 6px; padding-right: 20px;">
                            ${isMe ? 'You' : msg.sender_name}
                        </div>
                        <p style="font-size: 0.95rem; line-height: 1.5; margin: 0; color: #fff;">${msg.message}</p>
                        <div style="font-size: 0.65rem; color: #fff; opacity: 0.6; margin-top: 8px; text-align: right;">${date}, ${time}</div>
                    </div>
                </div>`;
        }).join('');

        // Only update DOM and scroll if there are new messages or changes
        const currentCount = messages.length;
        const currentLatestId = messages.length > 0 ? messages[messages.length - 1].id : null;
        
        if (currentCount !== lastMessageCount || currentLatestId !== lastLatestMessageId) {
            chatContainer.innerHTML = htmlContent;
            chatContainer.scrollTop = chatContainer.scrollHeight;
            lastMessageCount = currentCount;
            lastLatestMessageId = currentLatestId;
        }
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
async function loadFounderUsersList() {
    const listBody = document.getElementById('founder-users-list');
    if (!listBody) return;

    // Fetch from both tables to map them
    const { data: profiles, error: pErr } = await sb.from('student_profiles').select('*');
    const { data: roles, error: rErr } = await sb.from('profiles').select('*');

    if (pErr || rErr) {
        listBody.innerHTML = `<tr><td colspan="4">Error loading data.</td></tr>`;
        return;
    }

    listBody.innerHTML = profiles.map(student => {
        const userRole = roles.find(r => r.id === student.id)?.role || 'student';
        return `
        <tr>
            <td style="padding: 15px; font-weight: bold;">${student.full_name || 'N/A'}</td>
            <td style="padding: 15px;">${student.email || 'N/A'}</td>
            <td style="padding: 15px;"><span style="color: ${userRole === 'admin' ? 'var(--accent-gold)' : 'white'}; font-weight: 800;">${userRole.toUpperCase()}</span></td>
            <td style="padding: 15px;">
                ${userRole === 'admin' 
                    ? `<button onclick="updateRole('${student.id}', 'student')" class="btn-card" style="background:#ff4d4d; color:white; padding:5px 10px; width:auto; font-size:0.8rem; border:none; cursor:pointer; border-radius:5px;">Demote to Student</button>`
                    : userRole === 'founder'
                        ? '<span style="color:var(--accent-gold); font-weight:900;">[CHIEF ADMIN]</span>'
                        : `<button onclick="updateRole('${student.id}', 'admin')" class="btn-card" style="background:var(--accent-gold); color:black; padding:5px 10px; width:auto; font-size:0.8rem; border:none; cursor:pointer; border-radius:5px;">Promote to Admin</button>`
                }
            </td>
        </tr>
    `;}).join('');
}

window.updateRole = async (targetId, newRole) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    
    // For promoting/demoting, we just update the 'profiles' table.
    // The Profiles table is our single source of truth for Roles.
    const { error } = await sb
        .from('profiles')
        .upsert({ id: targetId, role: newRole });

    if (error) {
        alert("Action Denied: " + error.message);
    } else {
        alert("Role updated! Access level changed.");
        loadFounderUsersList();
    }
}
