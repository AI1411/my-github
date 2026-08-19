//! Schema migrations for the my-github SQLite database.
//!
//! Each migration is represented as a [`Migration`] containing its version, a
//! human readable name, and the SQL to apply. The migration runner
//! (implemented in M3-016) is expected to execute these in order inside a
//! transaction and record the applied version in a `schema_migrations` table.

/// A single forward migration.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Initial schema (v1): accounts / repos / pulls / issues / checks /
/// notifications / sync_meta. Mirrors `docs/requirments.md` §7.
pub const V1_INITIAL: Migration = Migration {
    version: 1,
    name: "v1_initial",
    sql: include_str!("sql/v1_initial.sql"),
};

/// v2: add repo_full_name column to notifications for display context.
pub const V2_NOTIFICATIONS_REPO: Migration = Migration {
    version: 2,
    name: "v2_notifications_repo",
    sql: include_str!("sql/v2_notifications_repo.sql"),
};

/// v3: persist frontend error boundary reports for diagnostics.
pub const V3_ERROR_LOGS: Migration = Migration {
    version: 3,
    name: "v3_error_logs",
    sql: include_str!("sql/v3_error_logs.sql"),
};

/// v4: local pin / snooze state for inbox items.
pub const V4_INBOX_ITEM_STATE: Migration = Migration {
    version: 4,
    name: "v4_inbox_item_state",
    sql: include_str!("sql/v4_inbox_item_state.sql"),
};

/// v5: cache of GitHub releases for watched repositories.
pub const V5_RELEASES: Migration = Migration {
    version: 5,
    name: "v5_releases",
    sql: include_str!("sql/v5_releases.sql"),
};

/// v6: local Done/dismiss flag for inbox items.
pub const V6_INBOX_ITEM_DISMISSED: Migration = Migration {
    version: 6,
    name: "v6_inbox_item_dismissed",
    sql: include_str!("sql/v6_inbox_item_dismissed.sql"),
};

/// v7: indexes for common pulls/issues list filters.
pub const V7_LIST_FILTER_INDEXES: Migration = Migration {
    version: 7,
    name: "v7_list_filter_indexes",
    sql: include_str!("sql/v7_list_filter_indexes.sql"),
};

/// All migrations known to the application, ordered by version.
pub const MIGRATIONS: &[Migration] = &[
    V1_INITIAL,
    V2_NOTIFICATIONS_REPO,
    V3_ERROR_LOGS,
    V4_INBOX_ITEM_STATE,
    V5_RELEASES,
    V6_INBOX_ITEM_DISMISSED,
    V7_LIST_FILTER_INDEXES,
];

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migrations_are_ordered_and_unique() {
        let mut last = 0u32;
        for m in MIGRATIONS {
            assert!(m.version > last, "versions must be strictly increasing");
            last = m.version;
        }
    }

    #[test]
    fn v1_initial_applies_cleanly_to_empty_db() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql)
            .expect("v1_initial should apply to an empty in-memory db");
    }

    #[test]
    fn v1_initial_creates_all_expected_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();

        let expected = [
            "accounts",
            "repos",
            "pulls",
            "issues",
            "checks",
            "notifications",
            "sync_meta",
        ];
        for table in expected {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "table {table} should exist after v1_initial");
        }
    }

    #[test]
    fn v1_initial_enforces_unique_account_login() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();

        conn.execute(
            "INSERT INTO accounts (login, host, is_active, created_at) \
             VALUES ('octocat', 'github.com', 1, '2026-04-21T00:00:00Z')",
            [],
        )
        .unwrap();

        let err = conn
            .execute(
                "INSERT INTO accounts (login, host, is_active, created_at) \
                 VALUES ('octocat', 'github.com', 0, '2026-04-21T00:00:00Z')",
                [],
            )
            .unwrap_err();
        assert!(format!("{err}").to_lowercase().contains("unique"));
    }

    #[test]
    fn v2_notifications_repo_applies_after_v1() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();
        conn.execute_batch(V2_NOTIFICATIONS_REPO.sql)
            .expect("v2 should apply after v1");
    }

    #[test]
    fn v2_adds_repo_full_name_column() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();
        conn.execute_batch(V2_NOTIFICATIONS_REPO.sql).unwrap();
        conn.execute(
            "INSERT INTO accounts (login, host, is_active, created_at) \
             VALUES ('octocat', 'github.com', 1, '2026-04-21T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notifications (account_id, thread_id, reason, is_read, updated_at, repo_full_name) \
             VALUES (1, 'thread-1', 'mention', 0, '2026-04-21T00:00:00Z', 'octocat/hello')",
            [],
        )
        .expect("insert with repo_full_name should succeed after v2");
    }

    #[test]
    fn migrations_include_v2() {
        assert!(MIGRATIONS.iter().any(|migration| migration.version == 2));
    }

    #[test]
    fn v3_error_logs_applies_after_v2() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();
        conn.execute_batch(V2_NOTIFICATIONS_REPO.sql).unwrap();
        conn.execute_batch(V3_ERROR_LOGS.sql)
            .expect("v3 should apply after v2");
    }

    #[test]
    fn v3_creates_error_logs_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(V1_INITIAL.sql).unwrap();
        conn.execute_batch(V2_NOTIFICATIONS_REPO.sql).unwrap();
        conn.execute_batch(V3_ERROR_LOGS.sql).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='error_logs'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "error_logs table should exist after v3");
    }

    #[test]
    fn migrations_include_v3() {
        assert_eq!(MIGRATIONS[2].version, 3);
    }

    fn apply_through(conn: &Connection, last_version: u32) {
        for m in MIGRATIONS.iter().filter(|m| m.version <= last_version) {
            conn.execute_batch(m.sql)
                .unwrap_or_else(|e| panic!("{} should apply: {e}", m.name));
        }
    }

    #[test]
    fn v4_inbox_item_state_applies_after_v3() {
        let conn = Connection::open_in_memory().unwrap();
        apply_through(&conn, 4);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='inbox_item_state'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "inbox_item_state table should exist after v4");
    }

    #[test]
    fn migrations_include_v4() {
        assert_eq!(MIGRATIONS[3].version, 4);
    }

    #[test]
    fn v5_releases_applies_after_v4() {
        let conn = Connection::open_in_memory().unwrap();
        apply_through(&conn, 5);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='releases'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "releases table should exist after v5");
    }

    #[test]
    fn migrations_include_v5() {
        assert_eq!(MIGRATIONS[4].version, 5);
    }

    #[test]
    fn v6_inbox_item_dismissed_applies_after_v5() {
        let conn = Connection::open_in_memory().unwrap();
        apply_through(&conn, 6);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('inbox_item_state') WHERE name='dismissed'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "dismissed column should exist after v6");
    }

    #[test]
    fn migrations_include_v6() {
        assert_eq!(MIGRATIONS.len(), 6);
        assert_eq!(MIGRATIONS[5].version, 6);
    }
}
