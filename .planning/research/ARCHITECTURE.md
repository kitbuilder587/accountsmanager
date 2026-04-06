# Architecture Patterns

**Domain:** Personal desktop admin app for managing isolated browser profiles for YouTube and Instagram
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH

## Recommended Architecture

Build this as a **local-first desktop app with a thin app shell and a separate browser-profile runtime layer**.

**Recommended shape:**

1. **Desktop shell**: Electron app for native windowing, filesystem access, OS integration, secure IPC.
2. **Renderer UI**: local SPA for profile list, create/edit flows, launch actions, health/status.
3. **Application core** (main process): profile registry, launch orchestration, storage policy, locking, logs.
4. **Persistent profile store** (filesystem): one directory per managed browser profile.
5. **Metadata store** (SQLite): account labels, platform, profile path, timestamps, health flags, settings.
6. **Browser runtime manager**: launches Chromium-based browser instances with a **dedicated non-default user data directory per profile**.

That separation matters: **metadata is your app's truth; browser session state is Chromium's truth**. Do not try to copy cookies/localStorage into your own database as the primary session mechanism.

## Why this structure

- The product's core value is **persistent isolated sessions**. Chromium profile directories already implement that better than a custom session model.
- Electron gives direct control over app lifecycle and storage locations. Its docs explicitly expose per-app `userData` / `sessionData`, and per-session isolation via `session.fromPartition(...)` / `session.fromPath(...)`.
- Playwright's `launchPersistentContext(userDataDir)` docs confirm that a browser can run against a dedicated user data directory and that **multiple instances cannot use the same user data dir simultaneously**. That drives your locking model.
- Chrome's 2025 security change also reinforces the rule: if automation/debugging is involved, use a **non-standard user data dir**, not the user's default Chrome profile.

## Recommended Architecture Diagram

```text
Renderer UI (React/Vue/Svelte)
        |
        | typed IPC only
        v
Electron Main Process / App Core
  - profile service
  - launch service
  - storage service
  - lock manager
  - audit/logging
        |
        +--> SQLite metadata DB
        |
        +--> Secure config store (OS-backed where possible)
        |
        +--> Profile filesystem root/
               profiles/
                 youtube-account-a/
                 instagram-account-b/
        |
        +--> Browser runtime manager
               - spawn Chromium/Chrome for Testing
               - one process per opened profile
               - one userDataDir per profile
```

## Component Boundaries

| Component | Responsibility | Communicates With | Must NOT Own |
|-----------|---------------|-------------------|--------------|
| Renderer UI | Show profiles, forms, statuses, launch controls | Main process via IPC | Direct filesystem writes, direct browser launching |
| IPC boundary | Typed request/response and events | Renderer ↔ Main | Business logic |
| Profile Registry Service | CRUD for managed profiles and account labels | SQLite, storage service | Browser cookies/session internals |
| Launch Orchestrator | Open/close browser profile, enforce single-writer locks, pass launch args | Runtime manager, registry, lock manager | UI state |
| Storage Service | Resolve app paths, create profile dirs, backups/import/export | Filesystem, Electron app paths | Platform account semantics |
| Metadata Store | Structured app data | Registry, UI queries | Large binary/session blobs |
| Profile Filesystem Store | Actual Chromium session persistence: cookies, localStorage, IndexedDB, cache, service workers | Browser runtime only | Human-edited metadata |
| Secure Secrets/Settings Store | Encrypt app secrets if later needed (proxy creds, optional master settings) | Main process only | Browser session cookies as app records |
| Browser Runtime Manager | Start Chromium with dedicated userDataDir; observe exits/crashes | Launch orchestrator | Business metadata |
| Platform Adapters | URL presets, health checks, profile naming helpers for YouTube/Instagram | Registry, launch orchestrator | Generic storage/runtime logic |

## Data Flow

### Normal flow: create profile

```text
UI form submit
  -> IPC createProfile(command)
  -> Profile Registry validates name/platform
  -> Storage Service creates empty profile directory
  -> Metadata Store inserts profile record
  -> UI refreshes from queryProfileList()
```

### Normal flow: launch profile

```text
User clicks Launch
  -> UI sends launchProfile(profileId)
  -> Launch Orchestrator loads metadata
  -> Lock Manager checks "already running?"
  -> Runtime Manager starts Chromium with that profile's dedicated userDataDir
  -> Browser uses existing cookies/localStorage from disk
  -> Main process emits running/open/error state back to UI
```

### Normal flow: close profile

```text
Browser exits
  -> Runtime Manager receives process exit
  -> Launch Orchestrator clears lock and updates last-opened / status
  -> UI receives status event
```

### Important direction rule

**All writes should flow through main process services.** Renderer reads/writes nothing directly except transient UI state.

## Storage and Session Isolation Implications

## 1) Isolation unit = one browser profile directory per managed account

For this app, the correct isolation boundary is:

```text
1 managed account = 1 dedicated Chromium userDataDir
```

Not:

- one shared browser profile with tabs
- one app-level cookie jar
- one SQLite row containing exported cookies

Those shortcuts break the core promise.

## 2) Separate app metadata from browser state

Use two storage classes:

- **SQLite / app DB** for profile metadata
- **Filesystem profile directory** for session persistence

Example layout:

```text
app-data/
  app.db
  logs/
  profiles/
    prof_001/
      browser-user-data/
    prof_002/
      browser-user-data/
  backups/
```

## 3) Never target the user's default Chrome profile

Official Playwright docs warn against pointing `userDataDir` at the user's main Chrome data directory, and Chrome's 2025 security note says remote debugging switches are no longer respected for the default data dir without a non-standard `--user-data-dir`.

Implication: **managed profiles must live under your app's own storage root**.

## 4) One running process per profile dir

Playwright docs state browsers do not allow multiple instances with the same user data directory.

Implication:

- add a per-profile runtime lock
- show "already open" in UI
- focus existing window/process instead of launching duplicates later

## 5) Cache is part of the isolation story

Electron docs note that `sessionData` can contain cookies, localStorage, disk cache, dictionaries, network state.

Implication: if you embed browsing inside Electron sessions, cache and other web storage belong inside the same isolation boundary. If you launch external Chromium profiles, keep all profile storage under the dedicated per-profile directory.

## 6) Encrypt app secrets, not Chromium internals

Electron `safeStorage` is appropriate for small app secrets/settings, but not for replacing Chromium's own persistent profile storage.

Use it only for:

- optional proxy credentials
- optional encrypted export passwords
- future sensitive app preferences

## Patterns to Follow

### Pattern 1: Main-process orchestration
**What:** All browser lifecycle and storage operations run in Electron main process.
**When:** Always.
**Why:** Prevents UI from becoming an untrusted god-object and keeps filesystem/process control in one place.

### Pattern 2: Profile-as-directory
**What:** Treat profile directory creation/deletion/backup as first-class domain operations.
**When:** From day one.
**Why:** The filesystem artifact is the real session container.

### Pattern 3: Platform adapter over hardcoding
**What:** Keep YouTube/Instagram specifics in small adapters: start URLs, icon/title heuristics, lightweight health checks.
**When:** Once launching works.
**Why:** Makes adding future platforms cheap without polluting core runtime logic.

### Pattern 4: Runtime lock table
**What:** Track open profiles in memory, keyed by profileId and profile path.
**When:** Before multi-window polish.
**Why:** Prevents corruption and weird UX from duplicate launches.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding all account browsing inside one Electron session
**Why bad:** Shared cookies/cache/session leakage risk.
**Instead:** One partition/path or, better for this product, one dedicated external Chromium profile directory per managed account.

### Anti-Pattern 2: Treating cookies as app data
**Why bad:** Fragile, browser-version-sensitive, and easy to corrupt.
**Instead:** Let Chromium own session persistence inside the profile directory.

### Anti-Pattern 3: Launching against real personal Chrome profiles
**Why bad:** Security/policy problems and nondeterministic behavior.
**Instead:** App-owned non-default profile roots only.

### Anti-Pattern 4: Tight coupling between UI rows and on-disk folder names
**Why bad:** Renames become destructive.
**Instead:** Stable internal profile IDs mapped to display names.

## Suggested Build Order

## Phase 1: Core storage skeleton

Build first:

- Electron shell
- typed IPC
- app path resolution
- SQLite metadata store
- profile directory creation

**Reason:** Everything else depends on stable identifiers and filesystem layout.

## Phase 2: Browser launch runtime

Build next:

- Chromium/Chrome-for-Testing launcher
- per-profile `userDataDir`
- process tracking
- runtime lock manager
- open/close status events

**Reason:** This is the product's core value loop.

## Phase 3: Basic admin UI

Build after runtime works:

- create profile form
- list view
- launch button
- status badges
- last opened/error display

**Reason:** UI should sit on top of proven storage + launching, not invent them.

## Phase 4: Platform adapters

Add:

- YouTube preset
- Instagram preset
- default start URLs
- icon/label helpers
- lightweight "session still valid?" checks

**Reason:** Platform logic should be thin and replaceable.

## Phase 5: Safety and lifecycle

Add:

- graceful shutdown handling
- backup/export/import of profile dirs
- delete/archive profile flows
- crash recovery markers

**Reason:** Important for trust, but not required to validate the core workflow.

## Phase 6: Nice-to-have local features

Later only:

- tags/groups
- proxy-per-profile
- quick launcher / tray
- window restore
- analytics/history

## Build-Order Implications for Roadmap

1. **Do not start with account-specific UI polish.** First prove: create isolated directory -> launch browser -> reopen with session preserved.
2. **Locking is not optional.** Because one user data directory cannot safely back multiple simultaneous launches.
3. **Metadata schema should stabilize early.** Renames, deletions, backup/export all depend on it.
4. **Support YouTube/Instagram through adapters, not forks.** Core architecture should remain platform-agnostic.
5. **Backup/export is easier if profile directories are app-owned from day one.**

## Minimal v1 System Contract

If you keep v1 disciplined, the architecture contract is:

- one desktop window
- one local SQLite DB
- one app-owned root directory for managed profiles
- one dedicated Chromium user data dir per account
- one runtime lock per profile
- no cloud sync
- no shared multi-user model

That is enough to ship and validate the core promise.

## Scalability Considerations

| Concern | At ~10 profiles | At ~100 profiles | At ~1000 profiles |
|---------|-----------------|------------------|-------------------|
| Metadata queries | trivial in SQLite | still trivial with indexes | still manageable locally |
| Disk usage | modest | noticeable because browser caches accumulate | needs cleanup/archive strategy |
| Launch orchestration | simple in-memory locks | add better status recovery | add stronger process supervision |
| UI complexity | list view enough | search/filter needed | grouping/archive essential |
| Backups | manual ok | selective export needed | full snapshot UX becomes expensive |

## Opinionated Recommendation

Use **Electron + SQLite + app-owned per-profile Chromium user data directories**.

Do **not** start with Tauri, a custom cookie/session model, or embedded multi-account tabs in one browser session. Those are attractive shortcuts, but for this product they increase risk exactly where the product must be strongest: **session persistence and isolation**.

## Sources

- Electron `session` docs — persistent sessions via `session.fromPartition('persist:...')` and `session.fromPath(...)`: https://www.electronjs.org/docs/latest/api/session **(HIGH)**
- Electron `app` docs — `userData` / `sessionData` paths and storage location implications: https://www.electronjs.org/docs/latest/api/app **(HIGH)**
- Electron `safeStorage` docs — OS-backed encryption semantics and Linux caveat: https://www.electronjs.org/docs/latest/api/safe-storage **(HIGH)**
- Playwright `launchPersistentContext(userDataDir)` docs — persistent storage, dedicated user data dirs, no multiple instances per dir: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context **(HIGH)**
- Chrome for Developers blog (2025-03-17) — remote debugging changes require non-standard `--user-data-dir` for default-profile protection: https://developer.chrome.com/blog/remote-debugging-port **(HIGH)**
