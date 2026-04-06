# Project Research Summary

**Project:** Accounts Manager
**Domain:** Local-first desktop app for isolated browser profile and session management
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

Accounts Manager is not a SaaS admin panel and not an automation tool. It is a local desktop launcher for one user who needs fast, repeatable access to multiple YouTube and Instagram accounts through truly isolated browser profiles with persistent sessions. The research is consistent: experts solve this with app-owned Chromium profile directories, not with exported cookies, shared tabs, embedded webviews, or reuse of the user’s default Chrome profile.

The recommended v1 approach is opinionated: use Electron + React + TypeScript for the shell/UI, SQLite for metadata, and Playwright persistent contexts to launch one dedicated browser `userDataDir` per account. The app should own only metadata, status, and orchestration; Chromium should own cookies, localStorage, IndexedDB, cache, and session state. That gives the simplest path to the core value in PROJECT.md: reopen the right account without relogin.

The main risks are fake isolation, unsafe reuse of the default Chrome profile, session-data leakage, and weak recovery when sessions expire. Mitigation is also clear: make `profile_id -> dedicated userDataDir` a hard invariant early, enforce one running process per profile, keep logs/exports free of sensitive session data, and design profile health + manual reauth flows before polishing UX.

## Key Findings

### Recommended Stack

Use a boring, mainstream desktop stack with strong official-documentation support. Electron is the right shell because this product is mostly filesystem control, process orchestration, and secure local boundaries. Playwright is the right browser runtime because persistent contexts directly match the product’s session model.

**Core technologies:**
- **Electron + Electron Forge**: desktop shell and packaging — best fit for Node-powered process/filesystem control.
- **React 19 + TypeScript 5 + Vite**: renderer UI — fast iteration with typed IPC contracts.
- **Playwright persistent contexts**: browser launch/runtime — first-class support for per-profile persistent sessions.
- **Google Chrome stable preferred; managed Chromium/Chrome for Testing fallback**: runtime compatibility — pragmatic choice for consumer sites.
- **SQLite + better-sqlite3 + Drizzle**: local metadata storage — simple, local-first, zero-admin persistence.
- **Electron safeStorage**: app secrets only — use OS-backed encryption for small secrets, not browser session internals.
- **Zod / Zustand / Pino / Vitest / Playwright Test**: validation, state, logs, testing — sensible defaults, replaceable if needed.

**Critical version guidance:** Electron/Forge latest stable, React 19.x, TypeScript 5.x, Vite 8.x, Playwright latest stable 1.x.

### Expected Features

v1 should be narrow and practical: create a profile, label it clearly, launch it, keep its session alive between launches, and reopen it quickly from one dashboard. Competitor research shows many adjacent features, but most belong to agency-grade anti-detect tools and should not drive this roadmap.

**Must have (table stakes):**
- Create one isolated browser profile per account.
- Launch each profile with a persistent isolated session.
- Preserve cookies/local storage/session state between launches.
- Show a profile list with platform, account label, note, and last used.
- Quick relaunch from the dashboard.
- Basic status/health visibility.
- Safe archive/delete flow.

**Should have (competitive, but not core v1):**
- Account-centric setup wizard.
- Session freshness / needs-login indicators.
- Account preview card.
- Direct shortcuts to common URLs.
- Batch launch of selected profiles.
- Backup/restore snapshots.

**Defer (v2+ / explicitly out of scope):**
- Teams, roles, sharing.
- Anti-detect fingerprint controls.
- Built-in proxies / proxy marketplace.
- Automation, botting, scraping, posting flows, APIs.
- Deep CRM/foldering.
- Multi-platform expansion beyond YouTube + Instagram.
- Importing existing personal Chrome profiles in v1.

### Architecture Approach

The architecture should be local-first and split into three truths: renderer for UI only, Electron main process for orchestration, and Chromium profile directories for actual session persistence. SQLite stores metadata such as labels, platform, profile path, timestamps, and health flags. The browser profile directory stores cookies, localStorage, IndexedDB, cache, service workers, and other session artifacts.

**Major components:**
1. **Renderer UI** — profile list, create/edit flows, launch controls, health display.
2. **Typed IPC boundary** — strict request/response channel between UI and privileged logic.
3. **App core in Electron main** — profile registry, launch orchestration, path resolution, logging, locks.
4. **SQLite metadata store** — stable IDs, labels, platform, timestamps, health state.
5. **Profile filesystem store** — one app-owned browser `userDataDir` per account.
6. **Browser runtime manager** — start/stop Chromium/Chrome with one process per profile.
7. **Platform adapters** — thin YouTube/Instagram presets, start URLs, heuristics, health helpers.

### Critical Pitfalls

1. **Fake isolation** — avoid shared tabs/contexts; enforce one dedicated `userDataDir` per account from Phase 1 and test cross-profile separation early.
2. **Using the user’s default Chrome profile** — never attach to the real personal profile; keep all managed profiles under app-owned storage.
3. **Treating sessions as normal app data** — do not export/store cookies and auth state in SQLite or logs; keep browser state in the profile directory and redact aggressively.
4. **No recovery path for expired sessions** — model states like `healthy`, `needs_login`, `challenge_detected`, `launch_failed`, `locked` and support manual in-browser recovery.
5. **Accidentally becoming a stealth/automation tool** — reject fingerprint spoofing, botting, proxy-first scope, and credential capture from the roadmap.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Storage, IDs, IPC, Isolation Contract
**Rationale:** Everything depends on stable profile identity and an app-owned directory layout.
**Delivers:** Electron shell, preload/typed IPC, app storage paths, SQLite schema, profile registry, profile directory creation.
**Addresses:** create profile, platform tagging, metadata, clear profile/account mapping.
**Avoids:** fake isolation, weak identity, premature platform sprawl.

### Phase 2: Core Value Loop — Browser Launch Runtime
**Rationale:** This is the product. Prove create profile -> launch browser -> reopen with persisted session before UI polish.
**Delivers:** Playwright persistent launch, per-profile `userDataDir`, process tracking, lock manager, open/close/error events, “already running” behavior.
**Uses:** Electron main process, Playwright, Chrome/Chromium strategy.
**Implements:** launch orchestrator, runtime manager, lock table.
**Avoids:** default-profile misuse, duplicate launches, corruption, browser-version fragility.

### Phase 3: Usable Admin UI — Dashboard and Lifecycle Basics
**Rationale:** Once runtime works, the UI can safely reflect real system state instead of inventing it.
**Delivers:** profile list, create/edit form, launch/relaunch button, filters by platform, notes, last used, last launch result, archive/delete flow.
**Addresses:** profile list, quick reopen, basic metadata, safe lifecycle management.
**Avoids:** weak labeling, destructive-action confusion, poor day-to-day usability.

### Phase 4: Recovery and Platform-Specific UX
**Rationale:** Session expiry is inevitable; this phase turns a working launcher into a trustworthy tool.
**Delivers:** health states, manual reauth flow, YouTube/Instagram adapters, destination URL shortcuts, lightweight session-freshness indicators.
**Addresses:** basic health/status visibility and good v1.1 differentiators.
**Avoids:** promise/UX mismatch and “app feels broken” when reauth is needed.

### Phase 5: Safety, Hardening, and Optional Data Protection
**Rationale:** Harden before expansion, backups, or any adjacent features.
**Delivers:** safeStorage for app secrets, redacted local logging, stale-lock recovery, graceful shutdown, explicit wipe/delete semantics, backup/export design guardrails.
**Addresses:** trust, diagnostics, secure local handling.
**Avoids:** session leaks via logs/exports, orphaned processes, silent data exfiltration.

### Phase Ordering Rationale

- Isolation and storage invariants must exist before launch logic, because launch semantics depend on one profile = one directory.
- Launch/runtime comes before polished UI because persisted-session relaunch is the core product risk.
- Recovery comes after the happy path but before scope expansion, because expired sessions are guaranteed in real use.
- Hardening should complete before import/export, APIs, proxies, or other scope-expanding work.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** browser runtime strategy on macOS packaging/distribution, Chrome-vs-Chromium fallback policy, and stale-lock reconciliation details.
- **Phase 4:** session challenge detection heuristics for YouTube/Instagram, especially Instagram where official source quality is weaker.
- **Phase 5:** backup/export semantics and privacy-safe diagnostics boundaries.

Phases with standard patterns (can likely skip research-phase):
- **Phase 1:** Electron shell, typed IPC, SQLite schema, app-owned storage layout are well-documented.
- **Phase 3:** standard local CRUD/list UI on top of stable services.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices are backed by official Electron, Playwright, Chrome, and SQLite docs. |
| Features | MEDIUM | Strong ecosystem pattern match, but source set is mostly competitor marketing pages. |
| Architecture | HIGH | Separation of metadata vs browser state is strongly supported by official platform/runtime docs. |
| Pitfalls | MEDIUM-HIGH | Top risks are backed by official browser/security guidance; Instagram-specific enforcement details are less verified. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Instagram policy/enforcement specifics:** treat any future automation-like behavior as needing phase-specific research and legal review.
- **Packaging/runtime policy:** validate exactly how Chrome stable vs bundled/browser-managed runtime should work in shipped builds.
- **Session health detection:** define conservative heuristics; do not overpromise automatic validity checks.
- **Backup/export UX:** decide early whether v1 excludes session-bearing exports entirely or supports explicit, user-consented snapshots only.

## Sources

### Primary (HIGH confidence)
- Playwright `launchPersistentContext` docs — persistent profile directories, no shared-instance-per-dir.
- Electron docs (`app`, `session`, `safeStorage`, security guide) — privileged boundaries, storage locations, secrets handling.
- SQLite “Appropriate Uses” — validates local-first metadata storage.
- Chrome remote debugging change note (Chrome 136) — reinforces non-default profile requirement.
- Chromium user data dir docs — confirms profile directory model.
- OWASP Session Management Cheat Sheet — supports handling session artifacts as sensitive auth material.
- YouTube Terms / YouTube developer policies — scope/compliance guardrails.

### Secondary (MEDIUM confidence)
- Chrome for Testing overview — informs dev/CI runtime strategy.
- Multilogin, GoLogin, SessionBox, Incogniton, AdsPower marketing/docs — repeated feature patterns and table stakes.

### Tertiary (LOW confidence)
- None required for the core recommendation.

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
