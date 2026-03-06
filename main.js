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
            <span class="user-greeting">Hello, ${userEmail.split('@')[0]}</span>
            <div class="user-nav-btns">
                <a href="dashboard.html" class="btn-dashboard">My Dashboard</a>
                <button id="btn-logout" class="btn-logout-nav">Logout</button>
            </div>
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
    const resetForm = document.getElementById('reset-password-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginForm) loginForm.classList.remove('active');
            if (signupForm) signupForm.classList.remove('active');
            if (resetForm) resetForm.classList.add('active');
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetForm) resetForm.classList.remove('active');
            if (loginForm) loginForm.classList.add('active');
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('reset-email').value;

            try {
                const { error } = await sb.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/auth.html',
                });
                setLoading(submitBtn, false, originalBtnText);

                if (error) {
                    showMessage(error.message, 'error');
                } else {
                    showMessage('Password reset link sent! Check your email.', 'success');
                }
            } catch (err) {
                setLoading(submitBtn, false, originalBtnText);
                showMessage("An unexpected error occurred.", "error");
            }
        });
    }

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
            console.log("Signup submitted...");
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const nameField = document.getElementById('signup-name');
            const name = nameField ? nameField.value : "";

            try {
                const { data, error } = await sb.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });
                setLoading(submitBtn, false, originalBtnText);

                if (error) {
                    console.error("Signup error:", error.message);
                    let displayMsg = error.message;
                    if (error.message.toLowerCase().includes("user already registered")) {
                        displayMsg = "E-mail is already registered by another user";
                    }
                    showMessage(displayMsg, 'error');
                } else {
                    console.log("Signup success!");
                    showMessage('Success! Please check your email inbox to confirm your account.', 'success');
                }
            } catch (err) {
                console.error("Unexpected signup error:", err);
                setLoading(submitBtn, false, originalBtnText);
                showMessage("An unexpected error occurred.", "error");
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
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');

    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const isOpen = navLinks.classList.contains('active');
            menuBtn.innerHTML = isOpen
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';

            // Inject or remove nav-actions clone inside the mobile panel
            const existingClone = navLinks.querySelector('.mobile-nav-actions-clone');

            if (isOpen && !existingClone) {
                const navActions = document.querySelector('.nav-actions');
                if (navActions && navActions.innerHTML.trim() !== '') {
                    const clone = document.createElement('li');
                    clone.className = 'mobile-nav-actions-clone';
                    clone.innerHTML = navActions.innerHTML;
                    navLinks.appendChild(clone);

                    // Re-attach logout listener on the cloned button
                    const logoutBtn = clone.querySelector('#btn-logout');
                    if (logoutBtn) {
                        logoutBtn.id = 'btn-logout-mobile';
                        logoutBtn.addEventListener('click', async () => {
                            await sb.auth.signOut();
                            window.location.href = 'index.html';
                        });
                    }
                }
            } else if (!isOpen && existingClone) {
                existingClone.remove();
            }
        });

        // Close the panel when any anchor inside it is clicked
        navLinks.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('button')) {
                navLinks.classList.remove('active');
                menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                const clone = navLinks.querySelector('.mobile-nav-actions-clone');
                if (clone) clone.remove();
            }
        });
    }
}
