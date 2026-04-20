//! Local SQLite cache for GitHub data.
//!
//! Each submodule provides upsert + read helpers for a specific entity
//! (pull requests, issues, sync metadata). All helpers take a
//! [`crate::db::SqlitePool`] and return [`CacheError`].

use thiserror::Error;

pub mod pulls;

#[derive(Debug, Error)]
pub enum CacheError {
    #[error("sqlite pool error: {0}")]
    Pool(#[from] r2d2::Error),
    #[error("sqlite error: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("json (de)serialize error: {0}")]
    Json(#[from] serde_json::Error),
}
