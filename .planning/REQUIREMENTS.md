# Requirements: Accounts Manager

**Defined:** 2026-04-06
**Core Value:** Я могу быстро открыть нужный аккаунт в уже готовом изолированном браузерном профиле без повторного логина.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Profiles

- [x] **PROF-01**: User can create a managed profile for a YouTube or Instagram account.
- [x] **PROF-02**: User can set a platform and account label for each managed profile.
- [x] **PROF-03**: Each managed profile is assigned its own dedicated browser profile directory.
- [x] **PROF-04**: User can edit the label and note for an existing managed profile.

### Sessions

- [ ] **SESS-01**: User can launch a managed profile in an isolated browser session.
- [ ] **SESS-02**: Browser cookies, local storage, and other session state persist between launches of the same managed profile.
- [ ] **SESS-03**: Launching one managed profile does not reuse session state from another managed profile.
- [ ] **SESS-04**: User can relaunch an existing managed profile from the app without re-creating it.

### Dashboard

- [ ] **DASH-01**: User can view all managed profiles in one admin screen.
- [ ] **DASH-02**: User can see each profile's platform, account label, optional note, and last used time in the profile list.
- [ ] **DASH-03**: User can filter the profile list by platform.
- [ ] **DASH-04**: User can launch a profile from the profile list in one click.
- [ ] **DASH-05**: User can see the last launch result or current basic health state for each profile.

### Lifecycle

- [ ] **LIFE-01**: User can archive a managed profile without immediately deleting its local data.
- [ ] **LIFE-02**: User can permanently delete a managed profile through an explicit destructive action.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### UX Enhancements

- **UX-01**: User can create a profile through an account-centric setup wizard with sensible defaults.
- **UX-02**: User can see whether a profile likely needs re-login before launching it.
- **UX-03**: User can see an account preview card after successful login.
- **UX-04**: User can open a profile directly on a common destination URL such as YouTube Studio or Instagram inbox.
- **UX-05**: User can batch launch selected profiles.

### Data Protection

- **DATA-01**: User can create a backup snapshot of a managed profile.
- **DATA-02**: User can restore a managed profile from a backup snapshot.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Team collaboration, roles, permissions | Product is a personal local admin tool for one user |
| Anti-detect fingerprint customization | Not required for the core session-isolation value and adds major risk/complexity |
| Built-in proxies or proxy marketplace | Not needed for v1 personal workflow validation |
| Automation, botting, scraping, posting, or APIs | Product scope is manual account management, not automation |
| Support for platforms beyond YouTube and Instagram in v1 | Initial scope should stay narrow and testable |
| Importing the user's existing personal Chrome profile in v1 | High migration risk and conflicts with app-owned profile isolation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 1 | Complete |
| PROF-02 | Phase 1 | Complete |
| PROF-03 | Phase 1 | Complete |
| PROF-04 | Phase 1 | Complete |
| SESS-01 | Phase 2 | Pending |
| SESS-02 | Phase 2 | Pending |
| SESS-03 | Phase 2 | Pending |
| SESS-04 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| LIFE-01 | Phase 3 | Pending |
| LIFE-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
