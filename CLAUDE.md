# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, multi-page marketing website for **Yo Bowl Carrollton** (a restaurant in Carrollton, TX). Plain HTML + CSS + vanilla JS — there is **no build step, no package manager, no backend, no tests**. It is deployed by uploading files to Hostinger static hosting (`public_html`).

## Running / developing

Open any `.html` file directly in a browser, or serve the folder over HTTP (some features — `fetch()` of `gallery-photo/photos.json`, IndexedDB — need an `http(s)://` origin, not `file://`):

```powershell
python -m http.server 8000   # then visit http://localhost:8000/
```

There is nothing to build, lint, or test. Edits to `.html`/`.css`/`.js` are the deliverable as-is.

## Deploying

Production is Hostinger static hosting (`public_html`), normally updated by uploading files manually. This environment also has the **Hostinger MCP** connected, so deploys can be driven from here via `hosting_deployStaticWebsite` (list sites first with `hosting_listWebsitesV1`). Deploying is outward-facing — confirm with the owner before pushing live.

## Cache busting (important)

CSS and JS are linked with version query strings, e.g. `css/styles.css?v=2`, `js/gallery.js?v=6`. **When you change one of these files, bump its `?v=` number in every HTML page that references it**, or returning visitors get stale cached copies. Search across all `.html` files since the same asset is linked from each page.

## Architecture

Five standalone pages, each a full HTML document that repeats the same header/footer markup: `index.html`, `Menu.html`, `Gallery.html`, `Location.html`, `Catering.html`. There is no templating — **changes to shared chrome (nav, footer, header actions) must be applied to every page by hand**.

Each page also carries its own duplicated SEO/social `<head>` block: canonical URL (`https://www.yobowl.com/…`), Open Graph + Twitter Card tags, and JSON-LD structured data (`application/ld+json`, e.g. the restaurant schema with the Toast ordering URL as its order action). These are per-page and easy to miss — **when business facts change (name, address, hours, ordering URL), update them across all five pages, not just the visible body copy.**

Shared assets pulled in by the pages:
- `css/styles.css` — the entire design system ("Chili Oil & Porcelain"), driven by CSS custom properties at `:root` (brand reds/ambers, fonts, shadows, spacing). Mobile-safe overflow handling lives here.
- `js/reveal.js` — progressive enhancement only: header `.scrolled` state, `[data-reveal]` scroll-in animations (via IntersectionObserver, with `data-reveal-delay`), and hero parallax. All motion is gated on `prefers-reduced-motion`. Content hidden for reveal is scoped under `html.js` (set inline in each `<head>`), so disabling JS never hides content.
- `js/external-links.js` — intercepts clicks on absolute `http(s)` links and opens them with `window.open(..., '_blank')`. **Do not "simplify" this back to a plain `target="_blank"`.** It exists because the site is often viewed in a framed preview where external sites (Google, ordering) refuse framing (`ERR_BLOCKED_BY_RESPONSE`); it deliberately never falls back to navigating the current frame.

Online ordering everywhere links out to `https://order.toasttab.com/online/yobowl`.

## Gallery + admin publishing model (`js/gallery.js`, `Gallery.html`)

This is the one piece of real logic. Because hosting is static (no server, no DB):
- **Public visitors** see real image files in `gallery-photo/`, enumerated by `gallery-photo/photos.json` (a plain JSON array of filenames). That file is the source of truth for the live gallery.
- **Owner admin mode** is a client-side preview/packaging tool, unlocked at `Gallery.html#admin` with passcode `yobowl` (constant `ADMIN_PASSCODE` in `gallery.js`; unlock state persists in `localStorage`). Uploaded photos are held only in **IndexedDB** in that browser ("preview · not yet published") and drag-to-reorder order / pending removals are stored in `localStorage`.
- Publishing is done via **"Download publish bundle"**, which builds a `gallery-photo.zip` (dependency-free, store-only ZIP writer + CRC32 implemented inline) containing every photo plus a regenerated `photos.json`. The owner uploads and extracts that zip on Hostinger; only then do changes go live. The owner never hand-edits `photos.json`.

## `image-slot.js` — not part of the live site

`image-slot.js` defines an `<image-slot>` web component (drag-to-fill image placeholder) that persists drops to an `.image-slots.state.json` sidecar through a `window.omelette` host bridge. It is an authoring/design-tool artifact and is **not referenced by any of the published HTML pages** — those use plain `<img>` tags. Leave it out of production-page reasoning unless explicitly working on it.

## Other image directories

`location-photo/` and `menu-photo/` are plain, hardcoded `<img src="…">` references from `Location.html` and `Menu.html` — no JSON manifest, no admin tooling, unlike `gallery-photo/`. `gbp-photo/` and `ig-photo/` (Google Business Profile / Instagram photo dumps) are tracked source-asset folders, and `uploads/` is an untracked one — none of the three are referenced by any page; treat them as raw material staged outside the site, not live assets.
