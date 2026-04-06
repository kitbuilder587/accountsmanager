# Roadmap: Accounts Manager

## Overview

Accounts Manager v1 should prove one thing end to end: a single user can create isolated local browser profiles for YouTube and Instagram, reopen the right account fast, and keep sessions between launches without drifting into automation or anti-detect scope.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Managed Profile Foundation** - Create and maintain app-owned profiles with stable identity and dedicated storage.
- [ ] **Phase 2: Isolated Launch & Session Persistence** - Deliver the core loop of launching and reopening isolated browser sessions.
- [ ] **Phase 3: Admin Dashboard & Profile Lifecycle** - Make daily profile management usable from one screen with safe archive/delete actions.

## Phase Details

### Phase 1: Managed Profile Foundation
**Goal**: Users can create and maintain managed profiles that clearly map to a YouTube or Instagram account and always own a dedicated browser profile directory.
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):
  1. User can create a managed profile for a YouTube or Instagram account.
  2. User can assign and later edit the platform, account label, and note for a managed profile.
  3. Each managed profile is stored as its own distinct app-managed profile with a dedicated browser profile directory.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Isolated Launch & Session Persistence
**Goal**: Users can launch any managed profile into its own isolated browser session and come back to the same signed-in state later.
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User can launch an existing managed profile into an isolated browser session.
  2. User can close and relaunch the same managed profile later without recreating it.
  3. User can stay signed in across launches because the profile keeps its cookies, local storage, and related session state.
  4. User never sees session data from one managed profile reused by another profile.
**Plans**: TBD

### Phase 3: Admin Dashboard & Profile Lifecycle
**Goal**: Users can manage all profiles from one admin screen, quickly launch the right one, and safely archive or delete profiles.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, LIFE-01, LIFE-02
**Success Criteria** (what must be TRUE):
  1. User can view all managed profiles in one admin screen with platform, account label, optional note, and last used time.
  2. User can filter the profile list by platform and launch a profile from the list in one click.
  3. User can see the latest launch result or basic health state for each profile.
  4. User can archive a managed profile without immediately deleting its local data.
  5. User can permanently delete a managed profile only through an explicit destructive action.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Managed Profile Foundation | 3/3 | Complete | 2026-04-06 |
| 2. Isolated Launch & Session Persistence | 0/TBD | Not started | - |
| 3. Admin Dashboard & Profile Lifecycle | 0/TBD | Not started | - |
