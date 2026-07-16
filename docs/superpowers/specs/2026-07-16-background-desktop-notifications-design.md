# Background Desktop Notifications Design

Date: 2026-07-16

## Purpose

my-github currently checks for desktop notifications only while the Activity page is mounted. Users should receive notifications whenever the application process is running, including while another page is open or the window is minimized or unfocused.

The application does not need to remain resident after the user quits it, and it does not need to launch automatically with the operating system.

## Requirements

- Start notification monitoring after an authenticated AppShell mounts.
- Fetch notifications immediately at application startup, including notifications that were already unread.
- Continue polling at the interval selected in Settings: 30 seconds, 60 seconds, or 5 minutes.
- Monitor while any application page is open and while the window is minimized or unfocused.
- Respect the existing global and per-type notification settings for CI failures, review requests, and mentions.
- Avoid sending the same notification more than once during the same authenticated account session.
- Reset notification deduplication when the active account changes.
- Stop polling after logout or when the authenticated AppShell unmounts.
- Keep notification click navigation available from every page.
- Retry after the next polling interval when notification retrieval fails.
- Do not make notification failure fatal to the rest of the application.

## Architecture

Use a frontend application-level notification poller mounted by `AppShell`.

This approach reuses the existing Tauri notification plugin, frontend settings store, route mapping, and notification tests. It avoids adding backend commands or duplicating notification policy in Rust.

The poller owns the lifecycle of periodic notification retrieval. Activity remains a presentation screen and reads notifications from the shared data store instead of being the owner of background monitoring.

## Components

### Application-level notification poller

A dedicated hook mounted in `AppShell` will:

1. Register the notification click handler.
2. Fetch notifications immediately.
3. Store fetched notifications in `useDataStore`.
4. Send eligible unread desktop notifications.
5. Schedule the next fetch using the configured polling interval.
6. Cancel the pending timer and ignore in-flight results when unmounted.

The timer will be rescheduled when the polling interval changes.

### Deduplication

Deduplication state will be scoped by authenticated account and notification ID. The first fetch after startup intentionally notifies all eligible unread items. Subsequent fetches suppress IDs that have already been sent during the current account session.

Changing accounts clears the active deduplication scope so unread notifications for the newly selected account can be delivered.

### Activity page

Activity will continue to support manual refresh and read-state actions. It will use the shared notification retrieval path so manual refresh updates the same global store and applies the same deduplication policy.

The page will no longer register the global notification click handler itself.

## Data Flow

1. Authenticated AppShell mounts.
2. The poller retrieves notifications through `cmd_get_notifications`.
3. Results are written to `useDataStore`.
4. Each unread result is classified as CI failure, review request, mention, or unsupported.
5. Existing settings determine whether an OS notification is sent.
6. Sent notification IDs are recorded for the active account.
7. The next retrieval is scheduled from the selected polling interval.
8. Clicking a desktop notification routes to the corresponding PR or Issue.

## Error Handling

- Retrieval failures are recorded in poller state for Activity to display when relevant.
- A failure does not clear the last successfully loaded notifications.
- A failure does not stop future scheduled polling.
- Notification permission denial or an individual send failure does not stop polling.
- Results from an obsolete account or unmounted poller are ignored.

## Testing

Automated tests will verify:

- Immediate retrieval on mount.
- Polling at each configured interval using fake timers.
- Interval rescheduling after a settings change.
- Operation outside the Activity page through AppShell integration.
- Initial unread notifications are sent.
- Duplicate notification IDs are suppressed within one account session.
- Account changes reset deduplication.
- Polling stops on unmount/logout.
- Retrieval failures retry on the next interval.
- Notification click navigation is registered once at application scope.
- Activity read-state and manual refresh behavior remains functional.

Full frontend tests, lint, type checking, and the relevant Rust verification will run before completion.

## Out of Scope

- Running after the application process exits.
- Login items or operating-system startup registration.
- Push notifications from an external server.
- A system tray resident mode.
- Changing existing notification types or their settings.
