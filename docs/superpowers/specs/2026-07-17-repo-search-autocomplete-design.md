# リポジトリ検索オートコンプリート 設計

日付: 2026-07-17
対象: Settings > Repositories の「owner/repository」入力欄

## 目的

watch するリポジトリを追加する際、完全な `owner/repository` を手入力しなくても、
文字入力に応じて GitHub 全体から候補を表示し、選択だけで追加できるようにする。

## 決定事項

- 検索対象: サインイン中アカウントが所有するリポジトリのみ
  （`GET /search/repositories` に `user:<login>` 修飾子を付与。
  当初は GitHub 全体だったが 2026-07-17 に自分のリポジトリのみへ変更。
  組織のリポジトリは対象外）。プライベートリポジトリは候補に含まれる
- 候補選択時の挙動: 即座に watch に追加し、入力欄をクリア
- 候補数: 最大 8 件 / デバウンス 300ms / 最小 2 文字で検索開始
- watch 済みリポジトリは候補から除外
- 候補未選択のまま Enter した場合は従来どおり入力文字列をそのまま追加

## バックエンド（Rust）

- `github/rest.rs`: `search_repositories(client, query)` を追加
  - `GET /search/repositories?q={query}&per_page=8`
  - レスポンス型 `RepoSearchItem { full_name, description, stargazers_count, private }`
- `commands/search.rs`: `cmd_search_repositories(query: String) -> Vec<RepoSearchResult>`
  - `RepoSearchResult { fullName, description, stars, private }`（camelCase で返す）
  - トークン取得は既存コマンドと同じ `load_last_account_id` + `load_token` パターン
- `lib.rs` にコマンド登録

## フロントエンド（React）

- `useRepoSearchQuery` フック新設
  - 入力値を 300ms デバウンスし、2 文字以上のときのみ `cmd_search_repositories` を invoke
  - シーケンス番号で古いレスポンスの後着を無視
  - 返り値: `{ results, loading, error }`
- SettingsPage の入力欄をコンボボックス化
  - 候補ドロップダウン: `owner/repo` + 説明 + ★スター数
  - ↑↓ で選択、Enter で追加、Esc で閉じる、クリックで追加
  - ARIA: `role="combobox"` / `role="listbox"` / `aria-expanded` など
- 検索エラー（レートリミット等）はドロップダウン内に表示し、手入力を妨げない
- 未サインイン時は検索をスキップ（エラー表示のみ、入力は可能）

## テスト

- Rust: `RepoSearchItem` デシリアライズ、`search_item` → `RepoSearchResult` 変換
- React: フックのデバウンス・invoke・後着無視、ドロップダウンのキーボード操作
