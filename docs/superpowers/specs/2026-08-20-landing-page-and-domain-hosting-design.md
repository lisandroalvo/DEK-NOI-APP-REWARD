<!-- ABOUTME: Design spec for the DEK NOI landing page plus the custom-domain hosting layout. -->
<!-- ABOUTME: Covers Firebase multi-site hosting, Namecheap DNS, and the static landing page build. -->

# DEK NOI — Landing Page & Domain Hosting Design

**Date:** 2026-08-20
**Status:** Approved design, pre-implementation

## Goal

Put three properties on a newly purchased custom domain, and build the one
missing piece (a public landing page). The rewards app and back office already
exist; this work is mostly DNS plus a new static landing page.

## The three properties

| Property | Domain | Hosting | State |
|---|---|---|---|
| Landing page | `yourdomain.com` + `www.yourdomain.com` | Firebase Hosting (new site) | **to build** |
| Rewards app (this repo) | `app.yourdomain.com` | Firebase Hosting (existing `dist`) | live, add domain |
| Back office dashboard | `dashboard.yourdomain.com` | Vercel (separate repo) | live, add domain |

`yourdomain.com` is a placeholder for the actual purchased domain (registered at
Namecheap; DNS managed under Namecheap → Advanced DNS).

### Security note

`dashboard.yourdomain.com` is a guessable URL. A URL is never a secret (it leaks
via DNS, TLS certificates, browser history). The back office stays protected by
**authentication and an account allowlist for the ~3 internal users**, not by URL
obscurity. Hosting layout has no bearing on its security.

## Part 1 — Hosting & DNS

### Firebase multi-site

The existing Firebase project (`dek-noi-4a39d`) will serve **two hosting sites**:
- the existing rewards app (target: `app.yourdomain.com`)
- a new `landing` site (target: root + `www`)

`firebase.json` gains a `hosting` **array** (one entry per site, each with a
`target`), and `.firebaserc` maps targets to site IDs. `firebase deploy` then
ships both.

### DNS records (Namecheap → Advanced DNS)

Exact record values are produced by each provider's console during setup. The
shape:

- **Root + `www`** → records provided by Firebase Console (Hosting → Add custom
  domain) for the `landing` site.
- **`app`** → CNAME/records provided by Firebase for the app site.
- **`dashboard`** → CNAME provided by Vercel (Project → Settings → Domains).

No code involved in DNS; these are registrar rows plus provider verification.

## Part 2 — Landing page

### Tech

A **single self-contained static page**: hand-written `index.html` + one CSS file,
**no framework, no build step**. Fastest to ship, trivial to grow. If it later
becomes a true multi-page marketing site, revisit with Astro (YAGNI for now).

Lives in a new top-level `landing/` folder in this repo (deployed as the Firebase
`landing` site). Reuses existing brand assets from `src/assets/`.

### Brand

Pulled from the app so the two feel like one product:
- Primary red `#CC0000`
- Accent yellow `#FFE600`
- Soft cream / pink neutrals (`#FFF9E0`, `#FFF0F0`)
- Logo: `src/assets/logo.png`
- Optional supporting art: `src/assets/hero.png`, character PNGs

### Language

**Thai-first with an English toggle**, matching the app's existing i18n direction.
Simple client-side toggle (no routing) — swap text via a small JS map or
`data-*` attributes.

### Sections (single scrolling page)

1. **Hero** — logo, one-line Thai tagline, primary **"เปิดแอป / Open the App"**
   button → `https://app.yourdomain.com`.
2. **What it is** — 2–3 short value props: collect points, scan bills, redeem
   rewards.
3. **Location** — **Supalai River Resort** (single branch), with a Google Maps
   link.
4. **Contact** —
   - Email: `deknoi24@gmail.com`
   - Phone: `062-028-3183`
   - LINE: QR image from `src/assets/line-qr.png`
5. **Footer** — copyright, link to the app's existing `/privacy` page.

### "Download" = PWA install

The rewards app is a web app, not a native store app. The hero button opens
`app.yourdomain.com`. Users can "install" it via the browser's Add to Home Screen
(PWA), which launches fullscreen like a native app. No app-store track in scope.

## Out of scope

- Native iOS/Android store apps.
- Multi-page marketing site / CMS.
- Any change to the back office repo beyond adding its Vercel custom domain.
- Changes to rewards-app functionality (only its custom domain is added).

## Open items to confirm during build

- Final purchased domain name (replaces `yourdomain.com` throughout).
- Exact Thai copy for tagline and value props (draft, user to refine).
- Google Maps URL for Supalai River Resort.
