/**
 * dashboard.js — Quantara Alpha Enterprise
 * =========================================
 * Core logic for the student dashboard.
 * Optimized with security hardening and XSS protection.
 */

'use strict';

const CURRICULUM_DATA = [
    { id: 'basic_1', tier: 'basic', label: 'Introduction to Quantara Alpha' },
    { id: 'basic_2', tier: 'basic', label: 'Join the Community Group' },
    
    // Level 1
    { id: 'l1_1', tier: 'level1', label: 'The Evolution of Money & Crypto' },
    { id: 'l1_2', tier: 'level1', label: 'How Blockchain Works (Simplified)' },
    { id: 'l1_3', tier: 'level1', label: 'Practical: Wallet & Exchange Setup' },
    { id: 'l1_4', tier: 'level1', label: 'Practical: Spot Trading Basics' },
    
    // Level 2
    { id: 'l2_1', tier: 'level2', label: 'How to Research Crypto Projects' },
    { id: 'l2_2', tier: 'level2', label: 'Tokenomics & Fundamental Analysis' },
    { id: 'l2_3', tier: 'level2', label: 'Identifying Scams & Rug Pulls' },
    { id: 'l2_4', tier: 'level2', label: 'Building a Profitable Crypto Portfolio' },
    
    // Level 3
    { id: 'l3_1', tier: 'level3', label: 'Smart Money & Liquidity Concepts' },
    { id: 'l3_2', tier: 'level3', label: 'Professional Bull Run Positioning' },
    { id: 'l3_3', tier: 'level3', label: 'Advanced Risk Management Strategy' },
    { id: 'l3_4', tier: 'level3', label: 'System: When to Buy & Take Profit' },
    
    // Level 4
    { id: 'l4_1', tier: 'level4', label: 'Direct Mentorship Access' },
    { id: 'l4_2', tier: 'level4', label: 'VIP Market Breakdowns' },
    { id: 'l4_3', tier: 'level4', label: 'Early Project Insights & Intelligence' }
];

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to initialize
    let checkInterval = setInterval(async () => {
        if (typeof sb !== 'undefined') {
            clearInterval(checkInterval);
            initDashboard();
        }
    }, 100);
});

async function initDashboard() {
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
        window.location.href = 'auth.html';
        return;
    }

    const user = session.user;
    const userId = user.id;

    // --- 1. Admin/Founder Redirect Check ---
    try {
        const { data: roleCheck, error: roleErr } = await sb
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
        
        if (!roleErr && roleCheck && roleCheck.role) {
            const r = roleCheck.role.toLowerCase();
            if (r === 'admin' || r === 'founder') {
                window.location.replace('admin.html');
                return;
            }
        }
    } catch(e) {
        Security.log.error('Dashboard role check failed:', e);
    }

    // --- 2. Initialize State ---
    window._currentUserId = userId; 
    const rawDisplayName = user.user_metadata?.full_name || user.email.split('@')[0];
    document.getElementById('user-display-name').textContent = Security.stripHTML(rawDisplayName);

    const checklistContainer = document.getElementById('checklist-container');
    const planSelect = document.getElementById('user-plan-select');
    
    let savedPlan = localStorage.getItem(`plan_${userId}`) || 'basic';
    let progressData = JSON.parse(localStorage.getItem(`progress_${userId}`)) || {};

    if (planSelect) {
        planSelect.value = savedPlan;
        planSelect.addEventListener('change', (e) => {
            const newPlan = e.target.value;
            localStorage.setItem(`plan_${userId}`, newPlan);
            if (document.getElementById('current-plan-display')) {
                document.getElementById('current-plan-display').textContent = newPlan;
            }
            renderCurriculum(newPlan, progressData);
            loadStudentData(newPlan, userId, user.created_at);
        });
        
        if (document.getElementById('current-plan-display')) {
            document.getElementById('current-plan-display').textContent = savedPlan;
        }
    }

    // --- 3. UI Interactions (Sidebar/Tabs) ---
    setupSidebarToggle();
    setupTabSwitching();

    // --- 4. Load Data ---
    renderCurriculum(savedPlan, progressData);
    await loadStudentData(savedPlan, userId, user.created_at);

    // --- 5. Form Handlers ---
    setupChangePasswordForm();
}

/**
 * Loads both notifications and audio recordings for the current student.
 */
async function loadStudentData(currentPlan, userId, userCreatedAt) {
    const notifList = document.getElementById('notifications-list');
    const recordingsList = document.getElementById('recordings-list');
    const userSignupDate = new Date(userCreatedAt);

    // --- Fetch Notifications ---
    try {
        const { data: notifications, error } = await sb.from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const visibleNotifs = (notifications || []).filter(n => {
            const notifDate = new Date(n.created_at);
            // Ignore very old notifications from before the relaunch
            if (notifDate < new Date('2026-03-20T19:50:00+01:00')) return false;
            // Only show notifications sent on or after the user's signup date
            if (notifDate < userSignupDate) return false;

            if (n.target_tier === 'all') return true;
            if (n.target_tier === 'basic') return currentPlan === 'basic';
            if (n.target_tier === 'level1') return currentPlan === 'level1';
            if (n.target_tier === 'level2') return currentPlan === 'level2';
            if (n.target_tier === 'level3') return currentPlan === 'level3';
            if (n.target_tier === 'level4') return currentPlan === 'level4';
            if (n.target_tier === 'individual' && n.target_user_id === userId) return true;
            return false;
        });

        // Hide badge if zero
        const badge = document.getElementById('notif-badge');
        const deletedNotifs = JSON.parse(localStorage.getItem(`deleted_notifs_${userId}`) || '[]');
        const finalNotifs = visibleNotifs.filter(n => !deletedNotifs.includes(n.id));

        if (badge) {
            badge.textContent = finalNotifs.length;
            badge.style.display = finalNotifs.length > 0 ? 'inline-block' : 'none';
        }

        if (notifList) {
            if (finalNotifs.length === 0) {
                notifList.innerHTML = `
                    <div style="text-align:center; padding: 60px 20px; opacity: 0.5;">
                        <i class="fas fa-bell-slash fa-3x" style="color: var(--accent-gold); margin-bottom: 20px;"></i>
                        <p style="font-size: 1rem;">No notifications yet. Check back soon!</p>
                    </div>`;
            } else {
                notifList.innerHTML = finalNotifs.map(n => `
                    <div class="notification-card" data-notif-id="${n.id}"
                         style="background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.2); border-left: 4px solid var(--accent-gold); padding: 22px 25px; border-radius: 12px; margin-bottom: 16px; position: relative;">
                        <button onclick="deleteNotification('${n.id}', \`${Security.escapeHTML(n.title).replace(/'/g, "\\'")}\`)" 
                                style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px; padding-right: 40px;">
                            <h4 style="color: var(--accent-gold); font-size: 1rem; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-bullhorn"></i> ${Security.escapeHTML(n.title)}
                            </h4>
                            <span style="font-size: 0.75rem; opacity: 0.5; white-space:nowrap; margin-left:15px;">
                                ${new Date(n.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p style="font-size: 0.95rem; line-height: 1.7; opacity: 0.85;">${Security.sanitizeMessage(n.message)}</p>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        Security.log.error("Error loading notifications:", err);
        if (notifList) notifList.innerHTML = '<p style="color: #ff4d4d; text-align:center;">Failed to load notifications.</p>';
    }

    // --- Fetch Audio Recordings ---
    try {
        const { data: recordings, error } = await sb.from('audio_recordings')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const deletedRecs = JSON.parse(localStorage.getItem(`deleted_recs_${userId}`) || '[]');
        const visibleRecordings = (recordings || []).filter(rec => {
            if (deletedRecs.includes(rec.id)) return false;
            // Individual recordings
            if (rec.target_tier === 'individual' && rec.target_user_id === userId) return true;
            // Tier-based
            if (rec.target_tier === 'all') return currentPlan !== 'basic';
            if (rec.target_tier === 'level1') return currentPlan !== 'basic';
            if (rec.target_tier === 'level2') return ['level2', 'level3', 'level4'].includes(currentPlan);
            if (rec.target_tier === 'level3') return ['level3', 'level4'].includes(currentPlan);
            if (rec.target_tier === 'level4') return currentPlan === 'level4';
            return false;
        });

        if (recordingsList) {
            if (visibleRecordings.length === 0) {
                recordingsList.innerHTML = `
                    <div style="text-align:center; padding: 60px 20px; opacity: 0.5;">
                        <i class="fas fa-headphones fa-3x" style="color: var(--accent-gold); margin-bottom: 20px;"></i>
                        <p style="font-size: 1rem;">No recordings available for your plan yet.</p>
                    </div>`;
            } else {
                recordingsList.innerHTML = visibleRecordings.map(rec => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.15); padding: 22px 25px; border-radius: 12px; margin-bottom: 20px; position: relative;" data-rec-id="${rec.id}">
                        <button onclick="deleteRecording('${rec.id}', \`${Security.escapeHTML(rec.title).replace(/'/g, "\\'")}\`)" 
                                style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 15px; padding-right: 40px;">
                            <div style="width:42px; height:42px; background: rgba(212,175,55,0.15); border-radius:50%; display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-microphone" style="color: var(--accent-gold);"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-white); font-size: 1rem; margin-bottom: 3px;">${Security.escapeHTML(rec.title)}</h4>
                                <span style="font-size: 0.75rem; opacity: 0.5;">${new Date(rec.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <audio controls style="width:100%; border-radius: 8px; outline:none;" preload="none">
                            <source src="${Security.escapeHTML(rec.file_url)}" type="audio/mpeg">
                        </audio>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        Security.log.error("Error loading recordings:", err);
        if (recordingsList) recordingsList.innerHTML = '<p style="color: #ff4d4d; text-align:center;">Failed to load recordings.</p>';
    }
}

/**
 * Renders the curriculum checklist based on the user's tier.
 */
function renderCurriculum(plan, progressData) {
    const container = document.getElementById('checklist-container');
    const titleEl = document.getElementById('curriculum-title');
    if (!container) return;

    container.innerHTML = '';
    let accessibleItems = [];

    const segments = {
        'basic': ['basic'],
        'level1': ['basic', 'level1'],
        'level2': ['basic', 'level1', 'level2'],
        'level3': ['basic', 'level1', 'level2', 'level3'],
        'level4': ['basic', 'level1', 'level2', 'level3', 'level4']
    };

    const activeSegments = segments[plan] || segments['basic'];
    accessibleItems = CURRICULUM_DATA.filter(i => activeSegments.includes(i.tier));
    
    if (titleEl) titleEl.textContent = `${plan.charAt(0).toUpperCase() + plan.slice(1)} Access Progress`;

    accessibleItems.forEach(item => {
        const isChecked = progressData[item.id] || false;
        const div = document.createElement('div');
        div.className = `check-item ${isChecked ? 'completed' : ''}`;
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = item.id;
        cb.checked = isChecked;
        
        const label = document.createElement('span');
        label.textContent = item.label;

        div.appendChild(cb);
        div.appendChild(label);

        const updateHandler = (e) => {
            const checked = cb.checked;
            progressData[item.id] = checked;
            localStorage.setItem(`progress_${window._currentUserId}`, JSON.stringify(progressData));
            div.classList.toggle('completed', checked);
            calculateOverallProgress(activeSegments, progressData);
        };

        cb.addEventListener('change', updateHandler);
        div.addEventListener('click', (e) => {
            if (e.target !== cb) {
                cb.checked = !cb.checked;
                updateHandler();
            }
        });

        container.appendChild(div);
    });

    calculateOverallProgress(activeSegments, progressData);
}

function calculateOverallProgress(activeSegments, progressData) {
    const filteredItems = CURRICULUM_DATA.filter(i => activeSegments.includes(i.tier));
    if (filteredItems.length === 0) return;

    const completed = filteredItems.filter(i => progressData[i.id]).length;
    const percent = Math.round((completed / filteredItems.length) * 100);

    const percentEl = document.getElementById('progress-percent');
    const barEl = document.getElementById('progress-bar');
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;
}

function setupSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('mobile-sidebar-toggle');
    if (!toggle || !sidebar) return;

    const handler = () => {
        sidebar.classList.toggle('active');
        overlay?.classList.toggle('active');
        const icon = toggle.querySelector('span.material-symbols-outlined');
        if (icon) {
            if (sidebar.classList.contains('active')) {
                icon.textContent = 'close';
            } else {
                icon.textContent = 'menu';
            }
        }
    };

    toggle.addEventListener('click', handler);
    overlay?.addEventListener('click', handler);
}

function setupTabSwitching() {
    const links = document.querySelectorAll('.sidebar-nav a[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-tab');

            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            contents.forEach(tab => {
                tab.classList.toggle('active', tab.id === target);
            });

            if (window.innerWidth <= 991) {
                document.querySelector('.sidebar').classList.remove('active');
                document.getElementById('sidebar-overlay').classList.remove('active');
            }
        });
    });
}

function setupChangePasswordForm() {
    const form = document.getElementById('change-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgDiv = document.getElementById('change-pw-message');
        const currentPw = document.getElementById('current-password').value;
        const newPw = document.getElementById('settings-new-password').value;
        const confirmPw = document.getElementById('settings-confirm-password').value;
        const submitBtn = form.querySelector('button[type="submit"]');

        const showError = (m) => {
            msgDiv.textContent = m;
            msgDiv.style.display = 'block';
            msgDiv.style.background = 'rgba(255,0,0,0.15)';
            msgDiv.style.color = '#ff6b6b';
            msgDiv.style.border = '1px solid rgba(255,0,0,0.3)';
        };

        // --- 1. Validation ---
        if (newPw !== confirmPw) return showError('New passwords do not match!');
        const pwCheck = Security.validatePassword(newPw);
        if (!pwCheck.valid) return showError(pwCheck.message);

        // --- 2. Rate Limiting ---
        const rl = Security.checkRateLimit('passwordChange');
        if (!rl.allowed) return showError(`Too many attempts. Wait ${Security.formatRetryTime(rl.retryAfterMs)}.`);

        submitBtn.disabled = true;
        const originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        msgDiv.style.display = 'none';

        try {
            const { data: { session } } = await sb.auth.getSession();
            const { error: signInErr } = await sb.auth.signInWithPassword({
                email: session.user.email,
                password: currentPw
            });

            if (signInErr) {
                showError('Current password is incorrect.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
                return;
            }

            const { error: updateErr } = await sb.auth.updateUser({ password: newPw });

            if (updateErr) {
                showError(updateErr.message);
            } else {
                msgDiv.innerHTML = '&#9989; Password changed successfully!';
                msgDiv.style.display = 'block';
                msgDiv.style.background = 'rgba(212,175,55,0.15)';
                msgDiv.style.color = 'var(--accent-gold)';
                msgDiv.style.border = '1px solid rgba(212,175,55,0.3)';
                form.reset();
            }
        } catch (err) {
            Security.log.error('Password change critical error:', err);
            showError('An unexpected error occurred.');
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
    });
}

// --- Global helper functions (still needed for inline onclick) ---
window.deleteNotification = function(notifId, notifTitle) {
    if (!confirm(`Delete notification "${Security.stripHTML(notifTitle)}"?`)) return;
    const userId = window._currentUserId;
    const key = `deleted_notifs_${userId}`;
    const deleted = JSON.parse(localStorage.getItem(key) || '[]');
    if (!deleted.includes(notifId)) {
        deleted.push(notifId);
        localStorage.setItem(key, JSON.stringify(deleted));
    }
    const card = document.querySelector(`[data-notif-id="${notifId}"]`);
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        card.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            card.remove();
            const count = document.querySelectorAll('[data-notif-id]').length;
            const badge = document.getElementById('notif-badge');
            if (badge) {
                badge.textContent = count;
                if (count === 0) badge.style.display = 'none';
            }
        }, 300);
    }
};

window.deleteRecording = function(recId, recTitle) {
    if (!confirm(`Delete recording "${Security.stripHTML(recTitle)}"?`)) return;
    const userId = window._currentUserId;
    const key = `deleted_recs_${userId}`;
    const deleted = JSON.parse(localStorage.getItem(key) || '[]');
    if (!deleted.includes(recId)) {
        deleted.push(recId);
        localStorage.setItem(key, JSON.stringify(deleted));
    }
    const card = document.querySelector(`[data-rec-id="${recId}"]`);
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        card.style.transition = 'all 0.3s ease';
        setTimeout(() => card.remove(), 300);
    }
};
