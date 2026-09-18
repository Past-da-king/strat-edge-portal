/*!
 * Strat Edge in-app feedback widget (bug report / idea / other).
 *
 * Drop-in, no dependencies, framework-agnostic. It:
 *   1. captures console errors and failed network calls from PAGE LOAD (install the snippet early);
 *   2. renders a floating "Feedback" button that themes itself to the host app (light AND dark, the
 *      app's own font) and steps above a fixed bottom nav on phones;
 *   3. opens a side panel (full screen on phones) with: type, description, a voice note, pictures
 *      (drop, paste, browse, plus a picture of the page taken the moment it opened), and sends it all
 *      to the Strat Edge feedback ingest, which wakes a DeepSeek agent in A.O.S.
 *
 * Redesigned 18 Sep 2026 (Marcus, goal g2fdc62cf) after Ayanda rejected the first look: "the background
 * is black, the background where you write is black, the font is black, the upload button is a square
 * and it's not styled... If it looks like shit, it's basically shit."
 *
 * WHY SHADOW DOM: the host's CSS never reaches in (Tailwind preflight, a global `button{transition:all}`,
 * a dark body colour), and ours never leaks out. Every colour is pinned from our own tokens; nothing
 * is inherited except the font family, which we read from the host on purpose.
 *
 * INSTALL (see README.md):
 *   <script>window.STRAT_EDGE_REPORT={app:"Prospect",version:"",ingest:"https://.../report",user:()=>currentUser()};</script>
 *   <script src="/report-widget.js" defer></script>
 * Optional config: accent ('#0ea5e9'), theme ('auto'|'light'|'dark'|fn), font, launcherBottom (px),
 * voiceMaxSeconds (90), voiceMaxKb (4096), html2canvas (script URL).
 *
 * PAYLOAD (unchanged from the first version, so the ingest needs no change):
 *   { app, version, url, route, title, user, userAgent, language, viewport, referrer, errors,
 *     failed_requests, at, type, description, attachments:[{name,type,size,data,kind?}],
 *     screenshot: "data:image/jpeg;base64,..." | null, token }
 *
 * NO INGEST / OFFLINE: if the app has no ingest configured, or the network or server fails, the report
 * is kept in IndexedDB on this device and sent automatically on a later page load once it can be.
 * The panel says so in plain words. A report is never silently dropped.
 */
(function () {
  'use strict';
  var CFG = window.STRAT_EDGE_REPORT || {};
  var STATE = window.__SE_REPORT_STATE || (window.__SE_REPORT_STATE = {
    errors: [], failed: [], installed: false
  });

  // ---- 1. EARLY CAPTURE (idempotent; safe to run before the app boots) ----------------------------
  if (!STATE.installed) {
    STATE.installed = true;
    var MAX = 25;
    var push = function (arr, v) { arr.push(v); if (arr.length > MAX) arr.shift(); };

    var origError = console.error;
    console.error = function () {
      try {
        push(STATE.errors, {
          t: Date.now(),
          msg: Array.prototype.map.call(arguments, function (a) {
            try { return typeof a === 'string' ? a : (a && a.message) || JSON.stringify(a); }
            catch (e) { return String(a); }
          }).join(' ').slice(0, 500)
        });
      } catch (e) {}
      return origError.apply(console, arguments);
    };
    window.addEventListener('error', function (e) {
      push(STATE.errors, { t: Date.now(), msg: String((e && e.message) || 'error').slice(0, 500), src: e && e.filename });
    });
    window.addEventListener('unhandledrejection', function (e) {
      push(STATE.errors, { t: Date.now(), msg: ('unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason)).slice(0, 500) });
    });

    var note = function (method, url, status) {
      if (status >= 400) push(STATE.failed, { t: Date.now(), method: method, url: String(url).slice(0, 300), status: status });
    };
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input, init) {
        var url = (typeof input === 'string') ? input : (input && input.url);
        var method = (init && init.method) || (input && input.method) || 'GET';
        var p = origFetch.apply(this, arguments);
        try {
          // Never record our own reports (and never record the ingest host).
          p.then(function (r) { if (!/feedback|report-widget|\/report\b/i.test(String(url))) note(method, url, r.status); },
                 function () { note(method, url, 0); });
        } catch (e) {}
        return p;
      };
    }
    var XP = XMLHttpRequest.prototype;
    var origOpen = XP.open, origSend = XP.send;
    XP.open = function (m, u) { this.__se_m = m; this.__se_u = u; return origOpen.apply(this, arguments); };
    XP.send = function () {
      var xhr = this;
      try {
        xhr.addEventListener('load', function () {
          if (!/feedback|report-widget/i.test(String(xhr.__se_u))) note(xhr.__se_m, xhr.__se_u, xhr.status);
        });
        xhr.addEventListener('error', function () { note(xhr.__se_m, xhr.__se_u, 0); });
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  }

  if (typeof document === 'undefined' || window.__SE_REPORT_UI) return;
  window.__SE_REPORT_UI = true;

  // ---- 2. SMALL HELPERS ---------------------------------------------------------------------------
  var ACCENT = CFG.accent || '#0ea5e9';
  var VOICE_MAX_MS = (CFG.voiceMaxSeconds || 90) * 1000;
  var VOICE_MAX_BYTES = (CFG.voiceMaxKb || 4096) * 1024;     // the ingest body cap is 12MB
  var BODY_BUDGET = 11 * 1024 * 1024;                        // stay under that cap with room to spare
  var MAX_FILES = 5;
  var DRAFT_KEY = 'se-report-draft';

  // Icons: Lucide (ISC licence), the same set the Portal already uses, inlined so there is no dependency.
  var ICON = {
    feedback: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
    bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    idea: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    other: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    image: '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" x2="22" y1="5" y2="5"/><line x1="19" x2="19" y1="2" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    play: '<polygon points="7 4 20 12 7 20 7 4"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    offline: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
  };
  function icon(name, size) {
    return '<svg class="ic" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function h(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtSize(b) { return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }

  // ---- 3. THEME + FONT: follow the host, live ------------------------------------------------------
  // Order matters. The Portal toggles a `dark` class on <html> but keeps a hard-coded dark background
  // on <body> in BOTH modes, so body luminance alone would call its light mode "dark".
  function lum(rgb) {
    var m = String(rgb).match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/);
    if (!m || (m[4] != null && +m[4] < 0.5)) return null;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  }
  function hostTheme() {
    if (typeof CFG.theme === 'function') { try { return CFG.theme() === 'dark' ? 'dark' : 'light'; } catch (e) {} }
    if (CFG.theme === 'dark' || CFG.theme === 'light') return CFG.theme;
    var de = document.documentElement, b = document.body;
    var attr = function (n) { return (n && (n.getAttribute('data-theme') || n.getAttribute('data-mode') || n.getAttribute('data-color-scheme'))) || ''; };
    if (de.classList.contains('dark') || (b && b.classList.contains('dark')) || /dark/i.test(attr(de) + attr(b))) return 'dark';
    if (de.classList.contains('light') || (b && b.classList.contains('light')) || /light/i.test(attr(de) + attr(b))) return 'light';
    var cs = getComputedStyle(de).colorScheme || '';
    if (/^dark/.test(cs)) return 'dark';
    if (/^light/.test(cs)) return 'light';
    var l = lum(getComputedStyle(de).backgroundColor);
    if (l == null && b) l = lum(getComputedStyle(b).backgroundColor);
    if (l != null) return l < 0.45 ? 'dark' : 'light';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function hostFont() {
    if (CFG.font) return CFG.font;
    var f = document.body ? getComputedStyle(document.body).fontFamily : '';
    return f || 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.root{--accent:' + ACCENT + ';font-family:var(--font);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;color:var(--text)}',
    // LIGHT tokens (every text pair measured at 4.5:1 or better on its surface)
    '.root[data-theme=light]{--bg:#ffffff;--field:#f8fafc;--raise:#f1f5f9;--line:#e2e8f0;--line-strong:#cbd5e1;--text:#0f172a;--text-2:#475569;--text-3:#64748b;',
    '--accent-ink:#0369a1;--on-accent:#04202f;--accent-soft:color-mix(in srgb,var(--accent) 12%,#ffffff);--danger:#e11d48;--danger-ink:#be123c;--danger-soft:#fff1f2;',
    '--ok:#047857;--scrim:rgba(15,23,42,.38);--shadow:0 24px 60px -12px rgba(15,23,42,.28),0 2px 6px rgba(15,23,42,.06);--lshadow:0 10px 28px -6px color-mix(in srgb,var(--accent) 55%,transparent)}',
    // DARK tokens, matched to the Portal's own dark surfaces (#0a0a0c page, #16161a cards)
    '.root[data-theme=dark]{--bg:#131317;--field:#0c0c0f;--raise:#1c1c22;--line:#26262e;--line-strong:#363640;--text:#f1f5f9;--text-2:#a8b3c5;--text-3:#8792a6;',
    '--accent-ink:#38bdf8;--on-accent:#04202f;--accent-soft:color-mix(in srgb,var(--accent) 16%,#131317);--danger:#f43f5e;--danger-ink:#fb7185;--danger-soft:color-mix(in srgb,#f43f5e 14%,#131317);',
    '--ok:#34d399;--scrim:rgba(0,0,0,.55);--shadow:0 24px 60px -12px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04);--lshadow:0 10px 30px -6px color-mix(in srgb,var(--accent) 45%,transparent)}',
    '.ic{flex:none;display:block}',
    'button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    'button:focus-visible,textarea:focus-visible,summary:focus-visible,.drop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    // Launcher. Accent pill: 7.6:1 against the Portal's #0a0a0c page, so it can not disappear again.
    '.launch{position:fixed;right:20px;bottom:calc(var(--lb,0px) + 20px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:inline-flex;align-items:center;gap:8px;',
    'height:44px;padding:0 18px 0 15px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;font-size:14px;letter-spacing:.005em;',
    'box-shadow:var(--lshadow);transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s,opacity .18s}',
    '.launch:hover{transform:translateY(-2px)}',
    '.launch:active{transform:translateY(0) scale(.97)}',
    '.launch[hidden]{display:none}',
    '@media (max-width:640px){.launch{right:14px;width:48px;height:48px;padding:0;justify-content:center}.launch .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}',
    // Scrim + panel. Desktop: a floating sheet on the right. Phone: full screen.
    '.scrim{position:fixed;inset:0;z-index:2147483001;background:var(--scrim);opacity:0;transition:opacity .22s ease-out}',
    '.scrim.in{opacity:1}',
    '.panel{position:fixed;z-index:2147483002;top:12px;right:12px;bottom:12px;width:min(452px,calc(100vw - 24px));display:flex;flex-direction:column;',
    'background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:hidden;',
    'transform:translateX(calc(100% + 24px));transition:transform .32s cubic-bezier(.22,1,.36,1)}',
    '.panel.in{transform:none}',
    '@media (max-width:640px){.panel{inset:0;width:auto;height:100dvh;border-radius:0;border:0;transform:translateY(100%)}}',
    '@media (prefers-reduced-motion:reduce){.panel,.scrim,.launch{transition:none}}',
    '.hd{display:flex;align-items:flex-start;gap:12px;padding:20px 16px 16px 22px;border-bottom:1px solid var(--line)}',
    '.hd .t{flex:1;min-width:0}',
    '.hd h2{margin:0;font-size:18px;line-height:1.3;font-weight:700;letter-spacing:-.015em;color:var(--text)}',
    '.hd p{margin:3px 0 0;font-size:13px;color:var(--text-2)}',
    '.xbtn{width:40px;height:40px;margin:-6px -2px 0 0;border-radius:12px;display:grid;place-items:center;color:var(--text-2)}',
    '.xbtn:hover{background:var(--raise);color:var(--text)}',
    '.bd{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:18px 22px 22px;display:flex;flex-direction:column;gap:22px}',
    '.fld{display:flex;flex-direction:column;gap:8px}',
    '.lab{font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
    '.lab small{font-size:12px;font-weight:500;color:var(--text-3)}',
    // Type switch
    '.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;background:var(--field);border:1px solid var(--line);border-radius:14px}',
    '.seg button{height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;font-weight:600;color:var(--text-2)}',
    '.seg button:hover{color:var(--text)}',
    '.seg button[aria-checked=true]{background:var(--bg);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12),0 0 0 1px var(--line-strong)}',
    '.seg button[aria-checked=true] .ic{color:var(--accent-ink)}',
    // Text
    'textarea{display:block;width:100%;min-height:132px;resize:vertical;padding:12px 14px;border-radius:12px;border:1px solid var(--line-strong);background:var(--field);',
    'color:var(--text);caret-color:var(--accent);font:inherit;font-size:14.5px;line-height:1.55;color-scheme:inherit;transition:border-color .15s,box-shadow .15s}',
    'textarea::placeholder{color:var(--text-3);opacity:1}',
    'textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}',
    '.err-f textarea{border-color:var(--danger)}',
    // Voice
    '.voice{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 6px 6px 6px;border:1px solid var(--line);border-radius:14px;background:var(--field)}',
    '.rec{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 13px;border-radius:10px;background:var(--bg);border:1px solid var(--line-strong);font-weight:600;font-size:13.5px;color:var(--text)}',
    '.rec:hover{border-color:var(--accent)}',
    '.rec .ic{color:var(--accent-ink)}',
    '.voice .meta{flex:1;min-width:0;font-size:12.5px;color:var(--text-2);line-height:1.4}',
    '.voice.live{border-color:color-mix(in srgb,var(--danger) 45%,var(--line));background:var(--danger-soft)}',
    '.stopb{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--danger);color:#fff}',
    '.stopb .ic{fill:currentColor;stroke:none}',
    '.timer{font-variant-numeric:tabular-nums;font-weight:600;font-size:14px;color:var(--danger-ink);min-width:40px}',
    '.bars{display:flex;align-items:center;gap:3px;height:24px;flex:1}',
    '.bars i{display:block;width:3px;height:24px;border-radius:2px;background:var(--danger);transform:scaleY(.12);transform-origin:center;transition:transform .08s linear}',
    '.playb{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:var(--accent);color:var(--on-accent)}',
    '.playb .ic{fill:currentColor;stroke:none}',
    '.track{position:relative;flex:1;height:6px;border-radius:999px;background:var(--line-strong);cursor:pointer}',
    '.track b{position:absolute;inset:0;border-radius:inherit;background:var(--accent);transform:scaleX(0);transform-origin:left}',
    '.ptime{font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--text-2);min-width:34px;text-align:right}',
    '.iconb{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:var(--text-2)}',
    '.iconb:hover{background:var(--raise);color:var(--danger-ink)}',
    // Pictures
    '.pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}',
    '.tile{position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;border:1px solid var(--line-strong);background:var(--raise)}',
    '.tile img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}',
    '.tile .cap{position:absolute;left:0;right:0;bottom:0;padding:16px 8px 6px;font-size:12px;font-weight:600;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.72));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tile .rm{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:999px;display:grid;place-items:center;background:rgba(15,15,20,.72);color:#fff}',
    '.tile .rm:hover{background:var(--danger)}',
    '.tile.doc{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;color:var(--text-2);font-size:12px;text-align:center}',
    '.tile.doc span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}',
    '.tile.wait{display:grid;place-items:center;color:var(--text-3);font-size:12px;background:linear-gradient(100deg,var(--raise) 30%,var(--field) 50%,var(--raise) 70%);background-size:300% 100%;animation:shim 1.4s ease-in-out infinite}',
    '@keyframes shim{from{background-position:100% 0}to{background-position:0 0}}',
    '@media (prefers-reduced-motion:reduce){.tile.wait{animation:none}}',
    '.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:20px 16px;border-radius:14px;border:1.5px dashed var(--line-strong);',
    'background:var(--field);color:var(--text-2);cursor:pointer;transition:border-color .15s,background .15s}',
    '.drop.over{border-color:var(--accent);background:var(--accent-soft)}',
    '@media (hover:hover){.drop:hover{border-color:var(--accent);background:var(--accent-soft)}}',
    '.drop .ic{color:var(--accent-ink)}',
    '.drop strong{font-size:14px;font-weight:600;color:var(--text)}',
    '.drop strong u{text-decoration:none;color:var(--accent-ink)}',
    '.snip{font-size:12.5px;color:var(--text-2);line-height:1.9}',
    'kbd{display:inline-block;min-width:24px;padding:1px 7px;border-radius:6px;border:1px solid var(--line-strong);border-bottom-width:2px;background:var(--bg);color:var(--text);',
    'font:600 12px/1.6 var(--font);text-align:center}',
    '.readd{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--accent-ink);height:32px}',
    // Context disclosure
    'details{border:1px solid var(--line);border-radius:14px;background:var(--field)}',
    'summary{list-style:none;display:flex;align-items:center;gap:8px;padding:12px 14px;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer;border-radius:14px}',
    'summary::-webkit-details-marker{display:none}',
    'summary .ic{margin-left:auto;transition:transform .2s}',
    'details[open] summary .ic{transform:rotate(180deg)}',
    'dl{margin:0;padding:0 14px 12px;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12.5px}',
    'dt{color:var(--text-3)}dd{margin:0;color:var(--text);overflow-wrap:anywhere}',
    // Footer
    '.ft{display:flex;align-items:center;gap:12px;padding:14px 22px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--bg)}',
    '.msg{flex:1;min-width:0;font-size:13px;color:var(--text-2)}',
    '.msg.bad{color:var(--danger-ink);font-weight:500}',
    '.primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-weight:700;font-size:14px;white-space:nowrap;transition:transform .12s,filter .15s}',
    '.primary:hover{filter:brightness(1.07)}',
    '.primary:active{transform:scale(.98)}',
    '.primary[disabled]{opacity:.6;cursor:progress}',
    '.ghost{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:12px;border:1px solid var(--line-strong);font-weight:600;font-size:14px;color:var(--text)}',
    '.ghost:hover{background:var(--raise)}',
    '@media (max-width:640px){.ft{flex-direction:column;align-items:stretch;gap:10px}.ft .primary{width:100%}.msg:empty{display:none}.bd{padding:16px 18px 22px}.hd{padding:16px 12px 14px 18px}}',
    // Done / saved state
    '.done{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:32px 28px}',
    '.done .badge{width:64px;height:64px;border-radius:999px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-ink);margin-bottom:6px}',
    '.done.saved .badge{background:var(--raise);color:var(--text-2)}',
    '.done h3{margin:0;font-size:20px;font-weight:700;letter-spacing:-.015em;color:var(--text)}',
    '.done p{margin:0;max-width:34ch;color:var(--text-2);font-size:14px}',
    '.done .ref{font-variant-numeric:tabular-nums;font-weight:600;color:var(--text)}',
    '.done .row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;justify-content:center}',
    '.toast{position:absolute;left:50%;bottom:86px;transform:translate(-50%,8px);opacity:0;pointer-events:none;padding:8px 14px;border-radius:999px;background:var(--text);color:var(--bg);font-size:13px;font-weight:600;transition:opacity .2s,transform .2s;white-space:nowrap}',
    '.toast.on{opacity:1;transform:translate(-50%,0)}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
  ].join('\n');

  // ---- 4. HOST ELEMENT (shadow root) --------------------------------------------------------------
  var hostEl, shadow, root, launcher;
  function mount() {
    if (hostEl) return;
    hostEl = h('div', { id: 'se-report-host', 'data-se-report': '' });
    shadow = hostEl.attachShadow ? hostEl.attachShadow({ mode: 'open' }) : hostEl;
    shadow.appendChild(h('style', {}, CSS));
    root = h('div', { class: 'root' });
    shadow.appendChild(root);
    document.body.appendChild(hostEl);
    applyTheme();
    // Follow the host when it flips light/dark (the Portal's toggle changes <html class>).
    try {
      var mo = new MutationObserver(applyTheme);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode', 'style'] });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-mode'] });
    } catch (e) {}
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) {} }
  }
  function applyTheme() {
    if (!root) return;
    root.setAttribute('data-theme', hostTheme());
    root.style.setProperty('--font', hostFont());
  }

  // Keep the launcher clear of a fixed bottom bar (the Portal's phone nav is a 70px fixed strip).
  function bottomInset() {
    if (typeof CFG.launcherBottom === 'number') return CFG.launcherBottom;
    var W = window.innerWidth, H = window.innerHeight, inset = 0;
    [W - 40, W / 2].forEach(function (x) {
      var stack = document.elementsFromPoint ? document.elementsFromPoint(x, H - 3) : [];
      for (var i = 0; i < stack.length; i++) {
        var n = stack[i];
        if (n === hostEl) continue;
        for (var p = n; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
          var cs = getComputedStyle(p);
          if (cs.position === 'fixed' || cs.position === 'sticky') {
            var r = p.getBoundingClientRect();
            if (r.bottom >= H - 4 && r.width >= W * 0.5 && r.height > 0 && r.height <= 180) inset = Math.max(inset, H - r.top);
            break;
          }
        }
      }
    });
    return Math.round(inset);
  }
  function placeLauncher() {
    if (!launcher || launcher.hidden) return;
    root.style.setProperty('--lb', bottomInset() + 'px');
  }

  function renderLauncher() {
    mount();
    if (launcher) return;
    launcher = h('button', { class: 'launch', type: 'button', 'aria-label': 'Send feedback or report a problem', title: 'Send feedback or report a problem' },
      icon('feedback', 18) + '<span class="lbl">Feedback</span>');
    launcher.addEventListener('click', open);
    root.appendChild(launcher);
    placeLauncher();
    window.addEventListener('resize', placeLauncher);
    setInterval(placeLauncher, 1500);   // routes change without resizing; this is a cheap probe
  }

  // ---- 5. CONTEXT --------------------------------------------------------------------------------
  // The Portal's user object in localStorage carries access_token. A report must never ship a
  // credential, so only identity fields survive.
  function safeUser() {
    var u = null;
    try { u = typeof CFG.user === 'function' ? CFG.user() : (CFG.user || null); } catch (e) { u = null; }
    if (!u || typeof u !== 'object') return u || null;
    var keep = ['id', 'user_id', 'username', 'full_name', 'name', 'email', 'role'], out = {};
    keep.forEach(function (k) { if (u[k] != null) out[k] = u[k]; });
    return Object.keys(out).length ? out : null;
  }
  function collectBase() {
    var nav = window.navigator || {};
    return {
      app: CFG.app || document.title,
      version: CFG.version || '',
      url: location.href,
      route: location.pathname + location.search + location.hash,
      title: document.title,
      user: safeUser(),
      userAgent: nav.userAgent,
      language: nav.language,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, screen: (window.screen ? screen.width + 'x' + screen.height : '') },
      referrer: document.referrer || null,
      errors: STATE.errors.slice(-15),
      failed_requests: STATE.failed.slice(-15),
      at: new Date().toISOString()
    };
  }
  function browserName(ua) {
    ua = ua || '';
    var b = /Edg\/(\d+)/.exec(ua) ? 'Edge ' + RegExp.$1 : /OPR\/(\d+)/.exec(ua) ? 'Opera ' + RegExp.$1 :
      /Chrome\/(\d+)/.exec(ua) ? 'Chrome ' + RegExp.$1 : /Firefox\/(\d+)/.exec(ua) ? 'Firefox ' + RegExp.$1 :
      /Version\/(\d+).*Safari/.exec(ua) ? 'Safari ' + RegExp.$1 : 'Browser';
    var os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return b + (os ? ' on ' + os : '');
  }
  var PLATFORM = (function () {
    var ua = navigator.userAgent || '', pf = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    var touchOnly = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchOnly || /Android|iPhone|iPad/.test(ua)) return 'touch';
    if (/Mac/i.test(pf)) return 'mac';
    if (/Win/i.test(pf)) return 'win';
    return 'other';
  })();

  // ---- 6. SCREENSHOT (html2canvas on demand; never blocks a report) -------------------------------
  function loadHtml2canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = CFG.html2canvas || 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = function () { resolve(window.html2canvas || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(window.html2canvas || null); }, 8000);
    });
  }
  // Taken the moment the panel opens, with the widget excluded, so it shows the page the person was
  // looking at. (The first version shot at send time and pictured its own dialog.)
  function capturePage() {
    var bg = getComputedStyle(document.body).backgroundColor;
    if (lum(bg) == null) bg = getComputedStyle(document.documentElement).backgroundColor;
    if (lum(bg) == null) bg = hostTheme() === 'dark' ? '#0a0a0c' : '#ffffff';
    return loadHtml2canvas().then(function (h2c) {
      if (!h2c) return null;
      return h2c(document.body, {
        backgroundColor: bg, scale: Math.min(window.devicePixelRatio || 1, 1.5), useCORS: true, logging: false,
        x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
        windowWidth: window.innerWidth, windowHeight: window.innerHeight,
        ignoreElements: function (n) { return n === hostEl || (n.hasAttribute && n.hasAttribute('data-se-report')); }
      }).then(function (c) { return c.toDataURL('image/jpeg', 0.72); }).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  // ---- 7. FILES: read, shrink big images, base64 --------------------------------------------------
  function readAsDataURL(blob) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result)); };
      r.onerror = function () { res(null); };
      r.readAsDataURL(blob);
    });
  }
  // A pasted full-screen PNG can be 3-6MB; re-encode anything big so a few snips still fit the budget.
  function prepareFile(f) {
    var isImg = /^image\/(png|jpe?g|webp|bmp|gif)$/i.test(f.type || '');
    return readAsDataURL(f).then(function (url) {
      if (!url) return null;
      var item = { name: f.name || ('snip-' + new Date().toISOString().slice(11, 19).replace(/:/g, '') + '.png'), type: f.type || 'application/octet-stream', size: f.size, url: url, image: isImg };
      if (!isImg || (f.size <= 1.2 * 1048576)) return item;
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, 2200 / Math.max(im.naturalWidth, im.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          var out = c.toDataURL('image/jpeg', 0.85);
          item.url = out; item.type = 'image/jpeg'; item.size = Math.round((out.length - out.indexOf(',') - 1) * 0.75);
          item.name = item.name.replace(/\.\w+$/, '') + '.jpg';
          res(item);
        };
        im.onerror = function () { res(item); };
        im.src = url;
      });
    });
  }

  // ---- 8. OUTBOX (IndexedDB): nothing is lost when there is no ingest or no network ---------------
  var DB_NAME = 'se-report', STORE = 'outbox';
  function db() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      var q = indexedDB.open(DB_NAME, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true }); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
  }
  function outboxOp(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(STORE, mode), st = tx.objectStore(STORE), out = fn(st);
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function queue(payload) { return outboxOp('readwrite', function (st) { return st.add({ payload: payload, at: Date.now() }); }); }
  function queued() { return outboxOp('readonly', function (st) { return st.getAll(); }).catch(function () { return []; }); }
  function unqueue(key) { return outboxOp('readwrite', function (st) { return st.delete(key); }).catch(function () {}); }

  function post(payload) {
    return fetch(CFG.ingest, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  }
  var flushing = false;
  function flush() {
    if (!CFG.ingest || flushing || (navigator.onLine === false)) return;
    flushing = true;
    queued().then(function (items) {
      return items.reduce(function (p, it) {
        return p.then(function () {
          if (Date.now() - it.at > 14 * 864e5) return unqueue(it.key);   // two weeks old: give up
          // The token is the app's CURRENT one, not whatever it was when the report was saved.
          if (CFG.token) it.payload.token = CFG.token;
          return post(it.payload).then(function (r) {
            if (r.ok || (r.status >= 400 && r.status < 500 && [401, 403, 408, 429].indexOf(r.status) < 0)) return unqueue(it.key);
          }).catch(function () {});
        });
      }, Promise.resolve());
    }).then(function () { flushing = false; }, function () { flushing = false; });
  }
  window.addEventListener('online', flush);

  // ---- 9. VOICE NOTES ----------------------------------------------------------------------------
  // Ayanda (18 Sep 2026): "voice notes are the best things for people who just ramble off what they are
  // looking for". Rules kept from the first version: never claim a clip that does not exist; every
  // failure says so in the panel; never leave the microphone on after the panel closes.
  var voice = { rec: null, chunks: [], blob: null, url: null, secs: 0, started: 0, tick: null, raf: null, ctx: null, stream: null };
  function voiceSupported() { return !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function releaseMic() {
    if (voice.tick) { clearInterval(voice.tick); voice.tick = null; }
    if (voice.raf) { cancelAnimationFrame(voice.raf); voice.raf = null; }
    if (voice.ctx) { try { voice.ctx.close(); } catch (e) {} voice.ctx = null; }
    if (voice.stream) { try { voice.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} voice.stream = null; }
  }
  function dropClip() {
    voice.blob = null; voice.secs = 0;
    if (voice.url) { try { URL.revokeObjectURL(voice.url); } catch (e) {} voice.url = null; }
  }

  // ---- 10. THE PANEL ------------------------------------------------------------------------------
  var TYPES = [
    { key: 'Bug report', short: 'Bug', icon: 'bug', label: 'What went wrong?', ph: 'What you clicked, what you expected, and what happened instead.' },
    { key: 'Feature request', short: 'Idea', icon: 'idea', label: 'What would make this better?', ph: 'Describe the change you want and who it would help.' },
    { key: 'Other', short: 'Other', icon: 'other', label: "What's on your mind?", ph: 'Anything you want the team to know.' }
  ];
  var ui = null, lastFocus = null;
  var form = { type: 'Bug report', text: '', files: [], shot: null, shotState: 'idle', includeShot: true };

  function draftSave() { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ type: form.type, text: form.text })); } catch (e) {} }
  function draftLoad() { try { var d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); if (d) { form.type = d.type || form.type; form.text = d.text || ''; } } catch (e) {} }
  function draftClear() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function open() {
    mount(); applyTheme();
    if (ui) return;
    lastFocus = document.activeElement;
    draftLoad();
    form.files = []; form.shot = null; form.includeShot = true; form.shotState = 'busy';
    dropClip();

    // Photograph the page before the panel covers it.
    capturePage().then(function (shot) {
      form.shot = shot; form.shotState = shot ? 'ready' : 'failed';
      if (ui) renderPics();
    });

    var scrim = h('div', { class: 'scrim' });
    var panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'se-h' });
    panel.innerHTML =
      '<div class="hd"><div class="t"><h2 id="se-h" tabindex="-1">Send feedback</h2>' +
      '<p>It goes to the Strat Edge team with a picture of this page.</p></div>' +
      '<button type="button" class="xbtn" data-act="close" aria-label="Close">' + icon('x', 20) + '</button></div>' +
      '<div class="bd">' +
        '<div class="fld"><span class="lab" id="se-type-l">Type</span><div class="seg" role="radiogroup" aria-labelledby="se-type-l"></div></div>' +
        '<div class="fld" data-f="text"><label class="lab" for="se-text"><span data-slot="tlabel"></span></label><textarea id="se-text"></textarea></div>' +
        '<div class="fld"><span class="lab">Voice note <small>optional</small></span><div class="voice" aria-live="polite"></div></div>' +
        '<div class="fld"><span class="lab">Pictures <small data-slot="count"></small></span><div class="pics"></div>' +
          '<div class="drop" role="button" tabindex="0" aria-label="Add pictures or files"></div>' +
          '<input type="file" multiple accept="image/*,.pdf,.txt,.csv,.xlsx,.docx" class="sr" tabindex="-1" aria-hidden="true"></div>' +
        '<details><summary>What else is sent with it' + icon('chevron', 16) + '</summary><dl></dl></details>' +
      '</div>' +
      '<div class="ft"><div class="msg" role="status"></div><button type="button" class="primary" data-act="send">' + icon('send', 17) + '<span>Send feedback</span></button></div>' +
      '<div class="toast" aria-hidden="true"></div>';
    root.appendChild(scrim); root.appendChild(panel);
    launcher.hidden = true;

    ui = {
      scrim: scrim, panel: panel,
      seg: panel.querySelector('.seg'), text: panel.querySelector('#se-text'), tlabel: panel.querySelector('[data-slot=tlabel]'),
      voice: panel.querySelector('.voice'), pics: panel.querySelector('.pics'), drop: panel.querySelector('.drop'),
      input: panel.querySelector('input[type=file]'), count: panel.querySelector('[data-slot=count]'),
      dl: panel.querySelector('dl'), msg: panel.querySelector('.msg'), send: panel.querySelector('[data-act=send]'),
      toast: panel.querySelector('.toast'), body: panel.querySelector('.bd'), foot: panel.querySelector('.ft')
    };

    // Type switch (a radiogroup: arrow keys move, like the platform control it replaces)
    TYPES.forEach(function (t) {
      var b = h('button', { type: 'button', role: 'radio', 'data-type': t.key }, icon(t.icon, 16) + '<span>' + t.short + '</span>');
      b.addEventListener('click', function () { setType(t.key); });
      ui.seg.appendChild(b);
    });
    ui.seg.addEventListener('keydown', function (e) {
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var i = TYPES.findIndex(function (t) { return t.key === form.type; });
      i = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : TYPES.length - 1)) % TYPES.length;
      setType(TYPES[i].key); ui.seg.children[i].focus();
    });
    setType(form.type);

    ui.text.value = form.text;
    ui.text.addEventListener('input', function () {
      form.text = ui.text.value; draftSave();
      if (form.text.trim()) { ui.text.parentNode.classList.remove('err-f'); if (ui.msg.classList.contains('bad')) say(''); }
    });

    renderVoice('idle');

    // Drop zone copy depends on the device: the Windows snip shortcut is Win + Shift + S.
    var snip = PLATFORM === 'win'
      ? '<div class="snip">To show part of your screen, press <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>, drag over it, then <kbd>Ctrl</kbd> + <kbd>V</kbd> here.</div>'
      : PLATFORM === 'mac'
        ? '<div class="snip">To show part of your screen, press <kbd>Cmd</kbd> + <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>4</kbd>, drag over it, then <kbd>Cmd</kbd> + <kbd>V</kbd> here.</div>'
        : PLATFORM === 'other' ? '<div class="snip">Copied a screenshot? Press <kbd>Ctrl</kbd> + <kbd>V</kbd> here.</div>' : '';
    ui.drop.innerHTML = icon(PLATFORM === 'touch' ? 'camera' : 'image', 22) +
      (PLATFORM === 'touch' ? '<strong>Add a photo or screenshot</strong>' : '<strong>Drop, paste or <u>browse</u></strong>') + snip;
    ui.drop.addEventListener('click', function () { ui.input.click(); });
    ui.drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.input.click(); } });
    ui.input.addEventListener('change', function () { addFiles(ui.input.files); ui.input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      panel.addEventListener(ev, function (e) { if (hasFiles(e)) { e.preventDefault(); ui.drop.classList.add('over'); } });
    });
    panel.addEventListener('dragleave', function (e) { if (!panel.contains(e.relatedTarget)) ui.drop.classList.remove('over'); });
    panel.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); ui.drop.classList.remove('over'); addFiles(e.dataTransfer.files);
    });
    document.addEventListener('paste', onPaste, true);
    renderPics();

    var cap = collectBase(), u = cap.user;
    var rows = [
      ['Page', cap.route || '/'],
      ['Account', u ? (u.full_name || u.name || u.username || u.email || 'Signed in') + (u.role ? ' (' + u.role + ')' : '') : 'Not signed in'],
      ['Browser', browserName(cap.userAgent)],
      ['Screen', cap.viewport.w + ' x ' + cap.viewport.h],
      ['Recent errors', cap.errors.length ? String(cap.errors.length) : 'None'],
      ['Failed requests', cap.failed_requests.length ? String(cap.failed_requests.length) : 'None']
    ];
    ui.dl.innerHTML = rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');

    panel.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-act]');
      if (!a) return;
      var act = a.getAttribute('data-act');
      if (act === 'close') close();
      else if (act === 'send') submit();
    });
    scrim.addEventListener('click', close);
    panel.addEventListener('keydown', trapKeys);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { scrim.classList.add('in'); panel.classList.add('in'); });
    });
    // On a phone, focusing the textarea throws the keyboard over the form; land on the title instead.
    setTimeout(function () { (PLATFORM === 'touch' ? panel.querySelector('#se-h') : ui.text).focus({ preventScroll: true }); }, 60);
  }

  function setType(key) {
    form.type = key; draftSave();
    var t = TYPES.filter(function (x) { return x.key === key; })[0] || TYPES[0];
    Array.prototype.forEach.call(ui.seg.children, function (b) {
      var on = b.getAttribute('data-type') === key;
      b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
    });
    ui.tlabel.textContent = t.label;
    ui.text.placeholder = t.ph;
  }

  function trapKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(ui.panel.querySelectorAll('button,textarea,[tabindex="0"],summary,[href]'), function (n) {
      return !n.disabled && n.getClientRects().length > 0 && n.tabIndex >= 0;
    });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], act = shadow.activeElement;
    if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
  }

  function say(text, bad) { if (!ui) return; ui.msg.textContent = text || ''; ui.msg.classList.toggle('bad', !!bad); }
  var toastT = null;
  function toast(text) {
    if (!ui) return;
    ui.toast.textContent = text; ui.toast.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { if (ui) ui.toast.classList.remove('on'); }, 1800);
  }

  // ---- pictures ----
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  function onPaste(e) {
    if (!ui) return;
    var items = (e.clipboardData && e.clipboardData.items) || [], files = [];
    for (var i = 0; i < items.length; i++) if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) files.push(f); }
    if (!files.length) return;                 // plain text pastes go into the textarea as normal
    e.preventDefault();
    addFiles(files, true);
  }
  function addFiles(list, pasted) {
    var arr = Array.prototype.slice.call(list || []);
    if (!arr.length) return;
    var room = MAX_FILES - form.files.length;
    if (room <= 0) { say('You can add up to ' + MAX_FILES + ' pictures or files.', true); return; }
    var tooBig = arr.filter(function (f) { return f.size > 15 * 1048576; });
    arr = arr.filter(function (f) { return f.size <= 15 * 1048576; }).slice(0, room);
    Promise.all(arr.map(prepareFile)).then(function (items) {
      items.filter(Boolean).forEach(function (it) { form.files.push(it); });
      renderPics();
      if (tooBig.length) say(tooBig[0].name + ' is over 15 MB, so it was left out.', true);
      else if (items.length) { say(''); toast(pasted ? 'Screenshot added' : (items.length === 1 ? 'Added' : items.length + ' added')); }
    });
  }
  function renderPics() {
    if (!ui) return;
    var html = '';
    if (form.includeShot) {
      if (form.shotState === 'busy') html += '<div class="tile wait" aria-label="Taking a picture of this page">Taking picture...</div>';
      else if (form.shotState === 'ready') html += '<div class="tile"><img alt="Picture of this page" src="' + form.shot + '"><div class="cap">This page</div>' +
        '<button type="button" class="rm" data-rm="shot" aria-label="Leave out the picture of this page">' + icon('x', 14) + '</button></div>';
    }
    form.files.forEach(function (f, i) {
      html += f.image
        ? '<div class="tile"><img alt="' + esc(f.name) + '" src="' + f.url + '"><div class="cap">' + esc(f.name) + '</div>'
        : '<div class="tile doc">' + icon('file', 22) + '<span>' + esc(f.name) + '</span>' + fmtSize(f.size);
      html += '<button type="button" class="rm" data-rm="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + icon('x', 14) + '</button></div>';
    });
    ui.pics.innerHTML = html;
    ui.pics.style.display = html ? '' : 'none';
    var n = form.files.length + (form.includeShot && form.shotState === 'ready' ? 1 : 0);
    ui.count.textContent = n ? n + ' added' : 'optional';
    var re = ui.pics.parentNode.querySelector('.readd');
    if (!form.includeShot && form.shot) {
      if (!re) {
        re = h('button', { type: 'button', class: 'readd' }, icon('camera', 16) + 'Include the picture of this page');
        re.addEventListener('click', function () { form.includeShot = true; renderPics(); });
        ui.pics.parentNode.insertBefore(re, ui.drop);
      }
    } else if (re) re.parentNode.removeChild(re);
    Array.prototype.forEach.call(ui.pics.querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-rm');
        if (k === 'shot') form.includeShot = false; else form.files.splice(+k, 1);
        renderPics(); say('');
      });
    });
    ui.drop.style.display = form.files.length >= MAX_FILES ? 'none' : '';
  }

  // ---- voice UI ----
  function renderVoice(mode, note) {
    if (!ui) return;
    var v = ui.voice;
    v.classList.toggle('live', mode === 'live');
    if (mode === 'live') {
      v.innerHTML = '<button type="button" class="stopb" data-v="stop" aria-label="Stop recording">' + icon('stop', 16) + '</button>' +
        '<span class="timer">0:00</span><span class="bars" aria-hidden="true">' + new Array(19).join('<i></i>') + '</span>' +
        '<span class="sr">Recording</span>';
    } else if (mode === 'clip') {
      v.innerHTML = '<button type="button" class="playb" data-v="play" aria-label="Play voice note">' + icon('play', 16) + '</button>' +
        '<span class="track" data-v="seek" role="slider" aria-label="Playback position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><b></b></span>' +
        '<span class="ptime">' + fmtTime(voice.secs) + '</span>' +
        '<button type="button" class="iconb" data-v="del" aria-label="Delete voice note">' + icon('trash', 18) + '</button>' +
        '<audio preload="metadata" class="sr"></audio>';
      var au = v.querySelector('audio'), fill = v.querySelector('.track b'), pt = v.querySelector('.ptime'), pb = v.querySelector('.playb');
      au.src = voice.url;
      var dur = function () { return isFinite(au.duration) && au.duration > 0 ? au.duration : voice.secs || 1; };
      au.addEventListener('timeupdate', function () {
        var p = Math.min(1, au.currentTime / dur());
        fill.style.transform = 'scaleX(' + p + ')'; pt.textContent = fmtTime(au.currentTime || voice.secs);
        v.querySelector('.track').setAttribute('aria-valuenow', String(Math.round(p * 100)));
      });
      au.addEventListener('play', function () { pb.innerHTML = icon('pause', 16); pb.setAttribute('aria-label', 'Pause voice note'); });
      au.addEventListener('pause', function () { pb.innerHTML = icon('play', 16); pb.setAttribute('aria-label', 'Play voice note'); });
      au.addEventListener('ended', function () { fill.style.transform = 'scaleX(0)'; pt.textContent = fmtTime(voice.secs); });
      v.querySelector('.track').addEventListener('click', function (e) {
        var r = e.currentTarget.getBoundingClientRect();
        try { au.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur(); } catch (x) {}
      });
    } else {
      v.innerHTML = '<button type="button" class="rec" data-v="rec">' + icon('mic', 17) + '<span>Record</span></button>' +
        '<span class="meta">' + (note ? '<span style="color:var(--danger-ink);font-weight:500">' + esc(note) + '</span>'
          : 'Easier to say it? Talk for up to ' + Math.round(VOICE_MAX_MS / 1000) + ' seconds. We turn it into text for the team.') + '</span>';
    }
    Array.prototype.forEach.call(v.querySelectorAll('[data-v]'), function (b) {
      var k = b.getAttribute('data-v');
      if (k === 'rec') b.addEventListener('click', startRec);
      if (k === 'stop') b.addEventListener('click', stopRec);
      if (k === 'del') b.addEventListener('click', function () { dropClip(); renderVoice('idle'); v.querySelector('.rec').focus(); });
      if (k === 'play') b.addEventListener('click', function () { var au = v.querySelector('audio'); if (au.paused) au.play().catch(function () {}); else au.pause(); });
    });
  }

  function startRec() {
    if (!voiceSupported()) { renderVoice('idle', 'This browser cannot record audio. Please type instead.'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (!ui) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      voice.stream = stream;
      var mime = '';
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].some(function (m) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) { mime = m; return true; } return false;
      });
      var rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
      catch (e) { releaseMic(); renderVoice('idle', 'Could not start recording (' + e.message + '). Please type instead.'); return; }
      dropClip();
      voice.rec = rec; voice.chunks = []; voice.started = Date.now();
      rec.ondataavailable = function (e) { if (e.data && e.data.size) voice.chunks.push(e.data); };
      rec.onerror = function (e) { releaseMic(); renderVoice('idle', 'Recording failed (' + ((e && e.error && e.error.name) || 'unknown') + '). Please type instead.'); };
      rec.onstop = function () {
        var secs = (Date.now() - voice.started) / 1000;
        releaseMic();
        if (!ui) return;
        var blob = new Blob(voice.chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
        if (!blob.size) { renderVoice('idle', 'Nothing was recorded. Try again, or type instead.'); return; }
        if (blob.size > VOICE_MAX_BYTES) { renderVoice('idle', 'That recording is too long to send (' + fmtSize(blob.size) + '). Please keep it shorter.'); return; }
        voice.blob = blob; voice.secs = secs;
        try { voice.url = URL.createObjectURL(blob); } catch (e) {}
        renderVoice('clip');
        toast('Voice note added');
      };
      rec.start(250);
      renderVoice('live');
      ui.voice.querySelector('.stopb').focus();
      var timer = ui.voice.querySelector('.timer'), bars = ui.voice.querySelectorAll('.bars i');
      voice.tick = setInterval(function () {
        var s = (Date.now() - voice.started) / 1000;
        if (timer) timer.textContent = fmtTime(s);
        if (s * 1000 >= VOICE_MAX_MS) stopRec();
      }, 250);
      // Live level meter: proof the microphone is actually hearing them.
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        voice.ctx = new AC();
        var an = voice.ctx.createAnalyser(); an.fftSize = 64;
        voice.ctx.createMediaStreamSource(stream).connect(an);
        var data = new Uint8Array(an.frequencyBinCount);
        var draw = function () {
          an.getByteFrequencyData(data);
          for (var i = 0; i < bars.length; i++) {
            var val = data[Math.min(data.length - 1, 1 + i)] / 255;
            bars[i].style.transform = 'scaleY(' + Math.max(0.12, Math.min(1, val * 1.25)).toFixed(3) + ')';
          }
          voice.raf = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) {}
    }).catch(function (e) {
      var n = (e && e.name) || '';
      renderVoice('idle', n === 'NotAllowedError' || n === 'SecurityError'
        ? 'The microphone is blocked. Allow it from the padlock in the address bar, or type instead.'
        : n === 'NotFoundError' ? 'No microphone was found. Please type instead.'
        : 'Could not use the microphone (' + (n || e.message || 'unknown') + '). Please type instead.');
    });
  }
  function stopRec() {
    if (voice.tick) { clearInterval(voice.tick); voice.tick = null; }
    if (voice.rec && voice.rec.state !== 'inactive') { try { voice.rec.stop(); } catch (e) { releaseMic(); } }
    else releaseMic();
  }

  // ---- send ----
  function buildPayload() {
    var atts = form.files.map(function (f) {
      return { name: f.name, type: f.type, size: f.size, data: f.url.slice(f.url.indexOf(',') + 1) };
    });
    var voiceP = voice.blob ? readAsDataURL(voice.blob).then(function (url) {
      if (!url) return null;
      var ext = (voice.blob.type.split('/')[1] || 'webm').split(';')[0];
      return { name: 'voice-note.' + ext, type: voice.blob.type || 'audio/webm', size: voice.blob.size, data: url.slice(url.indexOf(',') + 1), kind: 'voice-note' };
    }) : Promise.resolve(null);
    var shotP = !form.includeShot ? Promise.resolve(null)
      : form.shotState === 'busy' ? new Promise(function (res) {
          var w = setInterval(function () { if (form.shotState !== 'busy') { clearInterval(w); res(form.includeShot ? form.shot : null); } }, 150);
          setTimeout(function () { clearInterval(w); res(form.shot || null); }, 9000);
        })
      : Promise.resolve(form.shot);
    return Promise.all([voiceP, shotP]).then(function (r) {
      var p = collectBase();
      p.type = form.type;
      p.description = form.text.trim();
      p.attachments = atts.concat(r[0] ? [r[0]] : []);
      p.screenshot = r[1] || null;
      p.token = CFG.token || null;
      return p;
    });
  }

  function submit() {
    if (!form.text.trim() && !voice.blob) {
      ui.text.parentNode.classList.add('err-f');
      say('Tell us what happened, in words or a voice note.', true);
      ui.text.focus();
      return;
    }
    if (voice.rec && voice.rec.state === 'recording') { stopRec(); setTimeout(submit, 400); return; }
    ui.send.disabled = true;
    say(form.shotState === 'busy' ? 'Finishing the picture of this page...' : 'Sending...');
    buildPayload().then(function (payload) {
      // The ingest requires a description; a voice-only report still says what it is.
      if (!payload.description) payload.description = '(voice note, see the attached recording)';
      var bytes = JSON.stringify(payload).length;
      if (bytes > BODY_BUDGET) {
        ui.send.disabled = false;
        say('This is too big to send (' + fmtSize(bytes) + '). Remove a picture or record a shorter voice note.', true);
        return;
      }
      if (!CFG.ingest) return saveLocally(payload);
      say('Sending...');
      return post(payload).then(function (r) {
        if (r.ok) return r.json().catch(function () { return {}; }).then(function (j) { finish('sent', j && j.id); });
        if (r.status >= 500 || r.status === 403 || r.status === 408) return saveLocally(payload);
        ui.send.disabled = false;
        say(r.status === 413 ? 'This is too big to send. Remove a picture or record a shorter voice note.'
          : r.status === 429 ? 'Too many reports from this network just now. Please try again in a few minutes.'
          : r.status === 401 ? "This app's feedback key is out of date. Your text is kept; please tell the Strat Edge team."
          : 'The report was refused (error ' + r.status + '). Your text is kept, so you can try again.', true);
      }, function () { return saveLocally(payload); });
    });
  }
  function saveLocally(payload) {
    return queue(payload).then(function () { finish('saved'); }, function () {
      ui.send.disabled = false;
      say('Could not send or save this report. Your text is kept; please try again.', true);
    });
  }

  function finish(kind, id) {
    draftClear();
    form.text = ''; form.files = []; dropClip();
    var p = ui.panel;
    ui.body.remove(); ui.foot.remove();
    var d = h('div', { class: 'done' + (kind === 'saved' ? ' saved' : '') });
    d.innerHTML = kind === 'sent'
      ? '<div class="badge">' + icon('check', 30) + '</div><h3>Thanks, it is with the team</h3>' +
        '<p>Someone will look at it with the picture of the page you were on.' + (id ? ' Your reference is <span class="ref">' + esc(String(id).slice(0, 12)) + '</span>.' : '') + '</p>'
      : '<div class="badge">' + icon('offline', 30) + '</div><h3>Saved on this device</h3>' +
        '<p>' + (CFG.ingest ? 'We could not reach the team just now.' : 'Feedback is not switched on for this app yet.') +
        ' Your report is kept in this browser and sends itself the next time you open the app once it can. You do not need to do anything.</p>';
    var row = h('div', { class: 'row' });
    var again = h('button', { type: 'button', class: 'ghost' }, 'Send another');
    var done = h('button', { type: 'button', class: 'primary' }, 'Done');
    again.addEventListener('click', function () { close(true); setTimeout(open, 360); });
    done.addEventListener('click', function () { close(); });
    row.appendChild(again); row.appendChild(done); d.appendChild(row);
    p.insertBefore(d, p.querySelector('.toast'));
    done.focus();
  }

  function close(quick) {
    if (!ui) return;
    stopRec(); releaseMic();
    var u = ui; ui = null;
    document.removeEventListener('paste', onPaste, true);
    u.panel.classList.remove('in'); u.scrim.classList.remove('in');
    var gone = function () { u.panel.remove(); u.scrim.remove(); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || quick === true) gone(); else setTimeout(gone, 330);
    launcher.hidden = false; placeLauncher();
    try { if (lastFocus && lastFocus.focus && quick !== true) lastFocus.focus(); else launcher.focus(); } catch (e) {}
  }

  function start() {
    renderLauncher();
    setTimeout(flush, 4000);   // after the app has booted, send anything saved while offline
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.StratEdgeReport = { open: open, close: close, render: renderLauncher, flush: flush, queued: queued, state: STATE, config: CFG };
})();
