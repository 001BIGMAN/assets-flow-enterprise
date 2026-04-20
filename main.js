// Supabase Configuration from centralized config.js
const SUPABASE_URL = window.APP_CONFIG?.SB_URL || "";
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SB_ANON_KEY || "";

let sb;

async function initSupabase() {
  console.log("Initializing Supabase...");
  let retries = 0;
  while (typeof window.supabase === "undefined" && retries < 20) {
    await new Promise((r) => setTimeout(r, 50));
    retries++;
  }

  if (typeof window.supabase !== "undefined") {
    try {
      // Clean the keys (remove any accidental spaces)
      const cleanUrl = SUPABASE_URL.trim();
      const cleanKey = SUPABASE_ANON_KEY.trim();

      console.log("Connecting to Supabase at:", cleanUrl);
      console.log(
        "API Key preview (cleaned):",
        cleanKey.substring(0, 10) + "...",
      );

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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Assets Flow Enterprise ready. Initializing Auth...");

  // Simple reveal animation for hero content
  const heroContent = document.querySelector(".hero-content");
  if (heroContent) {
    heroContent.style.opacity = "0";
    heroContent.style.transform = "translateY(30px)";
    heroContent.style.transition =
      "opacity 0.8s ease-out, transform 0.8s ease-out";

    setTimeout(() => {
      heroContent.style.opacity = "1";
      heroContent.style.transform = "translateY(0)";
    }, 300);
  }

  const initialized = await initSupabase();

  if (initialized) {
    try {
      const {
        data: { session },
        error,
      } = await sb.auth.getSession();
      if (error) throw error;

      console.log(
        "Session check:",
        session
          ? "User logged in as " + session.user.email
          : "No active session",
      );

      // Redirect if logged in on auth page (Optimized with Retry)
      if (session && window.location.pathname.includes("auth.html")) {
        console.log("Checking user role for redirect from auth...");
        
        const checkRole = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            const { data: profile, error } = await sb
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .maybeSingle();
            
            if (!error && profile) return profile.role;
            if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
          }
          return 'student'; // Default to student if all retries fail
        };

        const role = (await checkRole() || '').toLowerCase();
        if (role === "admin" || role === "founder") {
          window.location.replace("admin.html");
        } else {
          window.location.replace("dashboard.html");
        }
        return;
      }

      // Redirect if admin on student dashboard page
      if (session && window.location.pathname.includes("dashboard.html")) {
        console.log("Checking user role for dashboard access...");
        const { data: profile } = await sb
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        const dashRole = profile?.role?.toLowerCase();
        if (dashRole === "admin" || dashRole === "founder") {
          console.log(
            "Admin/Founder detected on student dashboard, redirecting to admin.html",
          );
          window.location.href = "admin.html";
          return;
        }
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
      showMessage("Auth Error: " + e.message, "error");
    }
  } else {
    const authMsg = document.getElementById("auth-message");
    if (authMsg)
      showMessage(
        "Failed to connect to security server. Please refresh.",
        "error",
      );
  }
});

async function updateHeader(session) {
  const navActions = document.querySelector(".nav-actions");
  const pricingSection = document.getElementById("pricing");
  const curriculumSection = document.getElementById("curriculum");
  const heroGuestCTA = document.getElementById("hero-cta-logged-out");
  const heroLoggedInCTA = document.getElementById("hero-cta-logged-in");
  const heroDashboardBtn = document.getElementById("hero-dashboard-btn");
  const heroFounderSection = document.getElementById("hero-founder-section");

  if (!navActions) return;

  if (session) {
    const userId = session.user.id;
    const userEmail = session.user.email;
    
    // 1. Determine Role First (so we know if we should show/hide sales stuff)
    let isAdmin = false;
    try {
      const { data: profile } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile && profile.role) {
        const role = profile.role.toLowerCase();
        if (role === "admin" || role === "founder") {
          isAdmin = true;
        }
      }
    } catch (e) {
      console.error("Error checking role:", e);
    }

    // 2. Global Toggles
    document.querySelectorAll('.hide-when-logged-in').forEach(el => el.style.display = 'none');
    if (heroGuestCTA) heroGuestCTA.style.display = "none";
    if (heroLoggedInCTA) heroLoggedInCTA.style.display = "block";
    if (heroFounderSection) heroFounderSection.style.display = "flex";

    // 3. Admin vs Student Homepage Tweaks
    if (isAdmin) {
      // Hide all sales/pricing elements for Admins permanently
      const sectionsToHide = [
        document.getElementById("pricing"),
        document.getElementById("curriculum"),
        document.querySelector(".access-summary-section"),
        document.querySelector(".why-choose-section"),
        document.querySelector(".who-can-join-section"),
        document.getElementById("final-cta") // any other CTA containers
      ];
      sectionsToHide.forEach(sec => { if (sec) sec.style.display = "none"; });

      // Admin navigation links simplification (hide Pricing for Admins in main nav)
      const navPricingLink = document.querySelector('nav a[href*="#pricing"]');
      if (navPricingLink) navPricingLink.parentElement.style.display = 'none';

      // Welcome Banner Update
      const heroTitle = document.querySelector(".hero-content h1");
      const heroSubtitle = document.querySelector(".hero-content p");
      if (heroTitle) heroTitle.textContent = "Admin Control Center";
      if (heroSubtitle) heroSubtitle.textContent = "You have full administrative access to manage the system, curriculum, and students.";
    } else {
      // START Student-only logic (only runs if NOT admin)
      const savedPlan = localStorage.getItem(`plan_${userId}`);
      if (savedPlan) {
        if (curriculumSection) curriculumSection.style.display = "none";
        const pricingTitle = document.getElementById("pricing-title");
        const pricingSubtitle = document.getElementById("pricing-subtitle");
  
        if (pricingTitle) pricingTitle.textContent = "Upgrade Your Learning Level";
        if (pricingSubtitle) {
            pricingSubtitle.innerHTML = "<p>Unlock advanced sections of the curriculum to continue your growth journey.</p>";
        }
  
        const cardIds = ['card-basic', 'card-level1', 'card-level2', 'card-level3', 'card-level4'];
        let hideList = [];
        if (savedPlan === 'basic') hideList = ['card-basic'];
        if (savedPlan === 'level1') hideList = ['card-basic', 'card-level1'];
        if (savedPlan === 'level2') hideList = ['card-basic', 'card-level1', 'card-level2'];
        if (savedPlan === 'level3') hideList = ['card-basic', 'card-level1', 'card-level2', 'card-level3'];
        if (savedPlan === 'level4') hideList = ['card-basic', 'card-level1', 'card-level2', 'card-level3', 'card-level4'];
        
        hideList.forEach(id => {
           const el = document.getElementById(id);
           if (el) el.style.display = 'none';
        });
  
        if (savedPlan === 'level4') {
            if (pricingSection) pricingSection.style.display = "none";
        }
      }
    }

    const dashboardLink = isAdmin ? "admin.html" : "dashboard.html";
    const dashboardText = isAdmin ? "Admin Dashboard" : "My Dashboard";
    if (heroDashboardBtn) heroDashboardBtn.href = dashboardLink;

    navActions.innerHTML = `
            <span class="user-greeting">Hello, ${userEmail.split("@")[0]}</span>
            <div class="user-nav-btns">
                <a href="${dashboardLink}" class="btn-dashboard">${dashboardText}</a>
                <button id="btn-logout" class="btn-logout-nav">Logout</button>
            </div>
        `;
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        console.log("Logging out...");
        await sb.auth.signOut();
        window.location.replace("index.html");
      });
    }
  } else {
    document.querySelectorAll('.hide-when-logged-in').forEach(el => el.style.display = '');
    // Logged out structure
    navActions.innerHTML = `
            <a href="auth.html#signup" id="btn-signup-main" class="btn-join">Sign up</a>
            <a href="auth.html" id="btn-login-main" class="btn-login">Log in</a>
        `;
    
    if (heroGuestCTA) heroGuestCTA.style.display = "block";
    if (heroLoggedInCTA) heroLoggedInCTA.style.display = "none";
    if (heroFounderSection) heroFounderSection.style.display = "none";
  }
}

function handleAuthForms() {
  console.log("Setting up auth form handlers...");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const resetForm = document.getElementById("reset-password-form");
  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const backToLoginLink = document.getElementById("back-to-login-link");

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginForm) loginForm.classList.remove("active");
      if (signupForm) signupForm.classList.remove("active");
      if (resetForm) resetForm.classList.add("active");
    });
  }

  if (backToLoginLink) {
    backToLoginLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (resetForm) resetForm.classList.remove("active");
      if (loginForm) loginForm.classList.add("active");
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = resetForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      setLoading(submitBtn, true);

      const email = document.getElementById("reset-email").value;

      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth.html",
        });
        setLoading(submitBtn, false, originalBtnText);

        if (error) {
          showMessage(error.message, "error");
        } else {
          showMessage("Password reset link sent! Check your email.", "success");
        }
      } catch (err) {
        setLoading(submitBtn, false, originalBtnText);
        showMessage("An unexpected error occurred.", "error");
      }
    });
  }

  if (loginForm) {
    console.log("Login form detected.");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Login submitted...");
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      setLoading(submitBtn, true);

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password,
        });
        setLoading(submitBtn, false, originalBtnText);

        if (error) {
          console.error("Login error:", error.message);
          showMessage(error.message, "error");
        } else {
          console.log("Login success! User ID:", data.user.id);

          // DEBUG TRACE
          console.log("Fetching profile for role check...");
          const profileResponse = await sb
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();
          console.log("Profile response:", profileResponse);

          const profile = profileResponse.data;

          showMessage("Login successful! Redirecting...", "success");

          setTimeout(() => {
            console.log(
              "Evaluating redirect. Is profile present?",
              !!profile,
              "Role:",
              profile?.role,
            );
            const loginRole = profile?.role?.toLowerCase();
            if (loginRole === "admin" || loginRole === "founder") {
              console.log("Redirecting to admin.html");
              window.location.href = "admin.html";
            } else {
              console.log("Redirecting to dashboard.html");
              window.location.href = "dashboard.html";
            }
          }, 1500);
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
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Signup submitted...");
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      setLoading(submitBtn, true);

      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const nameField = document.getElementById("signup-name");
      const name = nameField ? nameField.value : "";

      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        setLoading(submitBtn, false, originalBtnText);

        if (error) {
          console.error("Signup error:", error.message);
          if (error.message.toLowerCase().includes("user already registered")) {
            // Show rich HTML message with login and forgot password links
            const authMessage = document.getElementById("auth-message");
            if (authMessage) {
              authMessage.innerHTML = 'This email is already registered. Try <a href="#" id="suggest-login" style="color: var(--accent-gold); font-weight: 700; text-decoration: underline;">logging in</a> instead, or <a href="#" id="suggest-forgot" style="color: var(--accent-gold); font-weight: 700; text-decoration: underline;">reset your password</a>.';
              authMessage.className = "auth-message error";
              authMessage.style.display = "block";

              document.getElementById("suggest-login")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                const loginTab = document.querySelector('[data-tab="login"]');
                if (loginTab) loginTab.click();
                authMessage.style.display = "none";
              });

              document.getElementById("suggest-forgot")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
                const resetForm2 = document.getElementById("reset-password-form");
                if (resetForm2) resetForm2.classList.add("active");
                const signupEmail = document.getElementById("signup-email")?.value;
                if (signupEmail) document.getElementById("reset-email").value = signupEmail;
                authMessage.style.display = "none";
              });
            }
          } else {
            showMessage(error.message, "error");
          }
        } else {
          // Supabase quirk: If email confirmation is ON, duplicate emails return
          // a "fake" success with an empty identities array. Detect that here.
          if (data?.user?.identities?.length === 0) {
            // User already exists!
            const authMessage = document.getElementById("auth-message");
            if (authMessage) {
              authMessage.innerHTML = 'This email is already registered. Try <a href="#" id="suggest-login" style="color: var(--accent-gold); font-weight: 700; text-decoration: underline;">logging in</a> instead, or <a href="#" id="suggest-forgot" style="color: var(--accent-gold); font-weight: 700; text-decoration: underline;">reset your password</a>.';
              authMessage.className = "auth-message error";
              authMessage.style.display = "block";

              document.getElementById("suggest-login")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                const loginTab = document.querySelector('[data-tab="login"]');
                if (loginTab) loginTab.click();
                authMessage.style.display = "none";
              });

              document.getElementById("suggest-forgot")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
                const resetForm2 = document.getElementById("reset-password-form");
                if (resetForm2) resetForm2.classList.add("active");
                const signupEmail = document.getElementById("signup-email")?.value;
                if (signupEmail) document.getElementById("reset-email").value = signupEmail;
                authMessage.style.display = "none";
              });
            }
          } else {
            console.log("Signup success!");
            showMessage(
              "Success! Please check your email inbox to confirm your account.",
              "success",
            );
          }
        }
      } catch (err) {
        console.error("Unexpected signup error:", err);
        setLoading(submitBtn, false, originalBtnText);
        showMessage("An unexpected error occurred.", "error");
      }
    });
  }

  // Google Sign-In (works for both login and signup — same OAuth flow)
  const googleLoginBtn = document.getElementById("btn-google-login");
  const googleSignupBtn = document.getElementById("btn-google-signup");

  const handleGoogleSignIn = async () => {
    try {
      showMessage("Redirecting to Google...", "success");
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/dashboard.html",
        },
      });
      if (error) {
        showMessage("Google sign-in failed: " + error.message, "error");
      }
    } catch (err) {
      showMessage("An unexpected error occurred.", "error");
    }
  };

  if (googleLoginBtn)
    googleLoginBtn.addEventListener("click", handleGoogleSignIn);
  if (googleSignupBtn)
    googleSignupBtn.addEventListener("click", handleGoogleSignIn);
}

function setLoading(btn, isLoading, originalText) {
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.style.opacity = "0.7";
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText;
    btn.style.opacity = "1";
  }
}

function showMessage(msg, type) {
  const authMessage = document.getElementById("auth-message");
  if (!authMessage) return;
  authMessage.textContent = msg;
  authMessage.className = `auth-message ${type}`;
  authMessage.style.display = "block";
}


// Course Modal Logic
window.showLevelDetails = function(levelId) {
    const modal = document.getElementById('course-modal');
    const container = document.getElementById('modal-container');
    if (!modal || !container) return;

    const data = {
        'level1': {
            title: 'Level 1: CRYPTO QUICK START',
            sections: [
                {
                    heading: 'Practical Setup',
                    items: [
                        'How to open a crypto exchange account',
                        'How to secure your wallet',
                        'Spot trading basics',
                        'Understanding market cycles'
                    ]
                },
                {
                    heading: 'Outcome',
                    items: [
                        'Understand how the crypto market works',
                        'Have your accounts properly set up',
                        'Be ready to start investing safely'
                    ]
                }
            ]
        },
        'level2': {
            title: 'Level 2: CRYPTO RESEARCH MENTORSHIP',
            sections: [
                {
                    heading: 'Practical Training',
                    items: [
                        'Where to find early projects',
                        'How to analyze whitepapers',
                        'Identifying scams and rug pulls',
                        'Building a profitable crypto portfolio'
                    ]
                },
                {
                    heading: 'Outcome',
                    items: [
                        'Know how to find strong coins early',
                        'Build a solid crypto portfolio',
                        'Avoid most scams in the market'
                    ]
                }
            ]
        },
        'level3': {
            title: 'Level 3: LEVEL ONE FOUNDATION',
            sections: [
                {
                    heading: 'Trading Knowledge',
                    items: [
                        'Market structure',
                        'Liquidity and smart money concepts',
                        'Risk management',
                        'Portfolio allocation strategy'
                    ]
                },
                {
                    heading: 'Investment System',
                    items: [
                        'When to buy',
                        'When to take profit',
                        'When to stay out of the market'
                    ]
                },
                {
                    heading: 'Outcome',
                    items: [
                        'You will gain the knowledge to navigate the market like a professional investor'
                    ]
                }
            ]
        },
        'level4': {
            title: 'Level 4: VIP INVESTOR NETWORK',
            desc: 'This is the highest level inside the community. It is designed for serious investors who want direct mentorship and access to advanced opportunities.',
            sections: [
                {
                    heading: 'Community Privileges',
                    items: [
                        'Exclusive investor group',
                        'Priority support',
                        'Strategy discussions',
                        'Deeper market intelligence'
                    ]
                },
                {
                    heading: 'Outcome',
                    items: [
                        'VIP members are positioned to maximize opportunities during the bull run.'
                    ]
                }
            ]
        }
    };

    const level = data[levelId];
    if (level) {
        let html = `<h2 style="color: var(--accent-gold); margin-bottom: 20px; font-size: 2rem;">${level.title}</h2>`;
        if (level.desc) html += `<p style="line-height: 1.7; opacity: 0.9; margin-bottom: 25px;">${level.desc}</p>`;
        
        level.sections.forEach(s => {
            html += `<h3 style="color: var(--accent-gold); font-size: 1.2rem; margin: 25px 0 15px; text-transform: uppercase; letter-spacing: 1px;">${s.heading}</h3>`;
            html += `<ul class="modal-features" style="list-style: none; margin-bottom: 20px;">`;
            s.items.forEach(item => {
                html += `<li style="padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 12px;"><i class="fas fa-check" style="color: var(--accent-gold);"></i> ${item}</li>`;
            });
            html += `</ul>`;
        });

        container.innerHTML = html;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.showCourseModal = function(courseId) {
    const modal = document.getElementById('course-modal');
    const container = document.getElementById('modal-container');
    if (!modal || !container) return;
    
    // Course data
    const data = {
        'photography': {
            title: 'Photography Masterclass',
            desc: 'A comprehensive journey into the art and science of photography. From understanding your gear to advanced post-processing techniques.',
            features: [
                'Camera Fundamentals (ISO, Shutter, Aperture)',
                'Lighting & Portraiture',
                'Landscape & Street Photography',
                'Adobe Lightroom & Photoshop Workflow',
                'Portfolio Building'
            ]
        },
        'video-editing': {
            title: 'Cinematic Video Editing',
            desc: 'Master the craft of visual storytelling. Learn to manipulate time, sound, and color to create compelling video content.',
            features: [
                'Adobe Premiere Pro & After Effects',
                'Color Grading & Correction',
                'Sound Design & Audio Engineering',
                'Motion Graphics Fundamentals',
                'Exporting for Digital Platforms'
            ]
        },
        'agriculture': {
            title: 'Modern Agriculture & Agribusiness',
            desc: 'Bridging the gap between traditional farming and high-tech agrisolutions. Learn sustainable practices and how to scale an agri-business.',
            features: [
                'Hydroponics & Precision Farming',
                'Crop Management & Soil Health',
                'Agri-Tech & Automation',
                'Supply Chain & Export Logistics',
                'Farm Financial Management'
            ]
        },
        'stock-marketing': {
            title: 'Global Stock Market Analysis',
            desc: 'Navigate the world of global equities with confidence. Learn the strategies used by institutional traders to evaluate and trade stocks.',
            features: [
                'Fundamental Analysis & Valuation',
                'Technical Analysis & Chart Patterns',
                'Risk Management & Position Sizing',
                'Options & Derivatives Basics',
                'Market Psychology & Sentiment'
            ]
        }
    };
    
    const course = data[courseId];
    if (course) {
        let html = `
            <h2 style="color: var(--accent-gold); margin-bottom: 20px; font-size: 2rem;">${course.title}</h2>
            <p style="line-height: 1.7; opacity: 0.9; margin-bottom: 25px;">${course.desc}</p>
            <ul class="modal-features">
                ${course.features.map(f => `<li style="padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 12px;"><i class="fas fa-check" style="color: var(--accent-gold);"></i> ${f}</li>`).join('')}
            </ul>
        `;
        container.innerHTML = html;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.hideCourseModal = function() {
    const modal = document.getElementById('course-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scroll
    }
};

// Close modal on outside click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('course-modal');
    if (e.target === modal) {
        hideCourseModal();
    }
});

// Global Challenge Modal Functions
window.openChallengeModal = function() {
    const modal = document.getElementById("challengeModal");
    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden"; // Prevent background scrolling
    }
};

window.closeChallengeModal = function() {
    const modal = document.getElementById("challengeModal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "auto";
    }
};

// Close challenge modal when clicking outside of it
window.addEventListener("click", function(event) {
    const challengeModal = document.getElementById("challengeModal");
    if (event.target === challengeModal) {
        window.closeChallengeModal();
    }
});
