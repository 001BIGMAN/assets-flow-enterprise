// Supabase Configuration
const SUPABASE_URL = 'https://xdsmthoenrwvbqetigjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc210aG9lbnJ3dmJxZXRpZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTAyMjUsImV4cCI6MjA4ODIyNjIyNX0.s6RL7lQLDodzai_y0uQl_7ph2ht44s9sNfF8jJ3iwXE';

let sb;

async function initSupabase() {
    console.log("Initializing Supabase...");
    let retries = 0;
    while (typeof window.supabase === 'undefined' && retries < 10) {
        console.log(`Waiting for Supabase SDK... (Attempt ${retries + 1})`);
        await new Promise(r => setTimeout(r, 500));
        retries++;
    }

    if (typeof window.supabase !== 'undefined') {
        try {
            // Clean the keys (remove any accidental spaces)
            const cleanUrl = SUPABASE_URL.trim();
            const cleanKey = SUPABASE_ANON_KEY.trim();

            console.log("Connecting to Supabase at:", cleanUrl);
            console.log("API Key preview (cleaned):", cleanKey.substring(0, 10) + "...");

            sb = window.supabase.createClient(cleanUrl, cleanKey);
            console.log("Supabase successfully initialized.");
            return true;
        } catch (e) {
            console.error("Failed to create Supabase client:", e);
        }
    } else {
        console.error("Supabase SDK failed to load after 5 seconds.");
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Assets Flow Enterprise ready. Initializing Auth...");

    // Simple reveal animation for hero content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(30px)';
        heroContent.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';

        setTimeout(() => {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 300);
    }

    // Mobile Menu
    setupMobileMenu();

    // Supabase Initialization
    const initialized = await initSupabase();

    if (initialized) {
        try {
            const { data: { session }, error } = await sb.auth.getSession();
            if (error) throw error;

            console.log("Session check:", session ? "User logged in as " + session.user.email : "No active session");

            // Redirect if logged in on auth page
            if (session && window.location.pathname.includes('auth.html')) {
                console.log("Redirecting to dashboard...");
                window.location.href = 'dashboard.html';
                return;
            }

            updateHeader(session);
            handleAuthForms();

            // Listen for auth changes
            sb.auth.onAuthStateChange((_event, session) => {
                console.log("Auth state changed:", _event);
                updateHeader(session);

                if (_event === 'PASSWORD_RECOVERY') {
                    // Check if we have a showView function (in auth.html)
                    if (typeof window.showView === 'function') {
                        window.showView('reset');
                    } else if (window.location.pathname.includes('auth.html')) {
                        // If not yet loaded, wait a bit
                        setTimeout(() => {
                            if (typeof window.showView === 'function') window.showView('reset');
                        }, 500);
                    }
                }
            });
        } catch (e) {
            console.error("Auth initialization error:", e);
            showMessage("Auth Error: " + e.message, 'error');
        }
    } else {
        const authMsg = document.getElementById('auth-message');
        if (authMsg) showMessage("Failed to connect to security server. Please refresh.", "error");
    }
});

function updateHeader(session) {
    const navActions = document.querySelector('.nav-actions');
    const pricingSection = document.getElementById('pricing');
    const curriculumSection = document.getElementById('curriculum');

    if (!navActions) return;

    if (session) {
        const userEmail = session.user.email;
        const userId = session.user.id;
        const savedPlan = localStorage.getItem(`plan_${userId}`);

        if (savedPlan) {
            if (pricingSection) pricingSection.style.display = 'none';
            if (curriculumSection) curriculumSection.style.display = 'none';
        }

        navActions.innerHTML = `
            <span class="user-greeting" style="color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-right: 15px; font-weight: 500; display: inline-block; vertical-align: middle;">Hello, ${userEmail.split('@')[0]}</span>
            <a href="dashboard.html" class="btn-login" style="margin-right: 15px; background-color: var(--accent-gold) !important; color: #000 !important; display: inline-block;">My Dashboard</a>
            <button id="btn-logout" class="btn-login" style="background-color: var(--accent-gold) !important; color: #000 !important; border: none; cursor: pointer;">Logout</button>
        `;
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                console.log("Logging out...");
                await sb.auth.signOut();
                window.location.href = 'index.html';
            });
        }
    } else {
        // Logged out structure
        navActions.innerHTML = `
            <i class="fas fa-search search-icon"></i>
            <a href="auth.html#signup" id="btn-signup-main" class="btn-join">Sign up</a>
            <a href="auth.html" id="btn-login-main" class="btn-login">Log in</a>
        `;
    }
}

function handleAuthForms() {
    console.log("Setting up auth form handlers...");
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        console.log("Login form detected.");
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Login submitted...");
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const { data, error } = await sb.auth.signInWithPassword({ email, password });
                setLoading(submitBtn, false, originalBtnText);

                if (error) {
                    console.error("Login error:", error.message);
                    showMessage(error.message, 'error');
                } else {
                    console.log("Login success!");
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = 'dashboard.html', 1500);
                }
            } catch (err) {
                console.error("Unexpected login error:", err);
                setLoading(submitBtn, false, originalBtnText);
                showMessage("An unexpected error occurred.", "error");
            }
        });
    }

    if (signupForm) {
        console.log("Signup form detected.");
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const name = document.getElementById('signup-name')?.value || "";

            try {
                const { error } = await sb.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });
                setLoading(submitBtn, false, originalBtnText);

                if (error) {
                    if (error.status === 422 || error.message.includes("already registered")) {
                        showMessage("This email is already registered. Please log in instead.", "error");
                    } else {
                        showMessage(error.message, 'error');
                    }
                } else {
                    showMessage('Success! Please check your email inbox to confirm your account.', 'success');
                }
            } catch (err) {
                setLoading(submitBtn, false, originalBtnText);
                showMessage("An unexpected error occurred.", "error");
            }
        });
    }

    // Forgot Password Form Handler
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('forgot-email').value;
            try {
                const { error } = await sb.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + window.location.pathname + '#reset'
                });
                setLoading(submitBtn, false, originalText);
                if (error) showMessage(error.message, 'error');
                else showMessage("Reset link sent! Please check your email.", "success");
            } catch (err) {
                setLoading(submitBtn, false, originalText);
                showMessage("Failed to send reset link.", "error");
            }
        });
    }

    // Password Update Form Handler
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const password = document.getElementById('new-password').value;
            try {
                const { error } = await sb.auth.updateUser({ password });
                setLoading(submitBtn, false, originalText);
                if (error) showMessage(error.message, 'error');
                else {
                    showMessage("Password updated successfully! Redirecting...", "success");
                    setTimeout(() => window.location.href = 'dashboard.html', 1500);
                }
            } catch (err) {
                setLoading(submitBtn, false, originalText);
                showMessage("Failed to update password.", "error");
            }
        });
    }
}

function setLoading(btn, isLoading, originalText) {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.style.opacity = '0.7';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
    }
}

function showMessage(msg, type) {
    const authMessage = document.getElementById('auth-message');
    if (!authMessage) return;
    authMessage.textContent = msg;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
}

function setupMobileMenu() {
    const nav = document.querySelector('nav');
    const navLinks = document.querySelector('.nav-links');
    if (!nav || !navLinks) return;

    // Check if button already exists to prevent duplicate
    let menuBtn = document.querySelector('.mobile-menu-btn');
    if (!menuBtn) {
        menuBtn = document.createElement('div');
        menuBtn.className = 'mobile-menu-btn';
        menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        menuBtn.style.color = 'var(--accent-gold)';
        menuBtn.style.fontSize = '1.8rem';
        menuBtn.style.cursor = 'pointer';
        menuBtn.style.display = 'none'; // Controlled by CSS @media

        const logo = document.querySelector('.logo');
        if (logo) {
            nav.insertBefore(menuBtn, logo.nextSibling);
        } else {
            nav.insertBefore(menuBtn, navLinks);
        }
    }

    const toggleMenu = () => {
        navLinks.classList.toggle('active');
        const isActive = navLinks.classList.contains('active');
        menuBtn.innerHTML = isActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        document.body.style.overflow = isActive ? 'hidden' : '';
    };

    menuBtn.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                toggleMenu();
            }
        });
    });
}
