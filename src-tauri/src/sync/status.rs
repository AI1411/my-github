use rusqlite::{params, OptionalExtension};

use crate::cache::CacheError;
use crate::db::SqlitePool;
use crate::github::client::RateLimitInfo;
use crate::sync::types::{SyncReport, SyncStatus, SyncStepStatus};

const LAST_STARTED_AT: &str = "sync:last_started_at";
const LAST_FINISHED_AT: &str = "sync:last_finished_at";
const LAST_STATUS: &str = "sync:last_status";
const LAST_REPORT_JSON: &str = "sync:last_report_json";
const LAST_RATE_LIMIT_JSON: &str = "sync:last_rate_limit_json";

pub fn persist_sync_report(pool: &SqlitePool, report: &SyncReport) -> Result<(), CacheError> {
    set_meta(pool, LAST_STARTED_AT, &report.started_at_epoch.to_string())?;
    set_meta(pool, LAST_FINISHED_AT, &report.finished_at_epoch.to_string())?;
    set_meta(pool, LAST_STATUS, report_status(report))?;
    set_meta(pool, LAST_REPORT_JSON, &serde_json::to_string(report)?)?;
    if let Some(rate_limit) = &report.rate_limit {
        set_meta(pool, LAST_RATE_LIMIT_JSON, &serde_json::to_string(rate_limit)?)?;
    }
    Ok(())
}

pub fn get_sync_status(pool: &SqlitePool) -> Result<SyncStatus, CacheError> {
    let last_report = get_meta(pool, LAST_REPORT_JSON)?
        .map(|raw| serde_json::from_str::<SyncReport>(&raw))
        .transpose()?;
    let last_rate_limit = get_meta(pool, LAST_RATE_LIMIT_JSON)?
        .map(|raw| serde_json::from_str::<RateLimitInfo>(&raw))
        .transpose()?;

    Ok(SyncStatus {
        is_running: false,
        last_started_at_epoch: get_meta(pool, LAST_STARTED_AT)?.and_then(|v| v.parse().ok()),
        last_finished_at_epoch: get_meta(pool, LAST_FINISHED_AT)?.and_then(|v| v.parse().ok()),
        last_status: get_meta(pool, LAST_STATUS)?,
        last_report,
        last_rate_limit,
    })
}

fn report_status(report: &SyncReport) -> &'static str {
    if report
        .steps
        .iter()
        .any(|s| matches!(s.status, SyncStepStatus::Failed))
    {
        "failed"
    } else if report
        .steps
        .iter()
        .any(|s| matches!(s.status, SyncStepStatus::Partial))
    {
        "partial"
    } else {
        "success"
    }
}

fn set_meta(pool: &SqlitePool, key: &str, value: &str) -> Result<(), CacheError> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO sync_meta (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
        params![key, value, report_time_value()],
    )?;
    Ok(())
}

fn get_meta(pool: &SqlitePool, key: &str) -> Result<Option<String>, CacheError> {
    let conn = pool.get()?;
    let value = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(value)
}

fn report_time_value() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use crate::github::client::RateLimitInfo;
    use crate::sync::types::{SyncScope, SyncStepReport};
    use std::path::Path;

    fn pool() -> SqlitePool {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();
        pool
    }

    #[test]
    fn get_sync_status_returns_empty_before_first_sync() {
        let pool = pool();
        let status = get_sync_status(&pool).unwrap();
        assert!(!status.is_running);
        assert!(status.last_report.is_none());
    }

    #[test]
    fn persist_and_read_sync_report_roundtrip() {
        let pool = pool();
        let report = SyncReport {
            started_at_epoch: 10,
            finished_at_epoch: 20,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
            }),
            steps: vec![SyncStepReport::success(SyncScope::Repositories, 2, 2)],
        };

        persist_sync_report(&pool, &report).unwrap();
        let status = get_sync_status(&pool).unwrap();

        assert!(!status.is_running);
        assert_eq!(status.last_started_at_epoch, Some(10));
        assert_eq!(status.last_finished_at_epoch, Some(20));
        assert_eq!(status.last_status.as_deref(), Some("success"));
        assert_eq!(status.last_report.unwrap().steps[0].items_written, 2);
        assert_eq!(status.last_rate_limit.unwrap().remaining, 4999);
    }
}
