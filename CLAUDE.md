# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, multi-page marketing website for **Yo Bowl** (Chinese restaurant, two locations: Carrollton, TX and Plano, TX). Plain HTML + CSS + vanilla JS — there is **no build step, no package manager, no backend, no tests, no git**. It is deployed by uploading files to Hostinger static hosting (`public_html`).

## Running / developing

Open any `.html` file directly in a browser, or serve the folder over HTTP (some features — `fetch()` of `gallery-photo/photos.json`, IndexedDB — need an `http(s)://` origin, not `file://`):

```powershell
python -m http.server 8000   # then visit http://localhost:8000/
```

There is nothing to build, lint, or test. Edits to `.html`/`.css`/`.js` are the deliverable as-is.

## Deploying

Production is Hostinger static hosting (`public_html`), normally updated by uploading files manually. This environment also has the **Hostinger MCP** connected, so deploys can be driven from here via `hosting_deployStaticWebsite` (list sites first with `hosting_listWebsitesV1`). Deploying is outward-facing — confirm with the owner before pushing live.

## Cache busting (important)

CSS and JS are linked with version query strings, e.g. `css/styles.css?v=6`, `js/gallery.js?v=6`. **When you change one of these files, bump its `?v=` number in every HTML page that references it**, or returning visitors get stale cached copies. Search across all `.html` files since the same asset is linked from each page.

## Architecture

Five standalone pages, each a full HTML document that repeats the same header/footer markup: `index.html`, `Menu.html`, `Gallery.html`, `Location.html`, `Catering.html`. There is no templating — **changes to shared chrome (nav, footer, header actions) must be applied to every page by hand**.

Each page also carries its own duplicated SEO/social `<head>` block: canonical URL (`https://www.yobowl.com/…`), Open Graph + Twitter Card tags, and JSON-LD structured data (`application/ld+json`, e.g. the restaurant schema — currently scoped to the Carrollton address/geo only, even though the site now serves two locations). These are per-page and easy to miss — **when business facts change (name, address, hours, ordering URL), update them across all five pages, not just the visible body copy.**

Shared assets pulled in by the pages:
- `css/styles.css` — the entire design system ("Chili Oil & Porcelain"), driven by CSS custom properties at `:root` (brand reds/ambers, fonts, shadows, spacing). Mobile-safe overflow handling lives here.
- `js/reveal.js` — progressive enhancement only: header `.scrolled` state, `[data-reveal]` scroll-in animations (via IntersectionObserver, with `data-reveal-delay`), and hero parallax. All motion is gated on `prefers-reduced-motion`. Content hidden for reveal is scoped under `html.js` (set inline in each `<head>`), so disabling JS never hides content.
- `js/external-links.js` — intercepts clicks on absolute `http(s)` links and opens them with `window.open(..., '_blank')`. **Do not "simplify" this back to a plain `target="_blank"`.** It exists because the site is often viewed in a framed preview where external sites (Google, ordering) refuse framing (`ERR_BLOCKED_BY_RESPONSE`); it deliberately never falls back to navigating the current frame. It also deliberately omits `noopener` from the `window.open` features string (that made Chrome return `null` even on success) and instead nulls out `win.opener` manually.
- `js/order-locations.js` — since there are two locations, `[data-order-toggle]` ("Order Online" buttons/cart icon) and `[data-review-toggle]` ("Write A Review") don't link directly; this script builds a small modal listing both locations (name/address/URL hardcoded in the `ORDER_LOCATIONS` / `REVIEW_LOCATIONS` arrays at the top of the file) and lets the visitor pick one before leaving the site. **When a location's ordering URL, review URL, address, or hours changes, update it here too**, not just in the footer/Location.html copy.

Ordering URLs (per location, defined in `order-locations.js`): Carrollton → `https://order.toasttab.com/online/yobowl`, Plano → `https://order.toasttab.com/online/yo-bowl-plano-em-4701-west-park-boulevard`.

## Gallery + admin publishing model (`js/gallery.js`, `Gallery.html`)

This is the one piece of real logic. Because hosting is static (no server, no DB):
- **Public visitors** see real image files in `gallery-photo/`, enumerated by `gallery-photo/photos.json` (a plain JSON array of filenames). That file is the source of truth for the live gallery.
- **Owner admin mode** is a client-side preview/packaging tool, unlocked at `Gallery.html#admin` with passcode `yobowl` (constant `ADMIN_PASSCODE` in `gallery.js`; unlock state persists in `localStorage`). Uploaded photos are held only in **IndexedDB** in that browser ("preview · not yet published") and drag-to-reorder order / pending removals are stored in `localStorage`.
- Publishing is done via **"Download publish bundle"**, which builds a `gallery-photo.zip` (dependency-free, store-only ZIP writer + CRC32 implemented inline) containing every photo plus a regenerated `photos.json`. The owner uploads and extracts that zip on Hostinger; only then do changes go live. The owner never hand-edits `photos.json`.

## Contact form (`Catering.html` only)

The other piece of real logic, at the bottom of the Catering page (`#contactForm`). Since there's no backend, it posts to **Web3Forms** (`https://api.web3forms.com/submit`), a third-party form-to-email service. Key facts:
- The `access_key` hidden input identifies the Web3Forms account; the **recipient email is configured in the Web3Forms dashboard, not in this repo** (currently `yobowl.carrollton@gmail.com`). To change where messages go, log in at web3forms.com and update the recipient — no code change, the access key stays the same. See the HOW-TO comment near the bottom of `Catering.html`.
- Spam protection is a hidden `botcheck` honeypot **plus** hCaptcha (`.h-captcha[data-captcha]`, auto-filled by the Web3Forms client script). The inline submit handler blocks submission until the hCaptcha token is present, then POSTs via `fetch()` and shows an inline status. Don't remove the honeypot or the captcha gate.

## Other image directories

`location-photo/` and `menu-photo/` are plain, hardcoded `<img src="…">` references from `Location.html` and `Menu.html` — no JSON manifest, no admin tooling, unlike `gallery-photo/`.

## `uploads/`

`uploads/6-yobowl-web-design-final - Copy/` is a snapshot of an older version of this site (its own `CLAUDE.md`, HTML pages, an `image-slot.js` drag-to-fill authoring tool, etc.). Nothing under `uploads/` is referenced by any live page — treat it as reference/raw material, not part of the deployed site, and don't assume its contents (e.g. that older CLAUDE.md, or `image-slot.js`) reflect current behavior.
