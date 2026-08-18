# my-github 要件定義書

GitHub 横断ダッシュボード デスクトップアプリ。
自分用の実装指針書。v0.1.0 MVP 相当。

---

## 1. 目的

複数の GitHub リポジトリにまたがる PR / Issue / CI 状態を1つのウィンドウで把握する。
ブラウザを何度も開きに行く手間をなくす。キーボード中心で高速に捌く。

---

## 2. 想定ユーザーと利用シーン

- 利用者: 自分 (AI1411)
- 利用頻度: 日中常駐、1日数十回フォーカス
- 主な利用シーン:
    - 朝イチで Inbox を開き、寝ている間に来たレビュー要求・CI失敗・mention を片付ける
    - PR を書いた後、CI 通過とレビュー到着を受動的に待つ
    - 自分が watch しているリポジトリの issue 発生を見逃さない
    - 複数アカウント (個人 / 業務委託先) を切り替えて使う

---

## 3. スコープ

### v0.1.0 (MVP)

- **含む**: Inbox / PR一覧・詳細 (diff込) / Issue一覧・詳細 / CI状態 / Activity / 設定 / ⌘K / 複数アカウント / PAT / ダークテーマ / macOS + Windows ビルド
- **除外**: PR作成、コメント投稿、マージ・クローズ操作 (view only)、Enterprise GHES、Linuxビルド、ライトテーマ、モバイル対応、プラグイン、webhooks、AI機能

### 将来拡張候補 (v0.2+)

- コメント投稿 / レビュー提出 / マージ操作
- GitHub Enterprise Server
- ライトテーマ、カスタムカラー
- ローカル LLM による PR要約
- Linux ビルド (AppImage / deb)

---

## 4. 非目標

- GitHub の完全代替ではない。Web UIでしかできないことは "Open in browser" で任せる
- Jira / Linear などの issue tracker 統合はしない (GitHub Issues のみ)
- 自動化ボット的な振る舞いはしない (CI failed → 自動 close など)

---

## 5. 技術スタック

| レイヤ | 採用 | 理由 |
|---|---|---|
| フレームワーク | Tauri 2 | FastCsv で採用済、配布が楽 |
| バックエンド言語 | Rust 1.82+ | 静的型、keychain連携容易 |
| HTTP client | reqwest + tokio | 標準、async前提 |
| GitHub API (ライト) | octocrab (REST) | PR/Issue基本操作、workflow runs |
| GitHub API (インボックス系) | graphql_client (GraphQL v4) | 1リクエストで横断取得、rate効率 |
| ローカルDB | SQLite (rusqlite + r2d2) | 既知、ファイル1つで済む |
| トークン保管 | keyring crate | OS keychain連携 |
| フロントエンド | React 19 + TypeScript 5.x | 既知の組み合わせ |
| ビルド | Vite | 高速、Tauriデフォルト |
| スタイル | Tailwind CSS v4 | FastCsvと統一 |
| 状態管理 | Zustand | 軽量、3store (auth/data/ui) |
| ルーティング | TanStack Router | 型安全 |
| 仮想スクロール | @tanstack/react-virtual | FastCsv と統一 |
| Markdown | react-markdown + remark-gfm | Issue本文描画 |
| シンタックスハイライト | shiki (or prism-react-renderer) | diff / codeブロック |

---

## 6. アーキテクチャ

```
┌──────────────────────────────────────────────┐
│ React (UI Shell)                             │
│  ├─ Sidebar / Routing                        │
│  ├─ Inbox / Pulls / Issues / Activity / CI   │
│  └─ Settings / CommandPalette / Switcher     │
└──────────────────────────────────────────────┘
          ↕ Tauri commands (invoke)
┌──────────────────────────────────────────────┐
│ Rust Core                                    │
│  ├─ auth (PAT + keyring)                     │
│  ├─ github (REST + GraphQL client)           │
│  ├─ cache (SQLite, ETag, stale-while-revalid)│
│  ├─ sync (poller, rate limit manager)        │
│  └─ notifications (OS notification)          │
└──────────────────────────────────────────────┘
          ↕ HTTPS
    api.github.com (REST v3 + GraphQL v4)
```

**キャッシュ戦略**: stale-while-revalidate。UI はまずキャッシュを返し、裏でAPIを叩いて差分を反映。初回起動時のみ同期待ち。

**ポーリング**: 60秒間隔。アプリ非フォーカス時は5分に緩和。レート残25%で一時停止、リセット後再開。

**GraphQL vs REST の境界**:
- GraphQL: Inbox横断集計、PR一覧 (review state含む複雑クエリ)
- REST: 個別PR詳細 / files / check runs / notifications

---

## 7. データモデル (SQLite)

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL DEFAULT 'github.com',
  avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE repos (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  full_name TEXT NOT NULL,
  is_watched INTEGER NOT NULL DEFAULT 1,
  default_branch TEXT,
  etag TEXT,
  last_fetched_at TEXT,
  UNIQUE(account_id, full_name)
);

CREATE TABLE pulls (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,        -- open/closed/merged
  is_draft INTEGER NOT NULL DEFAULT 0,
  author_login TEXT,
  head_ref TEXT,
  base_ref TEXT,
  ci_state TEXT,              -- pending/success/failure/none
  review_state TEXT,          -- pending/approved/changes_requested
  has_mention INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL,     -- full payload for flexibility
  updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  author_login TEXT,
  labels TEXT,                -- JSON array
  assignees TEXT,             -- JSON array
  raw_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE TABLE checks (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  pull_id INTEGER REFERENCES pulls(id),
  run_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,       -- queued/in_progress/completed
  conclusion TEXT,            -- success/failure/cancelled/...
  started_at TEXT,
  completed_at TEXT,
  html_url TEXT
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  thread_id TEXT NOT NULL,
  subject_type TEXT,          -- PullRequest/Issue/Commit/...
  subject_title TEXT,
  reason TEXT,                -- mention/review_requested/...
  is_read INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, thread_id)
);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,       -- last_inbox_sync / rate_limit_* など
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`raw_json` を持つのは、スキーマ変更せずに追加表示項目を増やせるようにするため。正規化はホットパスの項目のみ。

---

## 8. 機能要件

### 8.1 認証

- PAT (Personal Access Token)
- 必須 scopes (classic PAT): `repo`, `read:user`, `notifications`
- fine-grained PAT は `X-OAuth-Scopes` が空の場合あり — その場合はスコープ検証をスキップ（権限はトークン設定に依存）
- token は OS keychain に保存 (keyring crate)、ファイル保存しない
- 複数アカウントを同時保持、切替は ⌘T でモーダル
- token 無効化検知 (401) 時は Empty State の "auth expired" 画面に遷移

### 8.2 Inbox

- 3種のセクションを縦積み:
    1. **Review requests** — 自分にリクエストされたレビュー
    2. **CI failing** — 自分が author の open PR で CI 失敗
    3. **Mentions** — @mention を含む未読 notification
- 既読管理はローカル DB で (GitHub側は触らない)
- 全項目を既読化するショートカット (⇧X)
- 空状態: "You're all caught up" イラスト

### 8.3 Pull Requests

**一覧**:
- タブ: Created / Assigned / Review Requested / Mentioned / All
- フィルタ chip: state / repo / author / label
- 8カラム: status dots / number / title (+ labels inline) / repo / author / branch / CI badge / reviewers / updated
- 行クリックで詳細へ。J/K でナビゲーション

**詳細**:
- ヘッダ: breadcrumb / タイトル + # / state pill / author context / branch info
- サブタブ: Conversation / Commits / Checks / Files changed (deep link可能)
- Files changed:
    - unified / split 切替
    - ファイルごとに折り畳み
    - Viewed チェックボックス (localStorageに永続化)
    - インラインコメントはread only表示
- 右サイドバー: reviewers (承認状態pill) / assignees / labels / milestone / linked issues / CI checks
- フッター: Merge / Approve / Request changes はアプリ内から GitHub API 経由で実行（オフライン時は write queue が再試行）/ Open in editor (ローカルcheckout & エディタ起動)

### 8.4 Issues

**一覧**:
- 3カラム: sidebar / filter sidebar (State / Labels / Assignee / Repository / Milestone) / list
- ラベルフィルタは color swatch + カウント付きチェックボックス
- 適用中フィルタは上部に chip で列挙、× で削除
- リスト行: status dot / # / title (+ labels inline) / repo / author / comment count / assignees / updated

**詳細**:
- 元投稿 + コメントスレッド + イベント区切り (label追加 / assign / milestone / cross-reference)
- Markdown レンダリング (GFM、コードブロック syntax highlight)
- リアクション絵文字ピル (クリックでトグル、GitHub API 経由)
- 右サイドバー: Assignees / Labels / Milestone (進捗バー) / Linked PRs / Participants / Subscription状態
- フッター: Comment / Close issue など主要な更新はアプリ内から実行（未実装アクションは Open in browser）

### 8.5 CI Status

- Workflow run一覧を repo 横断で表示
- ステータスアイコン: ✓ success / ✗ failure / ● in_progress / — skipped
- 失敗した run のログボタンは GitHub web を開く (v0.1)
- 最近失敗したrunを上に、branch/workflowでソート

### 8.6 Activity

- GitHub notifications API + ローカル集計
- タブ: All / Unread / Participating / Mentions / Review requests
- サブフィルタ: PRs / Issues / Comments / CI / Releases
- 時間グループ: Today / Yesterday / This Week / Older
- クリックで既読化 + 該当 PR/Issue 詳細へ遷移
- ⇧X で全既読

### 8.7 Command Palette (⌘K)

- ナビゲーションコマンド (Go to Inbox / Pulls / ...)
- ローカル fuzzy 検索 (キャッシュ済 PR / Issue のタイトル)
- GitHub REST search (`/search/issues`) 結果を結合表示
- ↑↓ / Enter / Esc で操作

### 8.8 Workspace Switcher (⌘T)

- Accounts一覧: avatar / name / host / Active バッジ / ⌘1-4 ショートカット
- Recent workspaces (過去に開いた repo)
- Add another account 導線

### 8.9 設定画面

タブ構成:
- **Accounts**: 追加 / 削除 / reauth
- **Repositories**: watch 対象の追加・削除
- **Notifications**: ポーリング間隔 (30s / 60s / 5min / Off)、OS通知 on/off、種類別通知設定
- **Appearance**: (v0.1 はダーク固定なので将来用)
- **Shortcuts**: 一覧表示 (カスタマイズは v0.2)
- **About**: version / licenses / GitHub API rate info

### 8.10 通知

- OS通知 (Tauri notification): CI失敗 / レビュー要求 / mention
- タスクバー/Dockバッジで未読カウント
- 設定でオフ可能

### 8.11 オフライン対応

- 起動時にネットワーク検知、オフライン時はキャッシュのみで動作
- バナーで offline 状態を明示
- 書込み系 (将来のコメント等) はキューイング

---

## 9. 非機能要件

| 項目 | 目標 |
|---|---|
| 起動時間 | キャッシュありで 800ms 以内に初画面表示 |
| メモリ使用量 | アイドル時 200MB 以下 |
| CPU (アイドル) | < 1% |
| ポーリング負荷 | GitHub rate limit の 25% 以下で推移 |
| バイナリサイズ | macOS universal dmg で 30MB 以下 |
| クラッシュ率 | 100セッションに1回以下 |

---

## 10. UI/UX ガイドライン

- **ダークテーマ固定** (v0.1)。design tokens は `tokens.css` に集約
- **Linear / Raycast ライクなミニマリズム**: 装飾を削り、余白と階層で情報整理
- **キーボードネイティブ**: すべての主要操作にショートカット、マウスは補助
- **日本語環境考慮**: フォントは system stack、字間は -0.01em、絵文字表示を壊さない

### デザイントークン

```
--bg-primary: #0e0e10   --bg-secondary: #171719   --bg-tertiary: #1f1f22
--text-primary: #f0f0f2  --text-secondary: #a1a1aa --text-tertiary: #6b6b74
--accent-blue: #5e9eff   (PR/info)
--accent-green: #4ade80  (CI pass / success)
--accent-red: #f87171    (CI fail / error)
--accent-amber: #fbbf24  (warning / draft)
--accent-purple: #a78bfa (issue / merged)
--accent-pink: #f472b6   (mention)

--font-sans: -apple-system, "SF Pro Text", "Inter", system-ui
--font-mono: "SF Mono", "JetBrains Mono", Menlo
```

### 主要ショートカット

| キー | 動作 |
|---|---|
| ⌘K | Command Palette |
| ⌘T | Workspace Switcher |
| ⌘1-4 | アカウント切替 |
| ⌘R | 手動同期 |
| ⌘F | リスト内検索 |
| J / K | リスト上下移動 |
| Enter | 詳細を開く |
| Esc | 詳細を閉じる / モーダル閉じる |
| X | 既読 / done |
| ⇧X | すべて既読 |
| G → I | Inbox へ |
| G → P | Pulls へ |
| G → S | Settings へ |
| ? | ショートカット一覧 |

---

## 11. セキュリティ

- トークンは **必ず** OS keychain (keyring crate)。設定ファイル / DBには保存しない
- Tauri allowlist を最小化: `http=false` (reqwest のみ通す), `shell.open` のみ許可
- CSP: `default-src 'self'`、外部画像は GitHub CDN (`avatars.githubusercontent.com`) のみ許可
- ログに トークン / URL クエリ文字列を含めない (reqwest middleware でマスク)
- アップデート: `tauri-plugin-updater` で署名検証付きの差分配信 (v0.2で)

---

## 12. 配布

- **macOS**: universal dmg (Apple Silicon + Intel)、notarization 済み
- **Windows**: msi installer、Authenticode 署名は v0.2 で
- **Linux**: v0.2以降 (AppImage)
- **配布チャネル**:
    - GitHub Releases (primary)
    - Homebrew Cask (v0.2 検討)
    - Microsoft Store (検討しない)

---

## 13. 既知の課題・リスク

| リスク | 対応 |
|---|---|
| GitHub rate limit枯渇 | GraphQLで集約 / ETag活用 / ポーリング動的調整 |
| 大量通知時のUIフリーズ | virtual scroll + pagination |
| macOS notarization の失敗 | CI で事前検証、secret管理徹底 |
| OAuth token 漏洩 | keychain以外に書き出さない、ログマスク |
| GitHub API schema変更 | `raw_json` 保持で部分的に吸収、graphql型はCIで再生成 |

---

## 14. 開発フェーズ

| マイルストーン | 内容 | 目安 |
|---|---|---|
| M1 | プロジェクトセットアップ | 8h |
| M2 | 認証 | 9h |
| M3 | GitHub client + キャッシュ | 15h |
| M4 | 共通UI + レイアウト | 11h |
| M5 | PR一覧 + 詳細 (diff込) | 19h |
| M6 | Issues一覧 + 詳細 | 13h |
| M7 | Inbox / Activity / CI / 検索 | 17h |
| M8 | 仕上げ / リリース | 13h |
| **計** | **v0.1.0 MVP** | **~105h** |

週10h投下で約11週、週20hで約5-6週。

---

## 15. v0.2+ ロードマップ (参考)

- コメント投稿 / レビュー提出 / マージ操作
- Enterprise GHES 対応
- ライトテーマ
- カスタムショートカット
- Linux ビルド
- プロジェクト単位のフィルタプリセット保存
- AI要約 (ローカル LLM or Claude API)
- Webhooks 対応 (ポーリングからの脱却)

---

## 16. 参考

- Raycast GitHub extension (UIの参考)
- GitHub Desktop (アカウント管理の参考)
- Linear / Height (デザイン言語の参考)
- Tauri 2 docs: https://tauri.app/
- GitHub REST/GraphQL API: https://docs.github.com/en/rest
