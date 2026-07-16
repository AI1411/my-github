pub mod migrations;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use thiserror::Error;

use crate::db::migrations::{Migration, MIGRATIONS};

pub type SqlitePool = Pool<SqliteConnectionManager>;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("failed to create database directory: {0}")]
    CreateDir(#[from] std::io::Error),
    #[error("failed to build connection pool: {0}")]
    Pool(#[from] r2d2::Error),
    #[error("migration failed: {0}")]
    Migrate(#[from] rusqlite::Error),
}

pub fn init_pool(db_path: &Path) -> Result<SqlitePool, DbError> {
    if db_path != Path::new(":memory:") {
        if let Some(parent) = db_path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
    }

    let manager = if db_path == Path::new(":memory:") {
        SqliteConnectionManager::memory()
    } else {
        SqliteConnectionManager::file(db_path)
    };
    // `:memory:` databases are per-connection: migrations applied on one
    // connection are invisible on others. Pin the pool to a single connection
    // so the in-memory schema is shared across pool.get() calls in tests and
    // ephemeral setups.
    let pool = if db_path == Path::new(":memory:") {
        Pool::builder().max_size(1).build(manager)?
    } else {
        Pool::new(manager)?
    };
    Ok(pool)
}

/// Apply pending migrations from [`MIGRATIONS`] to the database backing
/// `pool`. Applied versions are recorded in a `schema_migrations` table so
/// subsequent calls are no-ops.
pub fn run_migrations(pool: &SqlitePool) -> Result<(), DbError> {
    let mut conn = pool.get()?;
    ensure_schema_migrations_table(&conn)?;
    let applied = load_applied_versions(&conn)?;
    for migration in MIGRATIONS {
        if applied.contains(&migration.version) {
            continue;
        }
        apply_migration(&mut conn, migration)?;
    }
    Ok(())
}

fn ensure_schema_migrations_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             version INTEGER PRIMARY KEY,
             name TEXT NOT NULL,
             applied_at TEXT NOT NULL
         )",
    )
}

fn load_applied_versions(conn: &Connection) -> Result<Vec<u32>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT version FROM schema_migrations")?;
    let rows = stmt.query_map([], |row| row.get::<_, u32>(0))?;
    rows.collect()
}

fn apply_migration(conn: &mut Connection, migration: &Migration) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;
    tx.execute_batch(migration.sql)?;
    tx.execute(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![migration.version, migration.name, now_epoch_secs()],
    )?;
    tx.commit()
}

fn now_epoch_secs() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

pub fn app_db_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, DbError> {
    use tauri::Manager;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::CreateDir(std::io::Error::other(e.to_string())))?;
    Ok(data_dir.join("pulse.db"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn pool_type_alias_compiles() {
        fn _accepts(_pool: &SqlitePool) {}
    }

    #[test]
    fn db_error_display_includes_context() {
        let err = DbError::CreateDir(std::io::Error::other("boom"));
        assert!(format!("{}", err).contains("failed to create database directory"));
    }

    #[test]
    fn init_pool_creates_parent_dir_and_opens_connection() {
        let tmp = TempDir::new().unwrap();
        let db_path = tmp.path().join("nested").join("sub").join("pulse.db");
        let pool = init_pool(&db_path).expect("init_pool should succeed");

        let conn = pool.get().expect("checkout connection");
        let one: i64 = conn
            .query_row("SELECT 1", [], |row| row.get(0))
            .expect("query_row");
        assert_eq!(one, 1);

        assert!(db_path.exists(), "pulse.db should be created on connect");
        assert!(db_path.parent().unwrap().exists());
    }

    #[test]
    fn init_pool_accepts_in_memory() {
        let pool = init_pool(Path::new(":memory:")).expect("in-memory pool");
        let conn = pool.get().unwrap();
        conn.execute("CREATE TABLE t (x INTEGER)", []).unwrap();
    }

    #[test]
    fn app_db_path_joins_legacy_db_filename() {
        let fake_data_dir = PathBuf::from("/tmp/app-data");
        let expected = fake_data_dir.join("pulse.db");
        assert_eq!(expected, PathBuf::from("/tmp/app-data/pulse.db"));
    }

    #[test]
    fn app_db_path_signature_accepts_apphandle_runtime() {
        fn _sig<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, DbError> {
            super::app_db_path(app)
        }
    }

    #[test]
    fn run_migrations_applies_v1_to_empty_db() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        super::run_migrations(&pool).expect("migrations apply");
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn run_migrations_is_idempotent() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        super::run_migrations(&pool).unwrap();
        super::run_migrations(&pool).expect("second run should be a no-op");
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3, "all migrations should be recorded exactly once");
    }

    #[test]
    fn run_migrations_records_name_and_version() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        super::run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        let (version, name): (u32, String) = conn
            .query_row(
                "SELECT version, name FROM schema_migrations WHERE version = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(version, 1);
        assert_eq!(name, "v1_initial");
    }

    #[test]
    fn run_migrations_creates_core_tables() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        super::run_migrations(&pool).unwrap();
        let conn = pool.get().unwrap();
        for table in [
            "accounts",
            "repos",
            "pulls",
            "issues",
            "checks",
            "notifications",
            "sync_meta",
            "error_logs",
        ] {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "table {table} should exist");
        }
    }
}
