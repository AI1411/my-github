# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pulse** — GitHub cross-repository dashboard desktop application.
View-only in v0.1.0 (read PRs, Issues, CI, Notifications across multiple repos). Write operations open browser via ⌘K.

Full requirements: `docs/requirments.md` | Task breakdown: `docs/tasks.md`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Backend | Rust 1.82+ (reqwest + tokio, octocrab, graphql_client) |
| Local DB | SQLite (rusqlite + r2d2) |
| Token Storage | keyring crate (OS keychain) |
| Frontend | React 19 + TypeScript 5.x |
| Build | Vite |
| Styling | Tailwind CSS v4 (dark theme only in v0.1) |
| State | Zustand (3 stores: auth / data / ui) |
| Routing | TanStack Router |

## Architecture

```
React (UI) ↔ Tauri IPC Commands ↔ Rust Core
                                    ├─ auth    (OAuth Device Flow + PAT + keyring)
                                    ├─ github  (REST via octocrab, GraphQL via graphql_client)
                                    ├─ cache   (SQLite + ETag, stale-while-revalidate)
                                    └─ sync    (60s poller, 5m when unfocused)
```

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
- **No write ops in v0.1**: All mutations open GitHub in browser
- **macOS + Windows** binaries; Linux in v0.2
- **Performance targets**: <800ms startup (cached), <200MB idle memory, <30MB dmg

## PR Review Prefixes

From `.github/PULL_REQUEST_TEMPLATE.md`:
- `[must]` — 必須対応
- `[imo]` — 提案・意見
- `[nits]` — 軽微な指摘
- `[ask]` — 質問
- `[fyi]` — 情報共有のみ
