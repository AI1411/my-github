# Sync Engine Redesign Design

Date: 2026-04-30

## Purpose

Pulse is now broad enough that data freshness is becoming a product and maintenance risk. Pull requests, issues, inbox, CI, and notifications all depend on GitHub state, but the current implementation spreads refresh behavior across individual commands and page-specific flows. This makes failures hard to diagnose and makes future features more likely to duplicate API, cache, and rate-limit logic.

This design focuses on internal quality first: consolidate synchronization into a backend Sync Engine while preserving the existing cache-first UI behavior.

## Current State

The current backend already has useful pieces:

- SQLite cache tables for `accounts`, `repos`, `pulls`, `issues`, `checks`, `notifications`, and `sync_meta`.
- REST and GraphQL GitHub client helpers.
- Page commands such as `cmd_list_pulls` and `cmd_list_issues` that return cached rows immediately.
- A poller abstraction that can emit rate-limit events.

The main architectural gap is ownership. `cmd_sync_now` currently returns a rate-limit snapshot but does not own the actual data sync. PR and Issue list commands spawn their own background refresh tasks and query watched repositories directly. This gives the UI useful stale-while-revalidate behavior, but it makes synchronization implicit and hard to test as a complete workflow.

## Goals

- Make `sync` the single backend owner of GitHub data refresh.
- Keep UI reads cache-first and fast.
- Preserve partial success: if one repository or resource fails, successful steps still update cache.
- Record enough structured status to explain sync outcomes without reading logs.
- Keep Phase 1 small enough to ship safely: repositories, pulls, and issues only.

## Non-Goals

- No write operations to GitHub.
- No UI redesign in Phase 1.
- No webhooks, background daemon, or push-based sync.
- No AI summarization.
- No full replacement of Inbox, Activity, CI, or Notifications sync in Phase 1.

## Proposed Architecture

Add a backend Sync Engine under `src-tauri/src/sync/`:

```text
sync/
  engine.rs       SyncEngine entry point and orchestration
  types.rs        SyncScope, SyncReport, SyncStepReport, SyncStatus
  repos.rs        repository/account seeding and watched repo loading
  pulls.rs        pull request sync for watched repos
  issues.rs       issue sync for watched repos
  status.rs       sync_meta persistence and status reads
  poller.rs       existing poller, later wired to SyncEngine
```

Commands become thin adapters:

```text
cmd_sync_now()
  -> SyncEngine::sync_now([Repositories, Pulls, Issues])
  -> persists cache and sync status
  -> returns SyncReport

cmd_get_sync_status()
  -> reads latest SyncStatus from sync_meta/cache

cmd_list_pulls(filter)
  -> reads cached pulls only
  -> schedules SyncEngine pull sync during Phase 1 compatibility transition

cmd_list_issues(filter)
  -> reads cached issues only
  -> schedules SyncEngine issue sync during Phase 1 compatibility transition
```

## Core Types

`SyncScope` identifies units of work:

```rust
pub enum SyncScope {
    Repositories,
    Pulls,
    Issues,
}
```

`SyncReport` is returned by manual sync and can also be persisted:

```rust
pub struct SyncReport {
    pub started_at_epoch: u64,
    pub finished_at_epoch: u64,
    pub rate_limit: Option<RateLimitInfo>,
    pub steps: Vec<SyncStepReport>,
}
```

`SyncStepReport` captures partial success:

```rust
pub struct SyncStepReport {
    pub scope: SyncScope,
    pub status: SyncStepStatus, // success | partial | skipped | failed
    pub repos_seen: usize,
    pub items_written: usize,
    pub errors: Vec<SyncErrorSummary>,
}
```

Errors are summarized for status and diagnostics without storing tokens or full payloads:

```rust
pub struct SyncErrorSummary {
    pub repo: Option<String>,
    pub operation: String,
    pub message: String,
}
```

## Data Flow

### Manual Sync

1. `cmd_sync_now` loads the active account and token.
2. Sync Engine validates that a signed-in account exists.
3. `sync_repositories` fetches `/user/repos`, upserts `accounts` and `repos`, and preserves existing `is_watched` choices.
4. `sync_pulls` loads watched repos, fetches open PRs, and upserts `pulls`.
5. `sync_issues` loads watched repos, fetches open issues, and upserts `issues`.
6. Sync Engine fetches rate-limit status when possible.
7. Sync Engine persists a compact report in `sync_meta`.
8. Command returns the full `SyncReport` to the UI.

### Cached Reads

Page commands continue to read from SQLite first. They must not duplicate repository discovery, API pagination, or error aggregation. In Phase 1, `cmd_list_pulls` and `cmd_list_issues` keep their existing automatic background refresh behavior for compatibility, but the refresh must call Sync Engine. Pages re-read cache after the existing `pulls-updated` or `issues-updated` events.

## Status Persistence

Use existing `sync_meta` in Phase 1 instead of adding a migration:

- `sync:last_started_at`
- `sync:last_finished_at`
- `sync:last_status`
- `sync:last_report_json`
- `sync:last_rate_limit_json`

This is intentionally coarse. If later UI needs repo-level history, add a dedicated `sync_runs` / `sync_step_runs` schema in a later phase.

## Error Handling

The engine should distinguish:

- Missing active account or token: fail fast.
- Unauthorized token: fail fast and expose an auth-specific error.
- Rate limit exhausted: skip GitHub work and return a skipped report with rate-limit data.
- Per-repo API failure: record an error for that repo and continue with the next repo.
- Cache write failure: record the write failure; continue only when the failure is local to one item.

No sync path should silently ignore an upsert failure. If a best-effort write is intentionally ignored, the reason must appear in the step report.

## Transition Plan

Phase 1 should avoid a large rewrite:

1. Add Sync Engine types and status persistence.
2. Move repository loading/upsert helpers into sync-owned modules.
3. Move PR and Issue refresh logic from `commands/pulls.rs` and `commands/issues.rs` into `sync/pulls.rs` and `sync/issues.rs`.
4. Update `cmd_sync_now` to run repositories, pulls, and issues.
5. Keep `cmd_list_pulls` and `cmd_list_issues` cache-first; any background refresh they trigger must call Sync Engine.
6. Add `cmd_get_sync_status` for diagnostics and future UI.

Phase 2 can add notifications, inbox, and CI to the same engine. Phase 3 can wire polling, backoff, and rate-limit gating exclusively through the engine.

## Testing Strategy

Backend tests should cover:

- `SyncReport` serialization.
- Repository upsert preserves `is_watched`.
- Pull and issue sync continue after one repo-level API failure.
- `cmd_sync_now` writes sync status even when a step partially fails.
- `cmd_get_sync_status` returns a useful empty state before the first sync.
- Existing cached read filters still work after refresh logic moves out.

Avoid live GitHub tests in normal CI. Use pure helpers and mocked boundaries for unit tests. Any live token/API checks should remain ignored/manual.

Frontend tests in Phase 1 are minimal because UI behavior should not change. If `cmd_get_sync_status` is surfaced later, test loading, success, partial, and auth-failed states.

## Acceptance Criteria

- `cmd_sync_now` performs repository, pull, and issue sync, not just rate-limit lookup.
- PR and Issue background refresh paths call Sync Engine instead of owning GitHub API loops.
- Sync status is persisted in `sync_meta` after each manual sync.
- Partial failures are represented in `SyncReport`.
- Existing tests for PR/Issue cached reads still pass.
- No tokens or raw secrets are stored in `sync_meta`, test output, or logs.

## Phase 1 Decision

`cmd_list_pulls` and `cmd_list_issues` will keep automatic background refresh in Phase 1 to avoid changing frontend behavior. The implementation must route that refresh through Sync Engine. A later UI-focused phase can make refresh controls more explicit once sync status is visible to users.
