# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**my-github** — GitHub cross-repository dashboard desktop application.
View and act on PRs, Issues, CI, and Notifications across multiple repos in v0.1.0. Common write operations (reviews, merges, issue updates) run in-app via Tauri IPC; ⌘K still opens GitHub for everything else.

Full requirements: `docs/requirments.md` | Task breakdown: `docs/tasks.md`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Backend | Rust 1.82+ (reqwest + tokio, octocrab, graphql_client) |
| Local DB | SQLite (rusqlite + r2d2) |
| Token Storage | keyring crate (OS keychain; PAT) |
| Frontend | React 19 + TypeScript 5.x |
| Build | Vite |
| Styling | Tailwind CSS v4 (dark theme only in v0.1) |
| State | Zustand (3 stores: auth / data / ui) |
| Routing | TanStack Router |

## Architecture

```
React (UI) ↔ Tauri IPC Commands ↔ Rust Core
                                    ├─ auth    (PAT + keyring)
                                    ├─ github  (REST via octocrab, GraphQL via graphql_client)
                                    ├─ cache   (SQLite + ETag, stale-while-revalidate)
                                    └─ sync    (on-demand via IPC; no background poller in Rust)
```

**Sync / polling**: The React shell owns periodic sync (`useNotificationPolling`, focus/resume `cmd_sync_now`). Rust exposes `sync::poller::spawn_poller` for tests only; `run()` does **not** start a backend poller — starting one would double-poll alongside the frontend timer.

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

This project uses mandatory subagent-driven development. Custom agents are in `.Codex/agents/`:

1. **backend-explorer** — Explore Rust code before changes
2. **backend-code-reviewer** — Review after implementation
3. **backend-test-runner** — Run & verify tests
4. **backend-quality-manager** — Final quality gate

Custom skills in `.Codex/skills/`: `commit`, `create-pr`, `create-issue`, `execute-issue`, `code-review`

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

## Cursor Cloud specific instructions

This is a Tauri 2 desktop app (Rust backend + React/Vite frontend). The Cloud VM base
snapshot already has the toolchains and system libraries below; the startup update script
only refreshes JS deps (`pnpm install --frozen-lockfile`). Standard commands are in
`README.md` / `Taskfile.yml` / `package.json`. Notes below are the non-obvious gotchas.

### Toolchain / system deps (baked into the base image)
- Rust: **stable ≥ 1.85 is required** even though README says 1.82+. A transitive Linux dep
  (`dlopen2_derive`) needs the `edition2024` cargo feature. Use `rustup default stable`.
- Linux build needs these apt packages (for `webkit2gtk`, tray icon, and OpenSSL):
  `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev libssl-dev pkg-config`. If `cargo build`
  fails with a missing `webkit2gtk-4.1` or `openssl` pkg-config error, reinstall these.

### Frontend gotchas
- `pnpm typecheck` invokes `tsgo` (`@typescript/native-preview`), which is **not declared in
  `package.json`** and is absent on the VM. Use `pnpm exec tsc --noEmit` for typechecking
  (documented in `README.md`); `typescript` is installed and passes clean.
- `pnpm test` (vitest): all 247 tests pass, but the run currently **exits non-zero** because
  `AppShell` registers Tauri event listeners (`@tauri-apps/api` `listen` / notification retry
  loop) that reject in jsdom after teardown (`window.__TAURI_INTERNALS__` is undefined). These
  are unhandled-rejection "Errors", not test failures — treat 247/247 passing as success.
- `pnpm build` and `pnpm dev` (Vite) both work; Vite dev server runs on **port 1430**
  (not 1420 as in `.env.example`/README). `pnpm approve-builds` (esbuild) can be skipped —
  esbuild works via its platform optional-dep binary.

### Running the desktop app on Linux (v0.1 targets macOS/Windows; Linux is unofficial)
- A display is available at `DISPLAY=:1`. Launch with software rendering for the container:
  `DISPLAY=:1 WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 pnpm tauri dev`.
  Run it as a long-lived process (tmux); it starts Vite then the Rust webview window.
- In a plain browser (not the Tauri webview) the app still loads but every `invoke()` fails,
  so it falls back to the `LoginPage`. Use `pnpm tauri dev` to exercise the Rust backend.

### Auth / tokens
- **Debug builds do NOT use the OS keyring.** The token store writes a plaintext file at
  `${XDG_DATA_HOME:-~/.local/share}/my-github-dev/tokens.json` (see `auth/token_store.rs`).
  Delete that file to reset login state.
- PAT login (`cmd_save_pat`) requires a classic token with scopes `repo, read:user,
  notifications`, OR a fine-grained token (empty `X-OAuth-Scopes` header passes). The injected
  `GH_TOKEN` secret is validated by GitHub (HTTP 200) but only has `repo` scope, so it reaches
  the "Insufficient scopes" screen rather than the authenticated dashboard.
