# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**my-github** — GitHub cross-repository dashboard desktop application.
View and act on PRs, Issues, CI, and Notifications across multiple repos in v0.1.0. Common write operations (reviews, merges, issue updates) run in-app via Tauri IPC; ⌘K still opens GitHub for everything else.

Full requirements: `docs/requirments.md` | Task breakdown: `docs/tasks.md`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Backend | Rust stable ≥ 1.85 (reqwest + tokio, graphql_client) |
| Local DB | SQLite (rusqlite + r2d2) |
| Token Storage | keyring crate (OS keychain; PAT) |
| Frontend | React 19 + TypeScript 5.x |
| Build | Vite |
| Styling | Tailwind CSS v4 (dark theme only in v0.1) |
| State | Zustand (3 stores: auth / data / ui) |
| Routing | react-router-dom |

## Architecture

```
React (UI) ↔ Tauri IPC Commands ↔ Rust Core
                                    ├─ auth    (PAT + keyring)
                                    ├─ github  (REST via octocrab, GraphQL via graphql_client)
                                    ├─ cache   (SQLite + ETag, stale-while-revalidate)
                                    └─ sync    (on-demand via IPC; no background poller in Rust)
```

**Sync / polling**: The React shell owns periodic sync (`useNotificationPolling`, focus/resume `cmd_sync_now`). Rust exposes `sync::poller::spawn_poller` for tests only; `run()` does **not** start a backend poller.

**Cache strategy**: Return cached data immediately, revalidate in background. Pause polling at 25% rate limit remaining.

**SQLite schema**: `accounts`, `repos`, `pulls`, `issues`, `checks`, `notifications`, `sync_meta` — all include `raw_json` for forward compatibility.

## Build Commands

> Project scaffolding is in M1 (not yet complete). Standard Tauri 2 commands expected:

```bash
# Development
pnpm tauri dev

# Build release binary
pnpm tauri build

# Frontend only
pnpm dev

# Rust tests
cargo test

# Rust lint
cargo clippy -- -D warnings
cargo fmt --check
```

## Development Workflow

This project uses mandatory subagent-driven development. Custom agents are in `.claude/agents/`:

1. **backend-explorer** — Explore Rust code before changes
2. **backend-code-reviewer** — Review after implementation
3. **backend-test-runner** — Run & verify tests
4. **backend-quality-manager** — Final quality gate

Custom skills in `.claude/skills/`: `commit`, `create-pr`, `create-issue`, `execute-issue`, `code-review`

## Key Design Decisions

- **Multi-account**: Switch accounts (personal + work) with ⌘T
- **Inbox-first layout**: Review requests / CI failing / Mentions
- **Keyboard-native**: J/K navigation, ⌘-based shortcuts (Raycast/Linear aesthetic)
- **In-app writes in v0.1**: Reviews, merges, issue state updates, and related mutations go through Rust IPC (with a client write queue); use ⌘K to open GitHub for actions not implemented in-app
- **macOS + Windows** binaries; Linux in v0.2
- **Performance targets**: <800ms startup (cached), <200MB idle memory, <30MB dmg

## PR Review Prefixes

From `.github/PULL_REQUEST_TEMPLATE.md`:
- `[must]` — 必須対応
- `[imo]` — 提案・意見
- `[nits]` — 軽微な指摘
- `[ask]` — 質問
- `[fyi]` — 情報共有のみ
