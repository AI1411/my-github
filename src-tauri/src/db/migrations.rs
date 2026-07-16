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

/// All migrations known to the application, ordered by version.
pub const MIGRATIONS: &[Migration] = &[V1_INITIAL, V2_NOTIFICATIONS_REPO, V3_ERROR_LOGS];

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
        assert_eq!(MIGRATIONS.len(), 3);
        assert_eq!(MIGRATIONS[2].version, 3);
    }
}
