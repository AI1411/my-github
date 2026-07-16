# 機能拡張パック 設計 (2026-07-16)

v0.1完成後の利便性向上を目的とした11機能の設計概要。
view-only原則（書き込みはGitHubへ行わない）を維持し、状態はローカルSQLite / localStorageで完結させる。

## 実装順序と粒度

各機能を独立したコミットとして実装する。順序は依存の少ないものから:

1. Inboxスヌーズ・ピン留め
2. 滞留PR検知（Stale PR警告）
3. Merge Readiness表示
4. 保存済みフィルタ（カスタムビュー）
5. リポジトリ別通知ルール
6. PR詳細ファイルツリー＋diff内検索
7. PRをローカルにcheckout
8. リリース/タグ監視
9. デイリーダイジェスト
10. トレイ常駐ミニInbox
11. レビューprefix支援（コピー用）

## 1. Inboxスヌーズ・ピン留め

- **DB**: 新migration `v4_inbox_item_state` — `inbox_item_state(item_id TEXT PK, account_id, pinned INTEGER, snoozed_until TEXT, updated_at)`
- **Rust**: `cache/inbox_state.rs` (upsert/get/purge)、`cmd_snooze_inbox_item(item_id, until)` / `cmd_pin_inbox_item(item_id, pinned)` / `cmd_get_inbox` がスヌーズ中項目を除外しピン留めを先頭へ
- **UI**: `InboxItemRow` にホバーアクション（Pin / Snooze 1h / 明日 / 来週）。スヌーズ解除は期限到来で自動（クエリ時に `snoozed_until < now` を無視）

## 2. 滞留PR検知

- **判定**: レビュー要求から3日以上更新なし（自分がブロック）/ 自分のopen PRが7日以上レビューなし（放置されている）
- **実装**: フロント側の純関数 `lib/stalePulls.ts` で `InboxData` + `pulls` から算出。バックエンド変更なし
- **UI**: Inboxに "Stale" セクション追加（警告色）。しきい値は settingsStore に持つ（デフォルト 3日/7日）

## 3. Merge Readiness

- **取得**: REST `GET /repos/{owner}/{repo}/pulls/{number}` の `mergeable_state`, `mergeable` と既存の review/ci 情報を組み合わせ
- **Rust**: `cmd_get_merge_readiness(owner, repo, number)` — mergeable_state / approvals / ci をまとめた `MergeReadiness` を返す
- **UI**: PR詳細ヘッダに readiness バッジ（Ready / Blocked: conflicts / Needs approval / CI failing）。一覧行は既存 ciState/reviewState から簡易表示

## 4. 保存済みフィルタ

- **保存先**: settingsStore（localStorage persist）に `savedFilters: SavedFilter[]`（id / name / target: pulls|issues / クエリパラメータ）
- **UI**: Pulls/Issuesページの適用中フィルタを「Save view」で保存。Sidebarに Views セクション表示、クリックでルートへ（search paramsで復元）

## 5. リポジトリ別通知ルール

- **設定**: settingsStore に `repoNotificationRules: Record<string, {ciFailures, reviewRequests, mentions}>`（未設定リポジトリはグローバル設定に従う）
- **適用**: 通知発火判定ロジック（`lib/notifications.ts`）にルール解決関数を追加
- **UI**: Settings > Notifications にリポジトリ別ルールのマトリクス編集

## 6. ファイルツリー＋diff内検索

- **ツリー**: `FileDiff` のパス配列からツリー構造を構築する純関数 `lib/fileTree.ts`。Files changedタブ左側にツリー、クリックでスクロール
- **検索**: 検索ボックス（`/` キー）でファイル名・diff行のマッチをハイライト＋ヒットジャンプ

## 7. PRをローカルにcheckout

- **UI**: PR詳細フッター/サイドバーに「Copy checkout command」— `git fetch origin pull/{N}/head:{branch} && git switch {branch}` をクリップボードへ
- クローンパスの設定は持たない（コピーのみ、view-only原則維持）

## 8. リリース/タグ監視

- **DB**: migration `v5_releases` — `releases(id, repo_id, tag_name, name, published_at, html_url, raw_json, fetched_at)`
- **Rust**: REST `GET /repos/{owner}/{repo}/releases?per_page=10`、sync engine に releases ステップ追加、`cmd_list_releases`
- **UI**: Activityページに Releases タイプ表示、新規リリースでOS通知（種類 `releases` を通知設定に追加）

## 9. デイリーダイジェスト

- **データ**: 前回終了時刻（sync_metaに `last_shutdown_at` 保存）以降の merged PR / 新規レビュー要求 / CI失敗 / 新規リリースをローカルDBから集計
- **Rust**: `cmd_get_digest(since) -> DigestData`
- **UI**: `/digest` ルート + 起動時に前回終了から6時間以上経過していればモーダル表示（設定でオフ可）

## 10. トレイ常駐ミニInbox

- **Rust**: Tauri trayメニューに未読サマリ（Review requests: N / CI failing: N / Mentions: N）を表示、クリックでメインウィンドウ表示＋該当画面へ遷移。未読数更新時にメニュー再構築
- macOS/Windows 両対応の範囲で Tauri 2 の `tray-icon` 機能のみ使用

## 11. レビューprefix支援

- **UI**: PR詳細の Conversation タブに「Comment draft」パネル。prefix（[must]/[imo]/[nits]/[ask]/[fyi]）を選んで本文を書き、クリップボードへコピー → "Open in browser" でGitHubに貼り付ける動線
- 書き込みAPIは呼ばない（v0.2のコメント投稿の布石）

## テスト方針

- Rust: 各コマンド/キャッシュ層に既存同様の in-memory SQLite テスト
- Frontend: 純関数（stalePulls / fileTree / ルール解決 / ダイジェスト整形）に vitest ユニットテスト、コンポーネントは既存テストの粒度に合わせる

## 非目標

- GitHubへの書き込み（コメント投稿・マージ等）
- スヌーズ状態の複数マシン間同期
- リリース監視のwatch対象外リポジトリ対応
