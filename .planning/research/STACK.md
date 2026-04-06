# Technology Stack Recommendation

**Project:** Accounts Manager
**Scope:** Personal desktop/local-first admin tool for isolated browser profiles and persisted sessions
**Researched:** 2026-04-06
**Overall recommendation confidence:** MEDIUM-HIGH

## Executive recommendation

Build this as an **Electron desktop app with a React + TypeScript UI**, and manage accounts by launching a **real Chromium/Chrome browser process via Playwright persistent contexts**, one dedicated `userDataDir` per managed account/profile.

That is the most standard and lowest-risk 2025 stack for this product shape because the core problem is **desktop process orchestration + local filesystem persistence + browser profile isolation**, not SaaS CRUD. The browser itself should own cookies, local storage, IndexedDB, and session state. Your app should own only **metadata, labels, settings, and orchestration**.

## Recommended stack

| Layer | Technology | Version guidance | Why this choice | Confidence |
|---|---|---:|---|---|
| Desktop shell | **Electron** | latest stable major | Best fit when you need Node access, process spawning, filesystem control, packaging, and a JS/TS-only stack | HIGH |
| Packaging | **Electron Forge** | latest stable | Standard packaging/distribution path for Electron; good Vite templates and installers | HIGH |
| UI | **React** | 19.x | Standard desktop-web UI choice; strong ecosystem, easy hiring/reuse, fast iteration | MEDIUM |
| Language | **TypeScript** | 5.x | Strongly typed IPC/contracts matter in desktop apps with privileged boundaries | MEDIUM |
| Frontend build | **Vite** | 8.x | Fast local iteration; standard modern bundler for React desktop frontends | HIGH |
| Browser control | **Playwright** | latest stable 1.x | First-class persistent browser contexts and Chromium channel control; ideal for per-profile browser launches | HIGH |
| Browser runtime | **Google Chrome channel** when present; fallback to managed Chromium/Chrome for Testing for dev/CI | current stable | Best site compatibility for YouTube/Instagram while keeping managed, separate profiles | MEDIUM |
| Local database | **SQLite** | current stable | Best fit for single-user local-first metadata storage; zero-admin and file-local | HIGH |
| DB access | **better-sqlite3 + Drizzle ORM/Kit** | latest stable | Simple sync local DB access in Electron main process; Drizzle gives schema/migrations without server complexity | MEDIUM |
| Secret storage | **Electron safeStorage** | bundled with Electron | Use OS-backed encryption for app secrets/settings; do not roll your own crypto | HIGH |
| State management | **Zustand** | latest stable | Enough for a small admin UI; lighter than Redux | LOW-MEDIUM |
| Validation | **Zod** | latest stable | Validate IPC payloads, config, and imported/exported profile metadata | MEDIUM |
| Logging | **Pino** | latest stable | Fast structured logs for desktop diagnostics | LOW-MEDIUM |
| Unit/integration tests | **Vitest** | latest stable | Standard with Vite TS projects | MEDIUM |
| E2E tests | **Playwright Test** | same major as Playwright runtime | Reuse browser automation toolchain for app-level verification | MEDIUM |

## Prescriptive product architecture

### 1) App shell
- Electron main process owns:
  - app lifecycle
  - profile registry
  - filesystem paths
  - browser launch/stop
  - SQLite access
  - safeStorage calls
- React renderer owns:
  - profile list UI
  - labels/platform/account metadata
  - launch/stop actions
  - health/status views

### 2) Browser isolation model
- **One managed profile = one dedicated browser `userDataDir` on disk**
- Launch each account with **Playwright `launchPersistentContext(userDataDir)`**
- Never reuse the same `userDataDir` across different accounts
- Never point automation at the user’s normal Chrome profile

### 3) Persistence split
- **SQLite stores:**
  - profile id
  - display name
  - platform (`youtube`, `instagram`)
  - notes/tags
  - launch preferences
  - filesystem path references
  - timestamps / last opened / status
- **Browser profile directory stores:**
  - cookies
  - localStorage
  - IndexedDB
  - service worker state
  - cached auth/session artifacts

This split is important: **do not copy browser session state into your own DB unless you have a very specific export/import need later.**

## Concrete package set

### Core runtime
```bash
npm install electron react react-dom playwright better-sqlite3 drizzle-orm zod zustand pino
npm install -D typescript vite @vitejs/plugin-react electron-forge @electron-forge/plugin-vite drizzle-kit vitest @playwright/test
```

## Recommended implementation details

### Electron
Use Electron, not Tauri, for v1.

Why:
- This app is fundamentally about **process management and browser orchestration**.
- Electron keeps main-process logic in Node, which is simpler than mixing Rust + JS + browser sidecars.
- The cost of Electron’s heavier footprint is acceptable for a **single-user personal admin tool**.

### Playwright
Use Playwright as the browser launcher/controller.

Why:
- Official docs support **persistent contexts** tied to a `userDataDir`.
- It cleanly models “open this dedicated profile and keep its session on disk”.
- It supports Chrome channels and dedicated browser executables.

### Chrome/Chromium choice
Recommended policy:
- **Production/local usage:** prefer installed **Google Chrome stable** if available
- **Development/CI:** use **Chrome for Testing** or Playwright-managed browser

Why:
- YouTube/Instagram are consumer sites; branded Chrome usually gives the least compatibility friction.
- Chrome for Testing is great for reproducibility, but it is explicitly positioned for automation/testing use cases.

### SQLite
Use SQLite for metadata only.

Why:
- Official SQLite guidance strongly favors SQLite for device-local, low-concurrency application storage.
- This app is single-user, local-first, and does not need a networked database.

### Secret storage
Use `safeStorage` for things like:
- optional app passphrase
- proxy credentials
- encrypted local config secrets

Do **not** try to individually encrypt Chromium cookies yourself in v1.

## What NOT to use

### Do not use embedded webviews for account login/browsing
Avoid:
- Electron `<webview>` for YouTube/Instagram auth surfaces
- BrowserView-heavy in-app browsing architecture
- custom embedded auth flows

Why:
- Electron explicitly warns that loading remote/untrusted content inside the app carries severe security risk.
- Electron says that if your goal is to display a website, **a browser is more secure**.
- Google blocks OAuth authorization in embedded webviews for security reasons.

**Recommendation:** launch a separate real browser window/process per managed profile instead of rendering third-party account surfaces inside your privileged app shell.

### Do not use the user’s default Chrome profile
Why not:
- Chrome 136 changed remote-debugging behavior for the default data directory.
- Playwright also warns against automating the main Chrome profile.
- Mixing your app with the user’s real browsing profile is a security and reliability footgun.

**Use a dedicated app-managed directory tree instead**, e.g.:
```text
~/Library/Application Support/AccountsManager/
  db/app.sqlite
  profiles/
    youtube-google-account-1/
    youtube-google-account-2/
    instagram-account-1/
```

### Do not use Postgres / Redis / Docker in v1
Why not:
- Zero product value for a single-user local tool
- More install friction
- More failure modes
- Harder roadmap for no meaningful gain

### Do not store sessions as exported JSON blobs in your own schema
Why not:
- Incomplete compared to full browser profile state
- Easy to corrupt or desync
- Harder to support modern auth/session flows

### Do not choose Tauri first for this project
Tauri is good, but **not the default recommendation here**.

Why not for v1:
- You already need a browser sidecar/process strategy
- You already need deep local process/file orchestration
- Rust increases implementation complexity with limited user-facing benefit at this stage

Revisit Tauri only if app size/memory becomes a validated problem.

## Legal / compliance constraints to design around

### High-confidence constraints
- **Do not build v1 around automated actions on YouTube.** YouTube Terms prohibit accessing the service using automated means without prior written permission, except limited stated cases.
- **Do not use embedded webviews for Google OAuth-style login flows.** Google officially blocks OAuth in embedded webviews.
- **Do not automate the user’s default Chrome profile.** Chrome now requires non-standard user data dirs for remote debugging protections.

### Practical product rule
For v1, keep the product positioned as:
- **profile/session manager for user-driven browsing**
- not a botting tool
- not a scraper
- not a mass-action automation layer

### Low-confidence / validate before roadmap expansion
- Instagram/Meta anti-automation and embedded-browser constraints likely matter too, but I did **not** verify an official Meta source in this pass. Treat any future posting, scraping, or scripted interaction roadmap as needing phase-specific legal/policy validation.

## Confidence by recommendation

| Recommendation | Confidence | Notes |
|---|---|---|
| Electron for desktop shell | HIGH | Official docs current; strong fit for process-heavy desktop app |
| Playwright persistent contexts for isolated sessions | HIGH | Official API directly supports this |
| Dedicated per-profile `userDataDir` | HIGH | Supported by Playwright docs and reinforced by Chrome 136 changes |
| SQLite for local metadata | HIGH | Official SQLite guidance strongly matches this app shape |
| React + TS + Vite frontend | MEDIUM | Standard 2025 stack; exact framework choice is somewhat preference-driven |
| better-sqlite3 + Drizzle | MEDIUM | Strong practical fit, but more ecosystem-based than official-platform-mandated |
| Zustand + Zod + Pino | LOW-MEDIUM | Sensible defaults, but replaceable |
| Prefer Chrome stable over pure Chromium in production | MEDIUM | Practical compatibility choice; not an official requirement |

## Roadmap implications

This stack suggests the roadmap should start in this order:

1. **Desktop shell + local persistence foundation**
   - Electron app skeleton
   - secure preload/IPC
   - SQLite schema
   - app-managed storage paths

2. **Browser profile orchestration**
   - create profile directory
   - launch dedicated Playwright persistent context
   - close/reopen with session persistence

3. **Profile management UI**
   - list profiles
   - tag by platform/account
   - last used / open / close status

4. **Safety and compliance hardening**
   - no embedded third-party content in privileged renderer
   - clear boundary between manual browsing and automation
   - secure defaults around permissions and filesystem paths

## Sources

- Playwright BrowserType `launchPersistentContext` docs — HIGH  
  https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
- Electron docs (intro) — HIGH  
  https://www.electronjs.org/docs/latest/
- Electron security guide — HIGH  
  https://www.electronjs.org/docs/latest/tutorial/security
- Electron `safeStorage` docs — HIGH  
  https://www.electronjs.org/docs/latest/api/safe-storage
- Electron `protocol` docs — HIGH  
  https://www.electronjs.org/docs/latest/api/protocol
- Electron Forge docs — HIGH  
  https://www.electronforge.io/
- Vite docs — HIGH  
  https://vite.dev/guide/
- SQLite “Appropriate Uses For SQLite” — HIGH  
  https://www.sqlite.org/whentouse.html
- Chrome remote debugging changes (Chrome 136) — HIGH  
  https://developer.chrome.com/blog/remote-debugging-port
- Chrome for Testing overview — MEDIUM  
  https://developer.chrome.com/blog/chrome-for-testing/
- YouTube Terms of Service — HIGH  
  https://www.youtube.com/t/terms?hl=en&override_hl=1
- Google embedded webview OAuth policy blog — HIGH for Google auth flows  
  https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
