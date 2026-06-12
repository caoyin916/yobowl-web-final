/* ===== Yo Bowl — robust external links =====
   Opens off-site links (Google Maps, review page, Instagram, online ordering)
   in a real new browser tab.

   Why this exists: in a framed preview a plain target="_blank" can be demoted
   to navigating the frame itself, and sites like Google send X-Frame-Options
   that refuse to be framed (ERR_BLOCKED_BY_RESPONSE). We open the tab via
   window.open during the user gesture, and — critically — we NEVER fall back
   to navigating the current frame, because that is exactly what triggers the
   "refused to connect" error. If a popup is genuinely blocked, we simply do
   nothing rather than break the page.

   Note: we do NOT pass 'noopener' in the features string, because that makes
   window.open return null even on success (which previously caused a bogus
   "blocked" fallback). Instead we null out the opener on the returned handle. */
(function () {
  function isExternal(href) {
    if (!href) return false;
    if (/^(tel:|mailto:|#)/i.test(href)) return false; // default handlers
    return /^https?:\/\//i.test(href);                 // only absolute http(s)
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!isExternal(href)) return; // internal/relative links navigate normally

    e.preventDefault();
    e.stopPropagation();

    const win = window.open(href, '_blank');
    // Sever the opener for security/perf when the tab actually opened.
    if (win) { try { win.opener = null; } catch (_) {} }
    // If `win` is null the popup was blocked — intentionally do nothing.
    // Navigating the current (framed) tab would load a site that refuses
    // framing and show ERR_BLOCKED_BY_RESPONSE, so we never do that.
  }, true);
})();
