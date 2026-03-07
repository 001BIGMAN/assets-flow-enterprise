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
    document.getElementById('admin-content').style.display = 'block';

    // 2. Setup Navigation
    setupAdminNavigation();

    // 3. Load Data
    loadStudentsOverview();

    // 4. Setup Forms
    setupNotificationForm();
    setupAudioForm();

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
    // In a real scenario with strict RLS, admins need policies that allow them to select all public.profiles
    const { data: profiles, error } = await sb
        .from('profiles')
        .select(`
            id, 
            role, 
            auth_users:id(email, created_at, raw_user_meta_data)
        `)
        .eq('role', 'student');

    const tbody = document.getElementById('students-table-body');
    const totalEl = document.getElementById('stat-total-students');

    if (error) {
        console.error("Error loading students:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="color: red;">Error loading data: ${error.message}. Make sure RLS policies allow admins to view profiles.</td></tr>`;
        return;
    }

    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No students found.</td></tr>';
        totalEl.textContent = '0';
        return;
    }

    totalEl.textContent = profiles.length;
    tbody.innerHTML = '';

    profiles.forEach(p => {
        // Fallbacks since we are joining with an auth table which might be tricky depending on how the view/join is setup
        // Often, creating a secure view linking auth.users and public.profiles is needed if doing complex joins
        const email = p.auth_users?.email || 'Unknown';
        const name = p.auth_users?.raw_user_meta_data?.full_name || 'N/A';
        const date = p.auth_users?.created_at ? new Date(p.auth_users.created_at).toLocaleDateString() : 'Unknown';
        
        let plan = localStorage.getItem(`plan_${p.id}`) || 'Basic'; // We use localStorage for now since we didn't migrate it to DB

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold;">${name}</td>
            <td>${email}</td>
            <td><span style="color: var(--accent-gold);">${plan.toUpperCase()}</span></td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
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

        try {
            const { error } = await sb.from('notifications').insert({
                target_tier: target,
                title: title,
                message: message
            });

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
            const { error: dbError } = await sb.from('audio_recordings').insert({
                title: title,
                target_tier: target,
                file_url: publicUrl,
                file_path: filePath
            });

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
