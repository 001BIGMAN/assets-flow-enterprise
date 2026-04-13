/**
 * security.js — Quantara Alpha Enterprise
 * =========================================
 * Client-side security library: input validation, sanitization,
 * XSS prevention, rate limiting, and abuse protection.
 * 
 * IMPORTANT: This file must be loaded BEFORE main.js and admin.js.
 */

'use strict';

/* ============================================================
   1. INPUT SANITIZATION & VALIDATION
   ============================================================ */

const Security = (() => {

  /**
   * Escapes HTML special characters to prevent XSS when injecting
   * untrusted content into innerHTML.
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Strips ALL HTML tags from a string — safe for textContent contexts.
   */
  function stripHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Validates an email address format (RFC-compliant enough for UI).
   */
  function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return re.test(email.trim()) && email.length <= 254;
  }

  /**
   * Validates password strength:
   * - At least 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one digit
   */
  function validatePassword(pw) {
    if (typeof pw !== 'string') return { valid: false, message: 'Invalid password.' };
    if (pw.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
    if (pw.length > 128) return { valid: false, message: 'Password is too long.' };
    if (!/[A-Z]/.test(pw)) return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    if (!/[a-z]/.test(pw)) return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    if (!/[0-9]/.test(pw)) return { valid: false, message: 'Password must contain at least one number.' };
    return { valid: true, message: 'OK' };
  }

  /**
   * Validates a display name (full name) — only letters, spaces, hyphens, apostrophes.
   */
  function isValidName(name) {
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    return /^[\p{L}\p{M}'\- ]+$/u.test(trimmed);
  }

  /**
   * Sanitizes a text message body — removes script tags and limits length.
   * Used for notification titles/messages submitted through the admin panel.
   */
  function sanitizeMessage(text, maxLength = 2000) {
    if (typeof text !== 'string') return '';
    // Strip script/style/iframe tags specifically
    let cleaned = text
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=/gi, '')   // remove inline event handlers
      .trim();
    if (cleaned.length > maxLength) cleaned = cleaned.substring(0, maxLength);
    return cleaned;
  }

  /**
   * Validates an audio/file title — alphanumeric, spaces, basic punctuation.
   */
  function isValidTitle(str, maxLength = 200) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (trimmed.length < 1 || trimmed.length > maxLength) return false;
    // Block obvious injection sequences
    if (/[<>'"`;\\]/.test(trimmed)) return false;
    return true;
  }

  /**
   * Validates an uploaded audio file:
   * - Must be an allowed MIME type (audio/*)
   * - Must not exceed 50 MB
   */
  const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-m4a'];
  const MAX_FILE_SIZE_MB = 50;

  function validateAudioFile(file) {
    if (!file) return { valid: false, message: 'No file selected.' };
    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return { valid: false, message: `Invalid file type "${file.type}". Only audio files are allowed.` };
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { valid: false, message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` };
    }
    // Double-check file extension
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['mp3', 'mp4', 'm4a', 'ogg', 'wav', 'webm', 'aac', 'flac'];
    if (!allowedExts.includes(ext)) {
      return { valid: false, message: `File extension ".${ext}" is not permitted.` };
    }
    return { valid: true, message: 'OK' };
  }

  /* ============================================================
     2. RATE LIMITING — Client-Side (sessionStorage-backed)
     ============================================================
     These are NOT a replacement for server-side rate limiting,
     but they meaningfully prevent accidental/automated abuse
     from the same browser session.
  ============================================================ */

  const RATE_LIMITS = {
    login:         { max: 5,  windowMs: 5  * 60 * 1000 },  // 5 attempts per 5 minutes
    signup:        { max: 3,  windowMs: 10 * 60 * 1000 },  // 3 per 10 minutes
    passwordReset: { max: 3,  windowMs: 15 * 60 * 1000 },  // 3 per 15 minutes
    notification:  { max: 10, windowMs: 5  * 60 * 1000 },  // 10 notifications per 5 min
    audioUpload:   { max: 5,  windowMs: 10 * 60 * 1000 },  // 5 uploads per 10 min
    passwordChange:{ max: 3,  windowMs: 15 * 60 * 1000 },  // 3 per 15 min
  };

  /**
   * Check if an action is rate-limited.
   * @param {string} action - Key from RATE_LIMITS
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  function checkRateLimit(action) {
    const cfg = RATE_LIMITS[action];
    if (!cfg) return { allowed: true, remaining: 999, retryAfterMs: 0 };

    const storageKey = `rl_${action}`;
    const now = Date.now();
    let record;

    try {
      record = JSON.parse(sessionStorage.getItem(storageKey)) || { attempts: [], windowStart: now };
    } catch {
      record = { attempts: [], windowStart: now };
    }

    // Prune old attempts outside the window
    record.attempts = record.attempts.filter(t => now - t < cfg.windowMs);

    if (record.attempts.length >= cfg.max) {
      const oldest = record.attempts[0];
      const retryAfterMs = cfg.windowMs - (now - oldest);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    // Record this attempt
    record.attempts.push(now);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(record));
    } catch { /* storage full — fail open */ }

    return { allowed: true, remaining: cfg.max - record.attempts.length, retryAfterMs: 0 };
  }

  /**
   * Human-readable countdown for rate-limit feedback.
   */
  function formatRetryTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds} seconds`;
    return `${Math.ceil(totalSeconds / 60)} minutes`;
  }

  /* ============================================================
     3. CONSOLE LOG SUPPRESSION IN PRODUCTION
     ============================================================
     Prevents internal details (session IDs, roles, emails) from
     leaking through browser dev-tools logs.
  ============================================================ */

  function suppressLogsInProduction() {
    // Detect production: not localhost and not a file:// URL
    const isLocal = location.hostname === 'localhost'
      || location.hostname === '127.0.0.1'
      || location.protocol === 'file:';

    if (!isLocal) {
      const noop = () => {};
      window.console.log   = noop;
      window.console.debug = noop;
      window.console.info  = noop;
      // Keep console.warn and console.error for critical visibility
    }
  }

  /* ============================================================
     4. CONTENT SECURITY POLICY HEADER (meta tag injection)
     ============================================================
     Since this is a static site, we inject CSP via meta tag.
     Note: For full protection, set the CSP header on the server.
  ============================================================ */

  function injectCSPMeta() {
    // Only inject if not already present
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;

    const supabaseHost = 'xdsmthoenrwvbqetigjm.supabase.co';
    const csp = [
      `default-src 'self'`,
      `script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com 'unsafe-inline'`,
      `style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'`,
      `font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com`,
      `img-src 'self' data: https: blob:`,
      `media-src 'self' https://${supabaseHost} blob:`,
      `connect-src 'self' https://${supabaseHost} https://api.resend.com wss://${supabaseHost}`,
      `frame-src 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ');

    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', csp);
    document.head.prepend(meta);
  }

  /* ============================================================
     5. SESSION ACTIVITY MONITOR
     ============================================================
     Auto-logs out after 60 minutes of inactivity.
  ============================================================ */

  const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  let _activityTimer = null;
  let _sbRef = null;

  function resetActivityTimer() {
    clearTimeout(_activityTimer);
    _activityTimer = setTimeout(async () => {
      if (_sbRef) {
        console.warn('[Security] Session expired due to inactivity.');
        await _sbRef.auth.signOut();
        window.location.href = 'auth.html?reason=timeout';
      }
    }, SESSION_TIMEOUT_MS);
  }

  function startSessionMonitor(supabaseClient) {
    _sbRef = supabaseClient;
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, resetActivityTimer, { passive: true });
    });
    resetActivityTimer();
  }

  /* ============================================================
     6. CLICKJACKING PROTECTION
     ============================================================ */

  function preventClickjacking() {
    if (window.top !== window.self) {
      // Page is being framed — break out
      window.top.location = window.self.location;
    }
  }

  /* ============================================================
     7. SECURE LOGGING UTILITY
     ============================================================
     Replaces raw console.log calls with context-tagged output
     that is automatically suppressed in production.
  ============================================================ */

  const isDevMode = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:'
  );

  const log = {
    info:  (...a) => { if (isDevMode) console.log('[QAE]', ...a); },
    warn:  (...a) => { console.warn('[QAE WARNING]', ...a); },
    error: (...a) => { console.error('[QAE ERROR]', ...a); },
  };

  /* ============================================================
     PUBLIC API
  ============================================================ */
  return {
    escapeHTML,
    stripHTML,
    isValidEmail,
    validatePassword,
    isValidName,
    sanitizeMessage,
    isValidTitle,
    validateAudioFile,
    checkRateLimit,
    formatRetryTime,
    suppressLogsInProduction,
    injectCSPMeta,
    startSessionMonitor,
    preventClickjacking,
    log,

    /** Call this once at app startup */
    init(supabaseClient) {
      this.preventClickjacking();
      this.suppressLogsInProduction();
      this.injectCSPMeta();
      if (supabaseClient) this.startSessionMonitor(supabaseClient);
      this.log.info('Security module initialized.');
    }
  };
})();

// Make globally available
window.Security = Security;
