<!-- ABOUTME: Implementation plan for the DEK NOI landing page and custom-domain hosting. -->
<!-- ABOUTME: Bite-sized tasks covering Firebase multi-site, the static landing page, and DNS wiring. -->

# Landing Page & Domain Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Thai-first landing page and put all three DEK NOI properties (landing, rewards app, back office) on the new custom domain.

**Architecture:** A single self-contained static landing page (plain HTML + CSS + a tiny JS language toggle) lives in a new `landing/` folder and deploys as a second Firebase Hosting site in the existing `dek-noi-4a39d` project. The rewards app keeps its current Firebase site; the back office keeps its Vercel deploy. Custom subdomains are wired via Namecheap DNS.

**Tech Stack:** Static HTML5 + CSS (no framework, no build step), one small ES module for the language toggle, Vitest for that module's test, Firebase Hosting multi-site, Namecheap Advanced DNS.

## Global Constraints

- Every source file starts with two `ABOUTME:` comment lines (per repo CLAUDE.md).
- Brand palette (verbatim from app): primary red `#CC0000`, accent yellow `#FFE600`, cream `#FFF9E0`, soft pink `#FFF0F0`.
- Landing is **Thai-first with an English toggle**; Thai is the default rendered language.
- Reuse existing assets: `src/assets/logo.png`, `src/assets/line-qr.png` (optionally `src/assets/hero.png`).
- Contact: email `deknoi24@gmail.com`, phone `062-028-3183`.
- Single location: **Supalai River Resort**.
- Hero CTA links to `https://app.deknoi24.com` where `deknoi24.com` is the real purchased domain (placeholder `deknoi24.com` until confirmed).
- Do NOT change rewards-app functionality; only its hosting target/domain.
- Never use `--no-verify`; never commit with failing hooks.

---

### Task 1: Landing folder scaffold + copy content module

**Files:**
- Create: `landing/content.js`
- Test: `landing/content.test.js`

**Interfaces:**
- Produces: `CONTENT` — an object `{ th: {...}, en: {...} }` where each locale has keys `tagline`, `valueProps` (array of `{title, body}`), `locationName`, `locationMapUrl`, `contactEmail`, `contactPhone`, `openApp`, `contactHeading`, `locationHeading`, `footer`.
- Produces: `getContent(lang)` → returns `CONTENT[lang]`, defaulting to `CONTENT.th` for any unknown/missing `lang`.

- [ ] **Step 1: Write the failing test**

```js
// landing/content.test.js
// ABOUTME: Tests the landing page copy module and its language fallback.
// ABOUTME: Ensures Thai is the default and both locales expose the same keys.
import { describe, it, expect } from 'vitest'
import { CONTENT, getContent } from './content.js'

describe('landing content', () => {
  it('defaults to Thai for unknown language', () => {
    expect(getContent('xx')).toBe(CONTENT.th)
    expect(getContent(undefined)).toBe(CONTENT.th)
  })

  it('returns English when asked', () => {
    expect(getContent('en')).toBe(CONTENT.en)
  })

  it('exposes identical keys in both locales', () => {
    expect(Object.keys(CONTENT.th).sort()).toEqual(Object.keys(CONTENT.en).sort())
  })

  it('carries the real contact details in both locales', () => {
    for (const lang of ['th', 'en']) {
      expect(CONTENT[lang].contactEmail).toBe('deknoi24@gmail.com')
      expect(CONTENT[lang].contactPhone).toBe('062-028-3183')
      expect(CONTENT[lang].locationName).toBe('Supalai River Resort')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run landing/content.test.js`
Expected: FAIL — cannot resolve `./content.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// landing/content.js
// ABOUTME: Thai/English copy for the DEK NOI landing page.
// ABOUTME: getContent() returns a locale block and falls back to Thai.
export const CONTENT = {
  th: {
    tagline: 'สะสมแต้ม แลกของรางวัล ที่ร้านเด็กน้อย',
    valueProps: [
      { title: 'สะสมแต้ม', body: 'รับแต้มทุกครั้งที่ใช้บริการ' },
      { title: 'สแกนบิล', body: 'ถ่ายรูปบิลเพื่อรับแต้มอัตโนมัติ' },
      { title: 'แลกรางวัล', body: 'นำแต้มไปแลกของรางวัลสุดพิเศษ' },
    ],
    openApp: 'เปิดแอป',
    locationHeading: 'ที่ตั้งร้าน',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.google.com/?q=Supalai+River+Resort',
    contactHeading: 'ติดต่อเรา',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
  en: {
    tagline: 'Collect points and redeem rewards at DEK NOI',
    valueProps: [
      { title: 'Collect points', body: 'Earn points every time you visit' },
      { title: 'Scan your bill', body: 'Snap a photo of your bill to earn automatically' },
      { title: 'Redeem rewards', body: 'Turn points into special rewards' },
    ],
    openApp: 'Open the App',
    locationHeading: 'Our Location',
    locationName: 'Supalai River Resort',
    locationMapUrl: 'https://maps.google.com/?q=Supalai+River+Resort',
    contactHeading: 'Contact Us',
    contactEmail: 'deknoi24@gmail.com',
    contactPhone: '062-028-3183',
    footer: '© DEK NOI',
  },
}

export function getContent(lang) {
  return CONTENT[lang] || CONTENT.th
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run landing/content.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add landing/content.js landing/content.test.js
git commit -m "feat(landing): add bilingual copy module with Thai fallback"
```

---

### Task 2: Landing page HTML + brand CSS

**Files:**
- Create: `landing/index.html`
- Create: `landing/styles.css`
- Create: `landing/assets/logo.png` (copied from `src/assets/logo.png`)
- Create: `landing/assets/line-qr.png` (copied from `src/assets/line-qr.png`)

**Interfaces:**
- Consumes: brand palette and asset paths from Global Constraints.
- Produces: a static page with element IDs the toggle script (Task 3) targets:
  `#tagline`, `#value-props`, `#open-app`, `#location-heading`, `#location-name`,
  `#location-map`, `#contact-heading`, `#contact-email`, `#contact-phone`,
  `#footer-text`, `#lang-toggle`. Initial HTML renders the **Thai** copy.

- [ ] **Step 1: Copy brand assets into the landing folder**

```bash
mkdir -p landing/assets
cp src/assets/logo.png landing/assets/logo.png
cp src/assets/line-qr.png landing/assets/line-qr.png
```

- [ ] **Step 2: Write `landing/index.html`**

Single scrolling page. Thai copy hard-coded as the server-rendered default (the
toggle only rewrites it on click). Sections in order: hero, value props, location,
contact, footer. Note the two ABOUTME lines go in an HTML comment.

```html
<!DOCTYPE html>
<!-- ABOUTME: DEK NOI public landing page, Thai-first with an English toggle. -->
<!-- ABOUTME: Static single-page marketing site; links out to the rewards web app. -->
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DEK NOI — สะสมแต้ม แลกของรางวัล</title>
  <link rel="icon" href="assets/logo.png" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <img class="logo" src="assets/logo.png" alt="DEK NOI" />
    <button id="lang-toggle" class="lang-toggle" type="button">EN</button>
  </header>

  <section class="hero">
    <h1 id="tagline">สะสมแต้ม แลกของรางวัล ที่ร้านเด็กน้อย</h1>
    <a id="open-app" class="cta" href="https://app.deknoi24.com">เปิดแอป</a>
  </section>

  <section class="props">
    <div id="value-props" class="props-grid"></div>
  </section>

  <section class="location">
    <h2 id="location-heading">ที่ตั้งร้าน</h2>
    <a id="location-map" href="https://maps.google.com/?q=Supalai+River+Resort" target="_blank" rel="noopener">
      <span id="location-name">Supalai River Resort</span>
    </a>
  </section>

  <section class="contact">
    <h2 id="contact-heading">ติดต่อเรา</h2>
    <p><a id="contact-email" href="mailto:deknoi24@gmail.com">deknoi24@gmail.com</a></p>
    <p><a id="contact-phone" href="tel:+66620283183">062-028-3183</a></p>
    <img class="qr" src="assets/line-qr.png" alt="LINE QR" />
  </section>

  <footer class="footer">
    <span id="footer-text">© DEK NOI</span>
    <a href="https://app.deknoi24.com/privacy">Privacy</a>
  </footer>

  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `landing/styles.css`**

```css
/* ABOUTME: Brand-matched styles for the DEK NOI landing page. */
/* ABOUTME: Uses the app's red/yellow palette; mobile-first, single column. */
:root {
  --red: #CC0000;
  --yellow: #FFE600;
  --cream: #FFF9E0;
  --pink: #FFF0F0;
  --ink: #222;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, "Noto Sans Thai", sans-serif;
  color: var(--ink);
  background: var(--cream);
}
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.logo { height: 44px; }
.lang-toggle {
  border: 2px solid var(--red); background: transparent; color: var(--red);
  border-radius: 999px; padding: 0.3rem 0.9rem; font-weight: 700; cursor: pointer;
}
.hero {
  text-align: center; padding: 2.5rem 1.25rem 3rem;
  background: var(--pink);
}
.hero h1 { font-size: 1.6rem; line-height: 1.35; margin: 0 0 1.5rem; }
.cta {
  display: inline-block; background: var(--red); color: #fff;
  text-decoration: none; font-weight: 800;
  padding: 0.85rem 2rem; border-radius: 999px;
}
.props { padding: 2rem 1.25rem; }
.props-grid { display: grid; gap: 1rem; max-width: 720px; margin: 0 auto; }
.prop {
  background: #fff; border-radius: 16px; padding: 1.25rem;
  border: 3px solid var(--yellow);
}
.prop h3 { margin: 0 0 0.4rem; color: var(--red); }
.prop p { margin: 0; }
.location, .contact { text-align: center; padding: 2rem 1.25rem; }
.location a { color: var(--red); font-weight: 700; font-size: 1.15rem; }
.qr { width: 180px; height: 180px; object-fit: contain; margin-top: 1rem; }
.footer {
  display: flex; gap: 1rem; justify-content: center;
  padding: 2rem 1.25rem; background: var(--pink);
}
.footer a { color: var(--red); }
@media (min-width: 720px) {
  .hero h1 { font-size: 2.2rem; }
  .props-grid { grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 4: Verify it renders locally**

Run: `npx serve landing` (or `python3 -m http.server -d landing 5055`) and open the URL.
Expected: Thai hero, three empty prop cards (populated in Task 3), location, contact with QR, footer. No console errors except possibly the missing `main.js` until Task 3.

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/styles.css landing/assets/logo.png landing/assets/line-qr.png
git commit -m "feat(landing): add static landing page markup and brand styles"
```

---

### Task 3: Language toggle wiring

**Files:**
- Create: `landing/main.js`
- Test: `landing/render.test.js`
- Create: `landing/render.js`

**Interfaces:**
- Consumes: `getContent(lang)` from `landing/content.js` (Task 1).
- Produces: `applyContent(doc, lang)` in `landing/render.js` — writes the locale's
  text into the DOM elements by ID (see Task 2 ID list) and toggles the
  `#lang-toggle` label between `EN`/`TH` and `<html lang>` between `th`/`en`.
- Produces: `landing/main.js` — the browser entry that calls `applyContent(document, 'th')`
  on load and flips language on `#lang-toggle` click.

- [ ] **Step 1: Write the failing test**

```js
// landing/render.test.js
// ABOUTME: Tests that applyContent writes the right locale into the DOM.
// ABOUTME: Uses a minimal happy-dom/jsdom document built inline.
import { describe, it, expect, beforeEach } from 'vitest'
import { applyContent } from './render.js'
import { CONTENT } from './content.js'

function makeDoc() {
  document.documentElement.lang = 'th'
  document.body.innerHTML = `
    <button id="lang-toggle">EN</button>
    <h1 id="tagline"></h1>
    <div id="value-props"></div>
    <a id="open-app"></a>
    <h2 id="location-heading"></h2>
    <span id="location-name"></span>
    <a id="location-map"></a>
    <h2 id="contact-heading"></h2>
    <a id="contact-email"></a>
    <a id="contact-phone"></a>
    <span id="footer-text"></span>`
  return document
}

describe('applyContent', () => {
  beforeEach(() => { makeDoc() })

  it('renders English copy and sets EN state', () => {
    applyContent(document, 'en')
    expect(document.getElementById('tagline').textContent).toBe(CONTENT.en.tagline)
    expect(document.getElementById('open-app').textContent).toBe(CONTENT.en.openApp)
    expect(document.getElementById('value-props').children.length).toBe(3)
    expect(document.documentElement.lang).toBe('en')
    expect(document.getElementById('lang-toggle').textContent).toBe('TH')
  })

  it('renders Thai copy and sets TH state', () => {
    applyContent(document, 'th')
    expect(document.getElementById('tagline').textContent).toBe(CONTENT.th.tagline)
    expect(document.documentElement.lang).toBe('th')
    expect(document.getElementById('lang-toggle').textContent).toBe('EN')
  })
})
```

- [ ] **Step 2: Confirm a DOM test environment**

Run: `npx vitest run landing/render.test.js --environment jsdom`
Expected: FAIL — cannot resolve `./render.js`. (If jsdom is missing, install it:
`npm i -D jsdom`, then re-run. This confirms the test harness before writing code.)

- [ ] **Step 3: Write `landing/render.js`**

```js
// landing/render.js
// ABOUTME: Applies a locale's copy to the landing page DOM by element id.
// ABOUTME: Pure DOM writes so it can be unit-tested without a browser.
import { getContent } from './content.js'

export function applyContent(doc, lang) {
  const c = getContent(lang)
  const set = (id, text) => { const el = doc.getElementById(id); if (el) el.textContent = text }

  set('tagline', c.tagline)
  set('open-app', c.openApp)
  set('location-heading', c.locationHeading)
  set('location-name', c.locationName)
  set('contact-heading', c.contactHeading)
  set('footer-text', c.footer)

  const email = doc.getElementById('contact-email')
  if (email) { email.textContent = c.contactEmail; email.setAttribute('href', `mailto:${c.contactEmail}`) }
  const phone = doc.getElementById('contact-phone')
  if (phone) { phone.textContent = c.contactPhone }
  const map = doc.getElementById('location-map')
  if (map) map.setAttribute('href', c.locationMapUrl)

  const grid = doc.getElementById('value-props')
  if (grid) {
    grid.innerHTML = ''
    for (const p of c.valueProps) {
      const card = doc.createElement('div')
      card.className = 'prop'
      const h = doc.createElement('h3'); h.textContent = p.title
      const body = doc.createElement('p'); body.textContent = p.body
      card.appendChild(h); card.appendChild(body); grid.appendChild(card)
    }
  }

  doc.documentElement.lang = lang === 'en' ? 'en' : 'th'
  const toggle = doc.getElementById('lang-toggle')
  if (toggle) toggle.textContent = lang === 'en' ? 'TH' : 'EN'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run landing/render.test.js --environment jsdom`
Expected: PASS (2 tests).

- [ ] **Step 5: Write `landing/main.js` (browser entry)**

```js
// landing/main.js
// ABOUTME: Browser entry for the landing page; wires the language toggle.
// ABOUTME: Renders Thai on load and flips between TH/EN on button click.
import { applyContent } from './render.js'

let lang = 'th'
applyContent(document, lang)

document.getElementById('lang-toggle')?.addEventListener('click', () => {
  lang = lang === 'th' ? 'en' : 'th'
  applyContent(document, lang)
})
```

- [ ] **Step 6: Verify in a browser**

Run: `npx serve landing` and open it. Click the EN/TH button.
Expected: three prop cards appear on load in Thai; clicking swaps all copy to English and the button label to `TH`; clicking again reverts. No console errors.

- [ ] **Step 7: Commit**

```bash
git add landing/render.js landing/render.test.js landing/main.js
git commit -m "feat(landing): add language toggle rendering and browser wiring"
```

---

### Task 4: Firebase multi-site config (landing + app)

**Files:**
- Modify: `firebase.json` (convert `hosting` object → array of two site entries)
- Modify: `.firebaserc` (add hosting `targets`)

**Interfaces:**
- Consumes: existing app build output `dist/`, new `landing/` folder.
- Produces: two deploy targets — `app` (public `dist`, SPA rewrite) and `landing`
  (public `landing`). `firebase deploy --only hosting` ships both.

**Prerequisite (manual, in Firebase Console or CLI):** create the second site.
```bash
firebase hosting:sites:create dek-noi-landing --project dek-noi-4a39d
firebase target:apply hosting app dek-noi-4a39d --project dek-noi-4a39d
firebase target:apply hosting landing dek-noi-landing --project dek-noi-4a39d
```
(`dek-noi-4a39d` is the existing default site that already serves the app; the
`target:apply` commands write the `.firebaserc` target map. Adjust the landing
site ID if that name is taken.)

- [ ] **Step 1: Convert `firebase.json` hosting to an array**

Replace the single `"hosting": { ... }` object with:

```json
  "hosting": [
    {
      "target": "app",
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "landing",
      "public": "landing",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "**/*.test.js"]
    }
  ],
```

Leave `firestore`, `storage`, `functions`, `emulators` blocks unchanged.

- [ ] **Step 2: Confirm `.firebaserc` has the target map**

After the `target:apply` commands above, `.firebaserc` should look like:

```json
{
  "projects": { "default": "dek-noi-4a39d" },
  "targets": {
    "dek-noi-4a39d": {
      "hosting": {
        "app": ["dek-noi-4a39d"],
        "landing": ["dek-noi-landing"]
      }
    }
  }
}
```

If the CLI didn't write it, add it by hand to match.

- [ ] **Step 3: Verify config resolves without deploying**

Run: `npx firebase deploy --only hosting --dry-run --project dek-noi-4a39d`
(If `--dry-run` is unsupported on the installed CLI version, run
`npx firebase hosting:channel:deploy preview-landing --only landing --project dek-noi-4a39d`
to push the landing site to a temporary preview URL instead.)
Expected: both `app` and `landing` targets are recognized; no "target not found" error.

- [ ] **Step 4: Deploy the landing site**

Run: `npx firebase deploy --only hosting:landing --project dek-noi-4a39d`
Expected: deploy succeeds; note the printed `*.web.app` URL for the landing site.
Open it and confirm the page renders (Thai default, toggle works).

- [ ] **Step 5: Commit**

```bash
git add firebase.json .firebaserc
git commit -m "chore(hosting): add Firebase multi-site config for landing + app"
```

---

### Task 5: Wire custom domains (manual — Namecheap + consoles)

**Files:** none (registrar + provider dashboards only). This task has no code; it
is a checklist to run after Task 4 deploys successfully. Replace `deknoi24.com`
with the real domain everywhere, then update the two hero/footer links in
`landing/index.html` (they currently point at `app.deknoi24.com`).

- [ ] **Step 1: Replace the placeholder domain in the landing page**

In `landing/index.html`, change both `https://app.deknoi24.com` occurrences
(hero CTA `href` and footer privacy link) to the real `https://app.deknoi24.com`.
Also update `locationMapUrl` in `landing/content.js` if you have the exact Google
Maps place URL. Re-run `npx vitest run landing/` — expect PASS. Commit:
`git commit -am "chore(landing): point links at the real domain"`. Re-deploy landing (Task 4, Step 4).

- [ ] **Step 2: Root domain → Firebase landing site**

Firebase Console → Hosting → the `dek-noi-landing` site → **Add custom domain** →
enter `deknoi24.com` and `www.deknoi24.com`. Firebase shows either A records or a TXT
verification + A records. Copy them.

- [ ] **Step 3: App subdomain → Firebase app site**

Firebase Console → Hosting → the app site → **Add custom domain** →
`app.deknoi24.com`. Copy the records it shows.

- [ ] **Step 4: Dashboard subdomain → Vercel**

Vercel → the back-office project → Settings → Domains → add `dashboard.deknoi24.com`.
Copy the CNAME target Vercel gives (typically `cname.vercel-dns.com`).

- [ ] **Step 5: Enter all records in Namecheap**

Namecheap → Domain List → Manage `deknoi24.com` → **Advanced DNS**. Add:
- Firebase root/`www` records (A and/or TXT) from Step 2.
- `app` record (CNAME/A) from Step 3.
- `dashboard` CNAME → Vercel target from Step 4.
Remove Namecheap's default "parking" A record and CNAME so they don't conflict.

- [ ] **Step 6: Verify propagation and TLS**

Wait for DNS (minutes to a few hours). Confirm in each console that the domain
shows **Connected / valid certificate**. Then load in a browser:
- `https://deknoi24.com` → landing page
- `https://app.deknoi24.com` → rewards app (login works)
- `https://dashboard.deknoi24.com` → back office (login works)
Expected: all three serve over HTTPS with no cert warnings.

---

## Self-Review

**Spec coverage:**
- Landing hosted on Firebase multi-site → Task 4. ✅
- App custom domain → Task 5 Step 3/5. ✅
- Dashboard custom domain (Vercel) → Task 5 Step 4/5. ✅
- Namecheap DNS → Task 5 Step 5. ✅
- Thai-first + EN toggle → Tasks 1, 3. ✅
- Sections (hero/props/location/contact/footer) → Task 2. ✅
- Real contact/location/assets → Tasks 1, 2 (asserted in tests). ✅
- PWA "Open the App" CTA → Task 2 hero link (PWA install is an app-side behavior, no landing work). ✅
- Privacy footer link → Task 2. ✅
- Brand palette → Task 2 CSS (verbatim hex). ✅

**Placeholder scan:** `deknoi24.com` is an intentional, flagged placeholder resolved in Task 5 Step 1; no other TBD/TODO. ✅

**Type consistency:** `getContent(lang)` (Task 1) consumed by `applyContent` (Task 3); element IDs in Task 2 match those written by `applyContent` and asserted in Task 3's test. ✅
