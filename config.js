/**
 * config.js — Quantara Alpha Enterprise Configuration
 * ===================================================
 * Centralized configuration for the application.
 * In a production environment with a build pipeline (like Vite or Webpack),
 * these should be replaced with environment variables (e.g., import.meta.env.VITE_SUPABASE_URL).
 * 
 * IMPORTANT: This file must be loaded AFTER security.js but BEFORE main.js and admin.js.
 */

'use strict';

window.APP_CONFIG = Object.freeze({
    // Supabase Connection Settings
    SB_URL: 'https://xdsmthoenrwvbqetigjm.supabase.co',
    SB_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc210aG9lbnJ3dmJxZXRpZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTAyMjUsImV4cCI6MjA4ODIyNjIyNX0.s6RL7lQLDodzai_y0uQl_7ph2ht44s9sNfF8jJ3iwXE',
    
    // Resend API (For email notifications)
    // NOTE: Hardcoding this on client-side is inherently insecure. 
    // This should ideally be moved to a Supabase Edge Function to prevent public exposure.
    RESEND_API_KEY: 're_BZyisSeR_9YdAvzUZ1M4Vv4MLC6eznwKB',
    
    // App Metadata
    APP_NAME: 'Quantara Alpha Enterprise',
    VERSION: '2.1.0',
    SUPPORT_EMAIL: 'admin@quantaraalpha.com',
    SUPPORT_WHATSAPP: 'https://wa.link/pf3fok'
});
