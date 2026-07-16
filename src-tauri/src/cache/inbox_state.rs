//! Local pin / snooze state for inbox items.
//!
//! State is keyed by `(account_id, item_id)` where `item_id` is the inbox
//! item's stable ID (GraphQL node ID or synthetic `ci-{repo}-{number}`).
//! Snooze is stored as an epoch-seconds deadline; items whose deadline has
//! passed behave as if they were never snoozed.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::params;

use crate::cache::CacheError;
use crate::db::SqlitePool;

#[derive(Debug, Clone, Default)]
pub struct InboxItemState {
    pub pinned: bool,
    pub snoozed_until: Option<i64>,
}

pub fn now_epoch_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn set_pinned(
    pool: &SqlitePool,
    account_id: i64,
    item_id: &str,
    pinned: bool,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO inbox_item_state (account_id, item_id, pinned, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
             pinned = excluded.pinned,
             updated_at = excluded.updated_at",
        params![
            account_id,
            item_id,
            if pinned { 1i32 } else { 0i32 },
            now_epoch_secs().to_string(),
        ],
    )?;
    Ok(())
}

pub fn set_snoozed_until(
    pool: &SqlitePool,
    account_id: i64,
    item_id: &str,
    snoozed_until: Option<i64>,
) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO inbox_item_state (account_id, item_id, snoozed_until, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
             snoozed_until = excluded.snoozed_until,
             updated_at = excluded.updated_at",
        params![
            account_id,
            item_id,
            snoozed_until,
            now_epoch_secs().to_string()
        ],
    )?;
    Ok(())
}

/// Returns all pin / snooze state for an account keyed by item ID.
pub fn get_states(
    pool: &SqlitePool,
    account_id: i64,
) -> Result<HashMap<String, InboxItemState>, CacheError> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT item_id, pinned, snoozed_until
         FROM inbox_item_state
         WHERE account_id = ?1",
    )?;
    let rows = stmt.query_map(params![account_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            InboxItemState {
                pinned: row.get::<_, i32>(1)? == 1,
                snoozed_until: row.get(2)?,
            },
        ))
    })?;
    let mut out = HashMap::new();
    for r in rows {
        let (id, state) = r?;
        out.insert(id, state);
    }
    Ok(out)
}

/// Deletes expired snoozes with no pin so the table does not grow unbounded.
pub fn purge_expired(pool: &SqlitePool, account_id: i64, now: i64) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "DELETE FROM inbox_item_state
         WHERE account_id = ?1 AND pinned = 0
           AND (snoozed_until IS NULL OR snoozed_until < ?2)",
        params![account_id, now],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use std::path::Path;

    fn test_pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (1, 'octocat', 'github.com', 1, '2026-07-16T00:00:00Z')",
            [],
        )
        .unwrap();
        drop(conn);
        pool
    }

    #[test]
    fn set_pinned_inserts_and_reads_back() {
        let pool = test_pool();
        set_pinned(&pool, 1, "item-1", true).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert!(states["item-1"].pinned);
        assert_eq!(states["item-1"].snoozed_until, None);
    }

    #[test]
    fn set_pinned_false_unpins_existing() {
        let pool = test_pool();
        set_pinned(&pool, 1, "item-1", true).unwrap();
        set_pinned(&pool, 1, "item-1", false).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert!(!states["item-1"].pinned);
    }

    #[test]
    fn set_snoozed_until_preserves_pin() {
        let pool = test_pool();
        set_pinned(&pool, 1, "item-1", true).unwrap();
        set_snoozed_until(&pool, 1, "item-1", Some(9_999_999_999)).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert!(states["item-1"].pinned);
        assert_eq!(states["item-1"].snoozed_until, Some(9_999_999_999));
    }

    #[test]
    fn set_snoozed_none_clears_snooze() {
        let pool = test_pool();
        set_snoozed_until(&pool, 1, "item-1", Some(9_999_999_999)).unwrap();
        set_snoozed_until(&pool, 1, "item-1", None).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert_eq!(states["item-1"].snoozed_until, None);
    }

    #[test]
    fn get_states_scoped_to_account() {
        let pool = test_pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO accounts (id, login, host, is_active, created_at)
             VALUES (2, 'hubot', 'github.com', 0, '2026-07-16T00:00:00Z')",
            [],
        )
        .unwrap();
        drop(conn);
        set_pinned(&pool, 1, "item-1", true).unwrap();
        set_pinned(&pool, 2, "item-2", true).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert!(states.contains_key("item-1"));
        assert!(!states.contains_key("item-2"));
    }

    #[test]
    fn purge_expired_removes_stale_unpinned_rows() {
        let pool = test_pool();
        set_snoozed_until(&pool, 1, "expired", Some(100)).unwrap();
        set_snoozed_until(&pool, 1, "active", Some(9_999_999_999)).unwrap();
        set_pinned(&pool, 1, "pinned-expired", true).unwrap();
        set_snoozed_until(&pool, 1, "pinned-expired", Some(100)).unwrap();
        purge_expired(&pool, 1, 1_000_000).unwrap();
        let states = get_states(&pool, 1).unwrap();
        assert!(!states.contains_key("expired"));
        assert!(states.contains_key("active"));
        assert!(states.contains_key("pinned-expired"));
    }
}
