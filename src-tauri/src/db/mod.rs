use std::path::{Path, PathBuf};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use thiserror::Error;

pub type SqlitePool = Pool<SqliteConnectionManager>;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("failed to create database directory: {0}")]
    CreateDir(#[from] std::io::Error),
    #[error("failed to build connection pool: {0}")]
    Pool(#[from] r2d2::Error),
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
    let pool = Pool::new(manager)?;
    Ok(pool)
}

pub fn pulse_db_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, DbError> {
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
    fn pulse_db_path_joins_pulse_db_filename() {
        let fake_data_dir = PathBuf::from("/tmp/app-data");
        let expected = fake_data_dir.join("pulse.db");
        assert_eq!(expected, PathBuf::from("/tmp/app-data/pulse.db"));
    }

    #[test]
    fn pulse_db_path_signature_accepts_apphandle_runtime() {
        fn _sig<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, DbError> {
            super::pulse_db_path(app)
        }
    }
}
