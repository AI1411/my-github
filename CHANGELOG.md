# Changelog

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
