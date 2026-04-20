# Pulse

GitHub cross-repository dashboard desktop app. View PRs, Issues, CI, and Notifications across multiple repos in one window.

## Tech Stack

- **Framework:** Tauri 2
- **Frontend:** React 19 + TypeScript 5 + Vite
- **Backend:** Rust (reqwest + tokio, octocrab)
- **DB:** SQLite (rusqlite + r2d2)
- **Styling:** Tailwind CSS v4 (dark theme)
- **Package Manager:** pnpm

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
