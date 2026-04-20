# Pulse MVP タスク分解

GitHub cross-repository dashboard (Tauri 2 + Rust + React + TypeScript).
標準スコープ: Inbox / PR一覧・詳細 / Issues一覧・詳細 / CI / 検索 / 設定 / Activity。

---

## マイルストーン構成

- **M1: プロジェクトセットアップと基盤** (17 tasks)
- **M2: 認証 (OAuth Device Flow + PAT)** (18 tasks)
- **M3: GitHubクライアント + キャッシュ層** (22 tasks)
- **M4: 共通UI + レイアウト + ルーティング** (19 tasks)
- **M5: PR 一覧 + 詳細 (diff含む)** (24 tasks)
- **M6: Issues 一覧 + 詳細** (17 tasks)
- **M7: Inbox + Activity + CI + 検索** (23 tasks)
- **M8: 仕上げ (設定 / ショートカット / 通知 / リリース)** (16 tasks)

**合計: 156 tasks**

---

## M1: プロジェクトセットアップと基盤

- [ ] M1-001 `pulse/` リポジトリ作成、`.gitignore` (Tauriテンプレート + `*.db` 追加) (15m)
- [ ] M1-002 `cargo create-tauri-app` で Tauri 2 + React + TS + Vite 構成で初期化 (30m)
- [x] M1-003 `package.json`: React 19 / TypeScript 5.x / Vite / Tailwind CSS v4 のバージョン固定 (15m)
- [x] M1-004 Tailwind CSS v4 導入、`index.css` に `@import "tailwindcss"` と design tokens (CSS variables) 定義 (45m)
- [ ] M1-005 `src/styles/tokens.css` にダークテーマ design tokens (--bg-primary, --accent-blue など全15色) を定義 (30m)
- [ ] M1-006 `Cargo.toml` にコア依存追加: tokio, reqwest, serde, serde_json, thiserror, anyhow (15m)
- [ ] M1-007 `Cargo.toml` に GitHub API 依存追加: octocrab, graphql_client (30m)
- [ ] M1-008 `Cargo.toml` にストレージ依存追加: rusqlite (bundled feature), r2d2, r2d2_sqlite (15m)
- [ ] M1-009 `Cargo.toml` に OS keychain 依存追加: keyring (15m)
- [ ] M1-010 `tauri.conf.json`: ウィンドウサイズ (1280x800) / 最小サイズ (960x600) / タイトル設定 (15m)
- [ ] M1-011 `tauri.conf.json`: allowlist を最小化 (http=false, fs=一部のみ) (30m)
- [ ] M1-012 `src/App.tsx` を空のダークテーマ画面に差し替え、起動確認 (15m)
- [ ] M1-013 ESLint + Prettier 導入、import order ルール設定 (30m)
- [ ] M1-014 `rustfmt.toml` + `clippy.toml` 追加、`cargo clippy` ゼロ警告状態に (30m)
- [ ] M1-015 GitHub Actions: `ci.yml` で macOS/Windows/Linux の build matrix (1h)
- [ ] M1-016 GitHub Actions: `fmt` / `clippy` / `tsc --noEmit` / `pnpm lint` の lint job 追加 (45m)
- [ ] M1-017 `README.md` のスタブ作成 (スクリーンショット・開発手順) (30m)

## M2: 認証 (OAuth Device Flow + PAT)

- [ ] M2-001 GitHub OAuth App を dev 用に作成、`scopes: repo, read:org, read:user, notifications, workflow` 確認 (30m)
- [ ] M2-002 `src-tauri/src/auth/mod.rs` 作成、認証方式の enum 定義 (`Method::DeviceFlow`, `Method::Pat`) (15m)
- [ ] M2-003 Device Flow: `POST /login/device/code` の型定義と呼び出し関数 (45m)
- [ ] M2-004 Device Flow: ポーリング関数 (`POST /login/oauth/access_token`) を interval + expires_in対応で実装 (1h)
- [ ] M2-005 Device Flow: `authorization_pending` / `slow_down` / `expired_token` エラーハンドリング (30m)
- [ ] M2-006 PAT 検証関数: `GET /user` を叩いて 200 なら有効、scopes ヘッダもパース (30m)
- [ ] M2-007 keyring に access token を保存する `save_token(account_id, token)` (30m)
- [ ] M2-008 keyring から token を読む `load_token(account_id) -> Option<String>` (15m)
- [ ] M2-009 keyring から token を削除する `delete_token(account_id)` (15m)
- [ ] M2-010 Tauri command: `cmd_start_device_flow() -> DeviceCode` (15m)
- [ ] M2-011 Tauri command: `cmd_poll_device_flow(device_code) -> AuthResult` (15m)
- [ ] M2-012 Tauri command: `cmd_save_pat(pat: String) -> Result<User>` (30m)
- [ ] M2-013 Tauri command: `cmd_logout() -> Result<()>` (15m)
- [ ] M2-014 React: `LoginPage.tsx` 骨組み (OAuth / PAT 切替タブ) (45m)
- [ ] M2-015 React: Device Flow 画面、user_code と verification_uri を大きく表示 + クリップボードコピー (1h)
- [ ] M2-016 React: Device Flow ポーリング進捗 UI (残り時間・ステータス) (45m)
- [ ] M2-017 React: PAT 入力フォーム、バリデーション + scopes 不足時のエラー表示 (45m)
- [ ] M2-018 起動時にkeyringを読んでログイン済みならメイン画面へ遷移 (30m)

## M3: GitHubクライアント + キャッシュ層

- [ ] M3-001 `src-tauri/src/github/client.rs`: reqwest ベースの HTTP client 構造体、User-Agent 設定 (30m)
- [ ] M3-002 `client.rs`: Authorization ヘッダを token から自動付与するミドルウェア (30m)
- [ ] M3-003 レート制限パーサ: `X-RateLimit-Remaining` / `X-RateLimit-Reset` を抽出 (30m)
- [ ] M3-004 `src-tauri/src/github/types.rs`: PullRequest / Issue / User / Repository / Review の最小 struct (1h)
- [ ] M3-005 `src-tauri/src/github/rest.rs`: `list_repos_for_authenticated_user()` (30m)
- [ ] M3-006 `rest.rs`: `list_pull_requests(owner, repo, state)` (ページング対応) (1h)
- [ ] M3-007 `rest.rs`: `list_issues(owner, repo, state, labels)` (1h)
- [ ] M3-008 `rest.rs`: `get_pull_request(owner, repo, number)` (30m)
- [ ] M3-009 `rest.rs`: `get_pull_request_files(owner, repo, number)` (30m)
- [ ] M3-010 `rest.rs`: `get_check_runs(owner, repo, ref)` (45m)
- [ ] M3-011 `rest.rs`: `list_notifications()` (45m)
- [ ] M3-012 `src-tauri/src/github/graphql/queries/inbox.graphql`: レビュー要求 + mention + 割り当てIssueを一括取得する query (1h)
- [ ] M3-013 `src-tauri/src/github/graphql.rs`: graphql_client で Rust 型生成、inbox query を呼ぶ関数 (1h)
- [ ] M3-014 `src-tauri/src/db/mod.rs`: SQLite 接続プール初期化、アプリデータディレクトリに `pulse.db` 作成 (30m)
- [ ] M3-015 `src-tauri/src/db/migrations.rs`: `v1_initial.sql` (accounts / repos / pulls / issues / checks / notifications) (1h)
- [ ] M3-016 `db/mod.rs`: migration runner 実装、起動時実行 (45m)
- [ ] M3-017 `src-tauri/src/cache/pulls.rs`: upsert_pull / get_pull / list_pulls_by_repo (1h)
- [ ] M3-018 `src-tauri/src/cache/issues.rs`: upsert_issue / list_issues_by_repo (45m)
- [ ] M3-019 `src-tauri/src/cache/meta.rs`: 最終 fetch 時刻 / ETag 管理 (45m)
- [ ] M3-020 `src-tauri/src/sync/poller.rs`: tokio::time::interval で 60s ポーリング (45m)
- [ ] M3-021 `sync/poller.rs`: レート不足時は次回まで skip、UI にイベント emit (`rate-limit-hit`) (45m)
- [ ] M3-022 Tauri command: `cmd_sync_now()` (手動同期、レート情報も返す) (30m)

## M4: 共通UI + レイアウト + ルーティング

- [ ] M4-001 `src/lib/router.tsx`: React Router か TanStack Router を導入、最低限のルート定義 (45m)
- [ ] M4-002 ルート定義: `/inbox` `/pulls` `/issues` `/pulls/:owner/:repo/:number` `/issues/:owner/:repo/:number` `/activity` `/settings` (30m)
- [ ] M4-003 `src/stores/authStore.ts`: Zustand で現在のアカウント / token 状態 (30m)
- [ ] M4-004 `src/stores/dataStore.ts`: Zustand で pulls / issues / notifications の in-memory store (45m)
- [ ] M4-005 `src/stores/uiStore.ts`: Zustand で selectedItem / sidebarCollapsed / commandPaletteOpen 状態 (30m)
- [ ] M4-006 `src/components/layout/AppShell.tsx`: 3カラム grid (220px / flex / flex) (30m)
- [ ] M4-007 `src/components/layout/Sidebar.tsx`: ワークスペースヘッダ + ナビリスト + ユーザーフッター (1h)
- [ ] M4-008 `Sidebar.tsx`: アクティブルートのハイライト + カウントバッジ (30m)
- [ ] M4-009 `src/components/common/Button.tsx`: primary / ghost / danger バリアント + shortcut chip (45m)
- [ ] M4-010 `src/components/common/Avatar.tsx`: グラデーション背景の iniital avatar、サイズ props (30m)
- [ ] M4-011 `src/components/common/StatusPill.tsx`: open / merged / closed / draft の状態 pill (30m)
- [ ] M4-012 `src/components/common/LabelPill.tsx`: color swatch + 背景色計算 (label.color HEX → 0.15 alpha) (45m)
- [ ] M4-013 `src/components/common/EmptyState.tsx`: icon + title + subtitle + actions の汎用空状態 (30m)
- [ ] M4-014 `src/components/common/Spinner.tsx` / `SpinnerLarge.tsx` (15m)
- [ ] M4-015 `src/components/common/Tabs.tsx`: ボトムボーダー型タブ + count バッジ (45m)
- [ ] M4-016 `src/components/common/Toolbar.tsx`: ページヘッダー共通 (title + actions) (30m)
- [ ] M4-017 `src/hooks/useKeyboardShortcut.ts`: グローバルショートカット登録 hook (45m)
- [ ] M4-018 `src/hooks/useListNavigation.ts`: J/K + Enter のリスト上下移動 hook (1h)
- [ ] M4-019 `useListNavigation` の選択項目を `scrollIntoView({block: 'nearest'})` する (30m)

## M5: PR 一覧 + 詳細 (diff含む)

- [ ] M5-001 `src/features/pulls/usePullsQuery.ts`: Zustand + Tauri command `cmd_list_pulls` 呼び出し (45m)
- [ ] M5-002 Tauri command: `cmd_list_pulls(filter: PullFilter) -> Vec<Pull>` キャッシュ優先 + バックグラウンド更新 (1h)
- [ ] M5-003 `src/pages/PullsPage.tsx`: タブ (Created / Assigned / Review / Mentioned / All) (45m)
- [ ] M5-004 `PullsPage.tsx`: フィルタチップ行 (state / repo / author / label) (1h)
- [ ] M5-005 `src/components/pulls/PullRow.tsx`: 8カラムテーブル行コンポーネント (1h)
- [ ] M5-006 `PullRow.tsx`: status dot (CI✓✗ / review R / draft D / merged M / mention @) 切替ロジック (1h)
- [ ] M5-007 `PullRow.tsx`: reviewer avatar group、approved/changes-requested の ring overlay (45m)
- [ ] M5-008 `PullRow.tsx`: relative time ("2h ago" / "3d ago") フォーマッタユーティリティ (30m)
- [ ] M5-009 `PullsPage.tsx`: @tanstack/react-virtual で行仮想化 (1h)
- [ ] M5-010 `PullsPage.tsx`: J/K navigation + Enter で詳細へ (30m)
- [ ] M5-011 `src/pages/PullDetailPage.tsx`: ブレッドクラム + タイトル + status row + branch info (45m)
- [ ] M5-012 `PullDetailPage.tsx`: Conversation / Commits / Checks / Files changed タブ骨組み (30m)
- [ ] M5-013 `src/components/pulls/CiBanner.tsx`: 失敗中CIの目立つバナー (45m)
- [ ] M5-014 `src/components/pulls/PrSummaryCard.tsx`: description + stats row (files / +/- / commits) (1h)
- [ ] M5-015 Tauri command: `cmd_get_pull_files(owner, repo, number) -> Vec<FileDiff>` (30m)
- [ ] M5-016 `src/components/pulls/FileDiff.tsx`: ファイルヘッダ (status icon / path / stats / viewed toggle) (45m)
- [ ] M5-017 `FileDiff.tsx`: patch文字列を unified diff 表示用の行配列にパース (1.5h)
- [ ] M5-018 `FileDiff.tsx`: diff-row の add/del/context スタイリング + ガター表示 (1h)
- [ ] M5-019 `FileDiff.tsx`: ファイル折り畳み (クリックで開閉、`▶`/`▼` 切替) (30m)
- [ ] M5-020 `FileDiff.tsx`: Viewed チェックボックスで進捗を localStorage に保存 (30m)
- [ ] M5-021 Unified / Split 表示切替 toggle (split はカラム2分割) (1.5h)
- [ ] M5-022 `src/components/pulls/PrSidebar.tsx`: reviewers / assignees / labels / milestone / linked issues / checks (1.5h)
- [ ] M5-023 `src/components/pulls/PrFooterBar.tsx`: Merge / Approve / Request changes / Open in editor (45m)
- [ ] M5-024 "Open in editor" で `code --goto path:line` を Tauri shell 経由実行 (設定の editor に応じて分岐) (45m)

## M6: Issues 一覧 + 詳細

- [ ] M6-001 `src/features/issues/useIssuesQuery.ts`: Tauri command `cmd_list_issues(filter)` (30m)
- [ ] M6-002 Tauri command: `cmd_list_issues(filter: IssueFilter) -> Vec<Issue>` (45m)
- [ ] M6-003 `src/pages/IssuesPage.tsx`: 3カラム (sidebar / filter / list) の grid レイアウト (45m)
- [ ] M6-004 `src/components/issues/FilterSidebar.tsx`: State / Labels / Assignee / Repository / Milestone セクション (1.5h)
- [ ] M6-005 `FilterSidebar.tsx`: ラベルチェックボックス (color swatch + カウント) (1h)
- [ ] M6-006 `FilterSidebar.tsx`: 複数選択の状態管理、uiStore.issueFilters に反映 (45m)
- [ ] M6-007 `src/components/issues/AppliedFilters.tsx`: 適用中フィルタを chip で表示、× で削除 (45m)
- [ ] M6-008 `src/components/issues/IssueRow.tsx`: open/closed status dot + number + タイトル + inline labels + meta (1h)
- [ ] M6-009 `IssueRow.tsx`: assignee avatar stack (重ね表示) (30m)
- [ ] M6-010 `IssuesPage.tsx`: J/K navigation + Enter で詳細へ (30m)
- [ ] M6-011 `src/pages/IssueDetailPage.tsx`: ブレッドクラム + タイトル + status + 3カラムレイアウト (1h)
- [ ] M6-012 Tauri command: `cmd_get_issue(owner, repo, number) -> Issue` (30m)
- [ ] M6-013 Tauri command: `cmd_list_issue_comments(owner, repo, number) -> Vec<Comment>` (30m)
- [ ] M6-014 `src/components/issues/IssueOriginalPost.tsx`: 発行者コメントカード、badge (Author), markdown 本文 (1h)
- [ ] M6-015 `src/components/markdown/MarkdownRenderer.tsx`: react-markdown + remark-gfm + syntax highlight (1h)
- [ ] M6-016 `src/components/issues/CommentThread.tsx`: コメントカードリスト、badge 切替 (Author/Collaborator/Maintainer) (1h)
- [ ] M6-017 `src/components/issues/IssueSidebar.tsx`: assignees / labels / milestone (progress bar) / linked PRs / participants / 購読状態 (1.5h)

## M7: Inbox + Activity + CI + 検索

- [ ] M7-001 Tauri command: `cmd_get_inbox() -> InboxData` (GraphQL inbox query + ローカル集計) (1h)
- [ ] M7-002 `src/pages/InboxPage.tsx`: 3ペイン骨組み (45m)
- [ ] M7-003 `src/components/inbox/InboxList.tsx`: Review requests / CI failing / Mentions のセクション分け (1h)
- [ ] M7-004 `InboxList.tsx`: 空状態処理 ("You're all caught up") (15m)
- [ ] M7-005 `src/components/inbox/InboxItem.tsx`: repo / タイトル / meta / unread dot (45m)
- [ ] M7-006 `src/components/inbox/InboxDetailPanel.tsx`: 選択項目のプレビュー (30m)
- [ ] M7-007 `src/pages/ActivityPage.tsx`: タブ (All / Unread / Participating / Mentions / Review requests) (45m)
- [ ] M7-008 `ActivityPage.tsx`: サブフィルタ (All types / PRs / Issues / Comments / CI / Releases) (30m)
- [ ] M7-009 `src/components/activity/ActivityRow.tsx`: icon (8種) + headline + meta + preview + time (1h)
- [ ] M7-010 ActivityRow: 時間グルーピング (Today / Yesterday / This Week / Older) (45m)
- [ ] M7-011 unread 状態をローカル DB で管理、クリックで既読化 (45m)
- [ ] M7-012 "Mark all as read" アクション (Tauri command + DB 一括更新) (30m)
- [ ] M7-013 `src/pages/CiStatusPage.tsx`: 監視対象 repo 全体の workflow run 一覧 (1h)
- [ ] M7-014 `src/components/ci/WorkflowRunRow.tsx`: status (✓/✗/●) + workflow 名 + branch + duration (45m)
- [ ] M7-015 Tauri command: `cmd_get_workflow_runs(owner, repo, branch) -> Vec<WorkflowRun>` (45m)
- [ ] M7-016 失敗した run のログを取得 (`GET /repos/.../actions/runs/:id/logs`) 、外部ビューア起動 (1h)
- [ ] M7-017 `src/components/command/CommandPalette.tsx`: ⌘K で開くモーダル、検索入力 + 結果リスト (1.5h)
- [ ] M7-018 CommandPalette: ナビゲーションコマンド (Go to Inbox / Pulls / Issues など) (30m)
- [ ] M7-019 CommandPalette: ローカル検索 (in-memory store から PR / Issue 名を fuzzy match) (1h)
- [ ] M7-020 CommandPalette: GitHub REST 検索 (`GET /search/issues`) 結果の追加表示 (1h)
- [ ] M7-021 CommandPalette: ↑↓ ナビ + Enter 選択 + Esc 閉じる (30m)
- [ ] M7-022 `src/components/workspace/WorkspaceSwitcher.tsx`: モーダル UI (Accounts / Recent workspaces) (1h)
- [ ] M7-023 アカウント切替で authStore + dataStore リセット、再フェッチ (45m)

## M8: 仕上げ (設定 / ショートカット / 通知 / リリース)

- [ ] M8-001 `src/pages/SettingsPage.tsx`: Accounts / Repositories / Notifications / Appearance / Shortcuts / About タブ (1h)
- [ ] M8-002 Settings: Accounts タブで複数アカウント追加・削除 UI (1h)
- [ ] M8-003 Settings: Repositories タブで watch 対象の追加・削除 (45m)
- [ ] M8-004 Settings: Notifications タブでポーリング間隔 (30s / 60s / 5min / Off) 変更 (30m)
- [ ] M8-005 Settings: Shortcuts タブで全ショートカット一覧表示 + カスタマイズ (1h)
- [ ] M8-006 Settings: About タブ (version / licenses / GitHub API レート情報) (30m)
- [ ] M8-007 OS通知: CI 失敗 / レビュー要求時に Tauri notification 発火、`on_click` で該当画面へ (1h)
- [ ] M8-008 OS通知: 設定でオン/オフ切替、macOS は通知許可リクエスト (45m)
- [ ] M8-009 Dock/Taskbar バッジ: 未読数を表示 (Tauri tray + badge) (45m)
- [ ] M8-010 エラー境界: `ErrorBoundary.tsx` + 全ページ包囲、エラーログを DB にも残す (45m)
- [ ] M8-011 オフライン検知: `window.navigator.onLine` + Tauri ping、offline state を uiStore に反映 (45m)
- [ ] M8-012 アプリアイコン作成 (1024x1024 png → tauri-icon で各サイズ生成) (1h)
- [ ] M8-013 `tauri.conf.json`: bundle 設定 (identifier / publisher / copyright) (30m)
- [ ] M8-014 macOS: code signing + notarization 設定、GH Actions secret 追加 (1.5h)
- [ ] M8-015 GH Actions: `release.yml` で tag push 時に macOS/Windows の dmg/msi/exe をビルド + リリース添付 (1.5h)
- [ ] M8-016 `CHANGELOG.md` 作成、v0.1.0 リリースノート (30m)

---

## 所要時間まとめ

| マイルストーン | タスク数 | 概算時間 |
|---|---|---|
| M1: セットアップ | 17 | ~8h |
| M2: 認証 | 18 | ~9h |
| M3: GitHub + キャッシュ | 22 | ~15h |
| M4: 共通UI + レイアウト | 19 | ~11h |
| M5: PR一覧 + 詳細 | 24 | ~19h |
| M6: Issues一覧 + 詳細 | 17 | ~13h |
| M7: Inbox + Activity + CI + 検索 | 23 | ~17h |
| M8: 仕上げ + リリース | 16 | ~13h |
| **合計** | **156** | **~105h** |

週10h投下で約10-11週、週20hなら5-6週でv0.1.0到達の見込み。