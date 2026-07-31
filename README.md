# my-github

> GitHub cross-repository dashboard desktop app — view PRs, Issues, CI status, and Notifications across multiple repos in one keyboard-driven window.

<!-- Screenshot placeholder — add after first UI milestone -->
<!--
![my-github screenshot](docs/screenshots/my-github-inbox.png)
-->

## Features (v0.1.0)

- **Inbox-first** — Review requests, CI failures, and mentions in one view
- **Multi-account** — Switch between personal and work accounts (⌘T)
- **Keyboard-native** — J/K navigation, ⌘K command palette
- **View-only** — All write ops open GitHub in browser (no accidental merges)
- **Dark theme** — macOS + Windows binaries

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.82+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | latest | `npm install -g pnpm` |
| Tauri CLI | 2.x | included via `pnpm tauri` |

**macOS only:** Xcode Command Line Tools (`xcode-select --install`)

**Linux only:**

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Backend | Rust 1.82+ (reqwest + tokio, octocrab, graphql_client) |
| Local DB | SQLite (rusqlite + r2d2) |
| Token Storage | keyring (OS keychain) |
| Frontend | React 19 + TypeScript 5.x |
| Build | Vite |
| Styling | Tailwind CSS v4 (dark theme) |
| State | Zustand |
| Routing | TanStack Router |

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (hot reload for frontend + Rust rebuild on save)
pnpm tauri dev
```

Sign in with a GitHub Personal Access Token (PAT).

## Build

```bash
# Production binary (output: src-tauri/target/release/bundle/)
pnpm tauri build
```

## Lint & Format

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings

# TypeScript / Frontend
pnpm exec tsc --noEmit
pnpm lint
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
