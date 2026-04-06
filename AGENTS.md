<!-- GSD:project-start source:PROJECT.md -->
## Project

**Accounts Manager**

Полноценная админка для управления личными аккаунтами в разных сервисах, начиная с YouTube и Instagram. Главная задача - создавать отдельные браузерные профили по кнопке и хранить в них изолированные сессии, чтобы не перелогиниваться вручную между несколькими аккаунтами.

**Core Value:** Я могу быстро открыть нужный аккаунт в уже готовом изолированном браузерном профиле без повторного логина.

### Constraints

- **Audience**: Один пользователь, личный use case - решение оптимизирует персональный рабочий процесс.
- **Platform scope**: YouTube и Instagram в v1 - это явно обозначенные стартовые платформы.
- **Session isolation**: Сессии должны быть изолированы на уровне профиля - иначе пропадает основная ценность продукта.
- **Persistence**: Сессии должны переживать перезапуск профиля - иначе снова появится ручной логин.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive recommendation
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
- React renderer owns:
### 2) Browser isolation model
- **One managed profile = one dedicated browser `userDataDir` on disk**
- Launch each account with **Playwright `launchPersistentContext(userDataDir)`**
- Never reuse the same `userDataDir` across different accounts
- Never point automation at the user’s normal Chrome profile
### 3) Persistence split
- **SQLite stores:**
- **Browser profile directory stores:**
## Concrete package set
### Core runtime
## Recommended implementation details
### Electron
- This app is fundamentally about **process management and browser orchestration**.
- Electron keeps main-process logic in Node, which is simpler than mixing Rust + JS + browser sidecars.
- The cost of Electron’s heavier footprint is acceptable for a **single-user personal admin tool**.
### Playwright
- Official docs support **persistent contexts** tied to a `userDataDir`.
- It cleanly models “open this dedicated profile and keep its session on disk”.
- It supports Chrome channels and dedicated browser executables.
### Chrome/Chromium choice
- **Production/local usage:** prefer installed **Google Chrome stable** if available
- **Development/CI:** use **Chrome for Testing** or Playwright-managed browser
- YouTube/Instagram are consumer sites; branded Chrome usually gives the least compatibility friction.
- Chrome for Testing is great for reproducibility, but it is explicitly positioned for automation/testing use cases.
### SQLite
- Official SQLite guidance strongly favors SQLite for device-local, low-concurrency application storage.
- This app is single-user, local-first, and does not need a networked database.
### Secret storage
- optional app passphrase
- proxy credentials
- encrypted local config secrets
## What NOT to use
### Do not use embedded webviews for account login/browsing
- Electron `<webview>` for YouTube/Instagram auth surfaces
- BrowserView-heavy in-app browsing architecture
- custom embedded auth flows
- Electron explicitly warns that loading remote/untrusted content inside the app carries severe security risk.
- Electron says that if your goal is to display a website, **a browser is more secure**.
- Google blocks OAuth authorization in embedded webviews for security reasons.
### Do not use the user’s default Chrome profile
- Chrome 136 changed remote-debugging behavior for the default data directory.
- Playwright also warns against automating the main Chrome profile.
- Mixing your app with the user’s real browsing profile is a security and reliability footgun.
### Do not use Postgres / Redis / Docker in v1
- Zero product value for a single-user local tool
- More install friction
- More failure modes
- Harder roadmap for no meaningful gain
### Do not store sessions as exported JSON blobs in your own schema
- Incomplete compared to full browser profile state
- Easy to corrupt or desync
- Harder to support modern auth/session flows
### Do not choose Tauri first for this project
- You already need a browser sidecar/process strategy
- You already need deep local process/file orchestration
- Rust increases implementation complexity with limited user-facing benefit at this stage
## Legal / compliance constraints to design around
### High-confidence constraints
- **Do not build v1 around automated actions on YouTube.** YouTube Terms prohibit accessing the service using automated means without prior written permission, except limited stated cases.
- **Do not use embedded webviews for Google OAuth-style login flows.** Google officially blocks OAuth in embedded webviews.
- **Do not automate the user’s default Chrome profile.** Chrome now requires non-standard user data dirs for remote debugging protections.
### Practical product rule
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
## Sources
- Playwright BrowserType `launchPersistentContext` docs — HIGH  
- Electron docs (intro) — HIGH  
- Electron security guide — HIGH  
- Electron `safeStorage` docs — HIGH  
- Electron `protocol` docs — HIGH  
- Electron Forge docs — HIGH  
- Vite docs — HIGH  
- SQLite “Appropriate Uses For SQLite” — HIGH  
- Chrome remote debugging changes (Chrome 136) — HIGH  
- Chrome for Testing overview — MEDIUM  
- YouTube Terms of Service — HIGH  
- Google embedded webview OAuth policy blog — HIGH for Google auth flows  
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
