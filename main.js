// Supabase Configuration
const SUPABASE_URL = 'https://nreukhjxnwxulvxhesnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZXVraGp4bnd4dWx2eGhlc25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjI0MDcsImV4cCI6MjA4ODE5ODQwN30.AwVhhO3fUpERM_lhXMPIS59fSAPH6oVtLhyB96FWGOU';

let supabase;

async function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Assets Flow Enterprise ready with Supabase Auth.");

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
    let initialized = await initSupabase();
    if (!initialized) {
        await new Promise(r => setTimeout(r, 1000));
        initialized = await initSupabase();
    }

    if (initialized) {
        const { data: { session } } = await supabase.auth.getSession();

        // Redirect if logged in on auth page
        if (session && window.location.pathname.includes('auth.html')) {
            window.location.href = 'dashboard.html';
            return;
        }

        updateHeader(session);
        handleAuthForms();

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            updateHeader(session);
        });
    }
});

function updateHeader(session) {
    const navActions = document.querySelector('.nav-actions');
    const pricingSection = document.getElementById('pricing');
    const curriculumSection = document.getElementById('curriculum');

    if (!navActions) return;

    if (session) {
        const userEmail = session.user.email;
        navActions.innerHTML = `
            <a href="dashboard.html" class="btn-login" style="margin-right: 15px; border-color: var(--accent-gold); color: var(--accent-gold);">Dashboard</a>
            <span class="user-greeting" style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-right: 15px;">Hello, ${userEmail.split('@')[0]}</span>
            <button id="btn-logout" class="btn-login" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">Logout</button>
        `;
        document.getElementById('btn-logout').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });

        // Un-gate content
        if (pricingSection) pricingSection.classList.remove('content-gated');
        if (curriculumSection) curriculumSection.classList.remove('content-gated');
    } else {
        // Logged out structure
        navActions.innerHTML = `
            <i class="fas fa-search search-icon"></i>
            <a href="auth.html#signup" id="btn-signup-main" class="btn-join">Sign up</a>
            <a href="auth.html" id="btn-login-main" class="btn-login">Log in</a>
        `;

        // Gate content for guests
        if (pricingSection) pricingSection.classList.add('content-gated');
        if (curriculumSection) curriculumSection.classList.add('content-gated');
    }
}

function handleAuthForms() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            setLoading(submitBtn, false, originalBtnText);

            if (error) {
                showMessage(error.message, 'error');
            } else {
                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            setLoading(submitBtn, true);

            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const name = document.getElementById('signup-name').value;

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });
            setLoading(submitBtn, false, originalBtnText);

            if (error) {
                showMessage(error.message, 'error');
            } else {
                showMessage('Success! Please check your email inbox to confirm your account.', 'success');
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
    const menuBtn = document.createElement('div');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';

    const nav = document.querySelector('nav');
    const navLinks = document.querySelector('.nav-links');

    if (nav && navLinks) {
        const logo = document.querySelector('.logo');
        if (logo) {
            nav.insertBefore(menuBtn, logo.nextSibling);
        } else {
            nav.insertBefore(menuBtn, navLinks);
        }

        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuBtn.innerHTML = navLinks.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }
}
