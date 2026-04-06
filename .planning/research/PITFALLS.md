# Domain Pitfalls

**Domain:** Personal admin app for isolated browser profiles and persisted sessions
**Researched:** 2026-04-06
**Overall confidence:** MEDIUM-HIGH

## How to Use This File

Treat the first four pitfalls as roadmap-shaping risks. If they are handled late, the project usually needs painful rewrites.

Suggested roadmap phase topics used below:

1. **Profile model & isolation contract**
2. **Browser launcher & lifecycle management**
3. **Secure local storage & secrets handling**
4. **Admin UX, labeling, and recovery flows**
5. **Compliance, policy, and hardening**

## Critical Pitfalls

### 1. Fake isolation (profiles share real state)
**What goes wrong:** The app says profiles are isolated, but cookies, localStorage, downloads, permissions, or cache leak between accounts.

**Why it happens:** Teams think “new tab/context” is enough. For this product, isolation must be at the browser profile / user data directory boundary, not just UI-level separation.

**Consequences:** Wrong account opens, accidental cross-posting, platform risk signals, user loses trust immediately.

**Warning signs:**
- Logging into account A changes login state in account B
- Shared downloads/history/extensions across profiles
- Reusing one browser process or one default profile for many accounts
- No explicit mapping from account → dedicated userDataDir

**Prevention strategy:**
- Make `profile_id -> dedicated userDataDir` a hard invariant in Phase 1
- Launch each persistent profile with its own non-default data directory
- Treat cookies, storage, downloads, permissions, and extensions as profile-scoped assets
- Add an automated verification check: login in one profile must not appear in another

**Phase to address:** Phase 1, reinforced in Phase 2

### 2. Using the user’s normal Chrome profile or reusing a live profile unsafely
**What goes wrong:** The app points automation/debugging at the user’s everyday Chrome profile or attaches to it in unsupported ways.

**Why it happens:** It seems convenient because the session is already there.

**Consequences:** Browser instability, pages failing to load, corrupted state, security regressions, brittle behavior across Chrome updates.

**Warning signs:**
- Product relies on “use my existing Chrome session” as a core flow
- The launcher targets Chrome’s default “User Data” directory
- Multiple app-managed launches touch the same profile directory concurrently

**Prevention strategy:**
- Always create app-owned profile directories; never depend on the default Chrome profile
- Enforce one active browser instance per profile directory with file/app locks
- Add graceful “profile already running” UX instead of forcing a second launch
- Prefer a dedicated browser/runtime strategy over piggybacking on the user’s main browser state

**Phase to address:** Phase 2

### 3. Storing sessions as if they were ordinary app data
**What goes wrong:** Session-bearing files, cookies, local storage exports, or auth tokens are stored in plaintext or copied into the app DB “for convenience”.

**Why it happens:** Teams treat browser session persistence as generic persistence.

**Consequences:** Local compromise becomes full account takeover; backups and logs become sensitive; deletion becomes hard.

**Warning signs:**
- Session dumps in JSON/SQLite visible in app storage
- “Export/import profile” planned before threat model exists
- Debug logs contain cookies, headers, or local storage values
- No distinction between metadata and secrets

**Prevention strategy:**
- Minimize what the app stores directly: keep profile metadata in DB, browser state in profile dir
- Encrypt app-managed secrets at rest using OS keychain/secure storage where possible
- Never log cookies, auth headers, OAuth tokens, or raw profile paths with account-identifying details
- Add redaction everywhere: logs, crash reports, diagnostics, support bundles
- Define deletion semantics early: “delete profile” must wipe browser state and app metadata

**Phase to address:** Phase 3

### 4. No recovery path when a session expires or gets challenged
**What goes wrong:** Product assumes sessions live forever. Real platforms trigger re-login, 2FA, suspicious-login checks, captcha, or device verification.

**Why it happens:** Teams optimize only for the happy path: “launch and it works”.

**Consequences:** Product feels broken the first time a session expires; user cannot tell whether the profile is healthy or needs manual action.

**Warning signs:**
- No profile health states beyond “exists”
- No UX for “needs re-authentication”
- Failures surface as generic browser launch errors
- Product promise says “never log in again”

**Prevention strategy:**
- Model profile state explicitly: `healthy`, `needs_login`, `challenge_detected`, `launch_failed`, `locked`
- Design a manual recovery flow: open profile, let user re-auth in-browser, then mark recovered
- Keep the product promise honest: “reduces relogins”, not “eliminates authentication forever”
- Instrument challenge detection and surface last successful launch/login timestamps

**Phase to address:** Phase 4

### 5. Building a stealth/anti-detection product by accident
**What goes wrong:** The implementation drifts from “profile manager” into “evade platform detection”, e.g. fingerprint spoofing, hidden automation, or mass-account operational features.

**Why it happens:** Isolation problems are mistaken for anti-detection problems.

**Consequences:** Compliance risk, platform bans, unstable product direction, unnecessary engineering complexity.

**Warning signs:**
- Requests for fingerprint spoofing, captcha bypass, hidden automation, or bulk action flows
- Product language shifts to “warm up accounts”, “avoid detection”, “farm accounts”
- Architecture assumes rotating proxies before core profile management works

**Prevention strategy:**
- Keep v1 scope strict: manual launch + isolated sessions only
- Explicitly reject botting, scraping, posting automation, and stealth features from roadmap
- Add product guardrails in docs and UX copy so the app is clearly a personal launcher, not an abuse tool

**Phase to address:** Phase 5

## Moderate Pitfalls

### 6. Weak profile identity and labeling
**What goes wrong:** User cannot confidently tell which profile belongs to which platform/account.

**Consequences:** Wrong launches and accidental actions in the wrong account.

**Warning signs:**
- Profiles named “Profile 1”, “Profile 2”
- No platform badge, username, avatar, or last-used metadata

**Prevention strategy:**
- Store explicit metadata: platform, handle, display name, notes, last launch, health state
- Show strong visual identity and a confirmation affordance before first launch after edits

**Phase to address:** Phase 4

### 7. Concurrency and profile corruption
**What goes wrong:** The same profile is launched twice or app shutdown leaves orphaned browser processes and dirty state.

**Consequences:** Profile lock errors, corrupted browser data, mysterious launch failures.

**Warning signs:**
- Double-click launch causes two processes
- Force quit leaves profile unusable until manual cleanup
- No PID/session tracking per launched profile

**Prevention strategy:**
- Add per-profile lock management and tracked process ownership
- Build idempotent launch/close actions
- On startup, reconcile stale locks and dead processes carefully

**Phase to address:** Phase 2

### 8. Hidden coupling to one browser engine/version
**What goes wrong:** The app silently depends on one Chromium version, one OS behavior, or unsupported flags.

**Consequences:** Breaks after browser updates; hard-to-reproduce bugs across machines.

**Warning signs:**
- Reliance on undocumented flags or default-profile debugging behavior
- No compatibility policy for browser/runtime upgrades
- Production tied to “works on my Mac” assumptions

**Prevention strategy:**
- Choose a supported runtime strategy early and document it
- Minimize custom flags
- Add smoke tests for profile create / relaunch / persisted login across app restarts

**Phase to address:** Phase 2, reviewed in Phase 5

### 9. Backups and sync turn into silent data exfiltration
**What goes wrong:** Profile directories end up in cloud sync, Time Machine, generic backup zips, or support archives without clear consent.

**Consequences:** Session-bearing data spreads to places the user did not intend.

**Warning signs:**
- Profile storage lives in a synced folder by default
- “Export logs” includes profile files
- Backup story is undocumented

**Prevention strategy:**
- Store profiles in an app-controlled local path by default
- Exclude profile contents from diagnostics/export unless explicitly requested
- Document backup risk clearly; separate metadata backup from session backup

**Phase to address:** Phase 3

### 10. No audit trail for destructive actions
**What goes wrong:** A profile is renamed, reset, or deleted and the user cannot understand what happened.

**Consequences:** Data loss feels random; trust drops.

**Warning signs:**
- Delete is immediate and irreversible
- No “last launched / last modified / last login refresh” timestamps

**Prevention strategy:**
- Add lightweight local audit metadata for key actions
- Soft-delete metadata first when feasible; confirm destructive actions clearly
- Show recent activity per profile

**Phase to address:** Phase 4

## Security & Compliance Pitfalls

### 11. Collecting or persisting platform credentials directly
**What goes wrong:** The app asks for YouTube/Instagram usernames/passwords or stores them locally to “help relogin”.

**Consequences:** Massive security liability and avoidable compliance risk.

**Warning signs:**
- Login form inside the app for third-party platform credentials
- “Remember password” requirement in spec

**Prevention strategy:**
- Never collect platform passwords in your own forms
- Recovery must happen in the real browser profile, on the platform’s own login pages
- If API integrations are ever added, use official OAuth flows and scope them minimally

**Phase to address:** Phase 5

### 12. No privacy policy / deletion story once APIs are added
**What goes wrong:** A “personal tool” later grows YouTube API features but still lacks consent, revocation, deletion, and data-retention rules.

**Consequences:** Compliance debt appears suddenly and blocks shipping those features.

**Warning signs:**
- Plan mentions channel metadata/API data storage without retention rules
- No user-facing delete-data or revoke-access flow

**Prevention strategy:**
- Keep v1 browser-only unless APIs are truly needed
- If APIs are added, plan privacy policy, consent UX, token revocation, and delete-data flows as first-class work
- Separate browser profile storage from API-derived app data in the design

**Phase to address:** Phase 5

### 13. Over-broad diagnostics and telemetry
**What goes wrong:** Error reports capture URLs, cookies, storage blobs, or screenshots containing private account data.

**Consequences:** Security leak from your own observability stack.

**Warning signs:**
- “Send full browser log” support flow
- Automatic screenshot-on-error without redaction
- Central telemetry includes profile paths or account handles unnecessarily

**Prevention strategy:**
- Default to local-only logs for v1
- Make diagnostics opt-in and aggressively redact sensitive values
- Treat screenshots and HAR/network traces as sensitive artifacts requiring explicit consent

**Phase to address:** Phase 3, finalized in Phase 5

## Minor Pitfalls

### 14. Promise/UX mismatch
**What goes wrong:** Marketing says “one click forever” but real behavior still requires occasional reauth and manual fixes.

**Prevention strategy:**
- Sell convenience, not magic
- Surface profile health honestly in UI

**Phase to address:** Phase 4

### 15. Premature platform expansion
**What goes wrong:** Team adds many services before stabilizing YouTube + Instagram profile handling.

**Prevention strategy:**
- Prove the profile/session abstraction on two platforms first
- Add a platform adapter boundary before adding more services

**Phase to address:** Phase 1

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Profile model & isolation contract | “Profile” is only a DB row, not a true isolated browser state boundary | Make dedicated userDataDir the core invariant and test it early |
| Browser launcher & lifecycle | Reusing default Chrome profile; duplicate launches; unsupported flags | Use app-owned profile dirs, lock per profile, keep launch strategy boring |
| Secure local storage & secrets handling | Session data leaks via logs, backups, exports, plaintext files | Redact aggressively, minimize stored secrets, define wipe/delete semantics |
| Admin UX, labeling, and recovery flows | User launches wrong account or cannot recover expired sessions | Strong labels, profile health states, manual reauth flow |
| Compliance, policy, and hardening | Scope drifts toward credential capture, stealth, or ungoverned API use | Keep v1 browser-only/manual; add privacy + revocation + deletion before API features |

## Roadmap Flags

- **Must research/decide early:** browser runtime strategy, profile directory layout, per-profile locking, local secret handling
- **Must design before polish:** session-expiry recovery flow, destructive-action confirmations, delete/wipe semantics
- **Defer on purpose:** API integrations, telemetry backend, profile export/import, multi-platform expansion beyond YouTube/Instagram

## Sources

- Chromium user data directory docs — official reference for profile storage structure and dedicated user data dirs. HIGH confidence. https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md
- Playwright `launchPersistentContext` docs — persistent contexts use a user data dir and do not allow multiple instances with the same directory; warns against automating the default Chrome profile. HIGH confidence. https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
- Chrome for Developers: remote debugging switch changes (2025-03-17) — Chrome now requires non-standard `--user-data-dir` for remote debugging against non-default data dirs, reinforcing “don’t use the real default profile” guidance. HIGH confidence. https://developer.chrome.com/blog/remote-debugging-port
- OWASP Session Management Cheat Sheet — session tokens are effectively authentication material and persistent browser storage expands exposure if compromised. HIGH confidence. https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- YouTube API Services Developer Policies — relevant if API features are later added: no collection of YouTube login credentials, consent/revocation/deletion/privacy obligations, retention constraints for stored API data. HIGH confidence. https://developers.google.com/youtube/terms/developer-policies

## Confidence Notes

- **HIGH:** Browser profile isolation, persistent-context constraints, secret-handling principles, YouTube API compliance claims
- **MEDIUM:** Instagram/platform-enforcement implications for multi-account behavior, because direct official Meta sources were not successfully fetched in this pass
- **LOW:** None of the major recommendations rely only on unverified community sources
