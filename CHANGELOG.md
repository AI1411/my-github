# Changelog

## [Unreleased]

### Inbox

- Added pin and snooze (1 hour / tomorrow / next week) actions for inbox items, stored locally.
- Added a stale section highlighting review requests waiting 3+ days and own pulls idle 7+ days (thresholds configurable).

### Pull Requests

- Added a merge readiness badge (conflicts, CI, approvals, branch protection) to the pull detail header.
- Added a changed-files tree with jump-to-file and a search box filtering by filename or diff content.
- Added a "Copy checkout" action that copies a `git fetch origin pull/N/head` command.
- Added a prefixed review comment draft panel ([must]/[imo]/[nits]/[ask]/[fyi]) with copy-to-clipboard.

### Views

- Added saved filters: save the current pull/issue filter as a named view listed in the sidebar.

### Releases

- Added release monitoring for watched repositories with Activity integration and OS notifications for new releases.

### Digest

- Added a digest page summarizing merged pulls, CI failures, review requests, and releases since the last visit, shown automatically after 6+ hours away.

### Notifications

- Added per-repository notification rules overriding the global type settings.

### System

- Added a tray icon with a mini inbox summary (review requests / CI failing / mentions) and an "Open Inbox" shortcut.

## [0.1.0] - 2026-04-29

### Inbox

- Added a cached inbox for review requests, CI failures, and mentions across repositories.
- Added GitHub GraphQL-backed review request and mention aggregation.

### Pull Requests

- Added pull request lists, detail routing, CI status summaries, file diffs, and reviewer context.
- Added external log opening for workflow runs.

### Issues

- Added issue lists, filters, issue detail pages, markdown rendering, comments, labels, assignees, and milestone context.

### Activity

- Added notification activity tabs, type filters, mark-as-read actions, and local detail routing.

### Settings

- Added Accounts, Repositories, Notifications, Appearance, Shortcuts, and About tabs.
- Added persisted watch repositories, notification preferences, polling interval, Dock badge setting, density, and shortcut customization.

### Notifications

- Added Tauri OS notification support for CI failures, review requests, and mentions.
- Added notification click routing payloads and unread Dock/taskbar badge updates.

### Resilience

- Added a React error boundary around app pages.
- Added SQLite-backed frontend error logging.
- Added offline detection using `navigator.onLine` and a Tauri ping command.

### Release

- Added production bundle metadata, a 1024px icon source, macOS signing/notarization documentation, and tag-driven macOS/Windows release builds.
