use keyring::Entry;
use std::collections::HashMap;
use std::sync::{LazyLock, RwLock};
use thiserror::Error;

const SERVICE: &str = "pulse-github";
const LAST_ACCOUNT_KEY: &str = "__last_account__";

// macOS ではキーチェーン読み出しのたびに許可ダイアログが出うるため、
// 実読み出しは初回のみとし、以降はプロセス内キャッシュから返す。
#[derive(Default)]
struct AuthCache {
    tokens: HashMap<String, String>,
    last_account_id: Option<String>,
}

static CACHE: LazyLock<RwLock<AuthCache>> = LazyLock::new(|| RwLock::new(AuthCache::default()));

#[derive(Debug, Error)]
pub enum TokenStoreError {
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("token store io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("token store unavailable: no data directory")]
    Unavailable,
}

// dev ビルドでは keychain の代わりに平文ファイルへ保存する。
// macOS の dev バイナリはアドホック署名で再ビルドごとに別アプリ扱いになり、
// キーチェーン許可ダイアログが毎回出てしまうため。
// テストビルドでは keyring 経路を維持する（mock を使うテストのため）。
fn dev_file_store_enabled() -> bool {
    cfg!(all(debug_assertions, not(test)))
}

fn dev_store_path() -> Result<std::path::PathBuf, TokenStoreError> {
    dev_file_store::default_path().ok_or(TokenStoreError::Unavailable)
}

pub fn save_token(account_id: &str, token: &str) -> Result<(), TokenStoreError> {
    if dev_file_store_enabled() {
        return dev_file_store::save_token_at(&dev_store_path()?, account_id, token);
    }
    let entry = Entry::new(SERVICE, account_id)?;
    entry.set_password(token)?;
    if let Ok(mut cache) = CACHE.write() {
        cache
            .tokens
            .insert(account_id.to_string(), token.to_string());
    }
    Ok(())
}

pub fn load_token(account_id: &str) -> Option<String> {
    if dev_file_store_enabled() {
        return dev_file_store::load_token_at(&dev_store_path().ok()?, account_id);
    }
    if let Ok(cache) = CACHE.read() {
        if let Some(token) = cache.tokens.get(account_id) {
            return Some(token.clone());
        }
    }
    let entry = Entry::new(SERVICE, account_id).ok()?;
    let token = entry.get_password().ok()?;
    if let Ok(mut cache) = CACHE.write() {
        cache.tokens.insert(account_id.to_string(), token.clone());
    }
    Some(token)
}

pub fn delete_token(account_id: &str) -> Result<(), TokenStoreError> {
    if dev_file_store_enabled() {
        return dev_file_store::delete_token_at(&dev_store_path()?, account_id);
    }
    if let Ok(mut cache) = CACHE.write() {
        cache.tokens.remove(account_id);
    }
    let entry = Entry::new(SERVICE, account_id)?;
    entry.delete_credential()?;
    Ok(())
}

pub fn save_last_account_id(account_id: &str) -> Result<(), TokenStoreError> {
    if dev_file_store_enabled() {
        return dev_file_store::save_last_account_id_at(&dev_store_path()?, account_id);
    }
    let entry = Entry::new(SERVICE, LAST_ACCOUNT_KEY)?;
    entry.set_password(account_id)?;
    if let Ok(mut cache) = CACHE.write() {
        cache.last_account_id = Some(account_id.to_string());
    }
    Ok(())
}

pub fn load_last_account_id() -> Option<String> {
    if dev_file_store_enabled() {
        return dev_file_store::load_last_account_id_at(&dev_store_path().ok()?);
    }
    if let Ok(cache) = CACHE.read() {
        if let Some(id) = &cache.last_account_id {
            return Some(id.clone());
        }
    }
    let entry = Entry::new(SERVICE, LAST_ACCOUNT_KEY).ok()?;
    let id = entry.get_password().ok()?;
    if let Ok(mut cache) = CACHE.write() {
        cache.last_account_id = Some(id.clone());
    }
    Some(id)
}

mod dev_file_store {
    use super::TokenStoreError;
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use std::fs;
    use std::path::{Path, PathBuf};

    #[derive(Default, Serialize, Deserialize)]
    struct StoreData {
        last_account_id: Option<String>,
        #[serde(default)]
        tokens: HashMap<String, String>,
    }

    pub fn default_path() -> Option<PathBuf> {
        Some(dirs::data_dir()?.join("my-github-dev").join("tokens.json"))
    }

    fn read(path: &Path) -> StoreData {
        fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn write(path: &Path, data: &StoreData) -> Result<(), TokenStoreError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(data).map_err(std::io::Error::other)?;
        fs::write(path, json)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }

    pub fn save_token_at(
        path: &Path,
        account_id: &str,
        token: &str,
    ) -> Result<(), TokenStoreError> {
        let mut data = read(path);
        data.tokens
            .insert(account_id.to_string(), token.to_string());
        write(path, &data)
    }

    pub fn load_token_at(path: &Path, account_id: &str) -> Option<String> {
        read(path).tokens.get(account_id).cloned()
    }

    pub fn delete_token_at(path: &Path, account_id: &str) -> Result<(), TokenStoreError> {
        let mut data = read(path);
        data.tokens.remove(account_id);
        write(path, &data)
    }

    pub fn save_last_account_id_at(path: &Path, account_id: &str) -> Result<(), TokenStoreError> {
        let mut data = read(path);
        data.last_account_id = Some(account_id.to_string());
        write(path, &data)
    }

    pub fn load_last_account_id_at(path: &Path) -> Option<String> {
        read(path).last_account_id
    }
}

#[cfg(test)]
fn clear_cache() {
    if let Ok(mut cache) = CACHE.write() {
        *cache = AuthCache::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // キャッシュはプロセス内で共有され、clear_cache() は全体を消去するため、
    // キャッシュを触るテストはすべて直列化する。
    static CACHE_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn save_and_load_token_roundtrip_via_cache() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        let id = "test-cache-roundtrip";
        save_token(id, "gho_cached123").unwrap();
        assert_eq!(load_token(id), Some("gho_cached123".to_string()));
    }

    #[test]
    fn save_and_load_last_account_id_via_cache() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        save_last_account_id("octocat-cache").unwrap();
        assert_eq!(load_last_account_id(), Some("octocat-cache".to_string()));
        clear_cache();
    }

    #[test]
    fn delete_token_removes_cached_entry() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        let id = "test-cache-delete";
        save_token(id, "gho_delete_me").unwrap();
        // mock keychain は Entry 間で状態を共有しないため削除自体は失敗しうる
        let _ = delete_token(id);
        assert!(load_token(id).is_none());
    }

    // keyring mock の Entry はオブジェクト間で状態を共有しないため、
    // ラウンドトリップテストは実 OS キーチェーンが必要 → #[ignore] で除外。
    // `cargo test -- --ignored` で手動実行可能。
    #[test]
    #[ignore = "requires OS keychain (keyring mock does not share state between Entry objects)"]
    fn save_and_load_token_roundtrip() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        let id = "test-save-load-roundtrip";
        save_token(id, "gho_testtoken123").unwrap();
        clear_cache(); // キャッシュを介さず OS キーチェーンからの読み出しを検証する
        let loaded = load_token(id);
        assert_eq!(loaded, Some("gho_testtoken123".to_string()));
        let _ = delete_token(id);
    }

    #[test]
    fn load_token_returns_none_for_unknown_account() {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        let loaded = load_token("nonexistent-account-xyz-99999");
        assert!(loaded.is_none());
    }

    #[test]
    #[ignore = "requires OS keychain (keyring mock does not share state between Entry objects)"]
    fn save_and_load_last_account_id() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        save_last_account_id("octocat").unwrap();
        clear_cache(); // キャッシュを介さず OS キーチェーンからの読み出しを検証する
        let id = load_last_account_id();
        assert_eq!(id, Some("octocat".to_string()));
        let _ = delete_token(LAST_ACCOUNT_KEY);
        clear_cache();
    }

    #[test]
    fn load_last_account_id_returns_none_when_not_set() {
        let _guard = CACHE_TEST_LOCK.lock().unwrap();
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        clear_cache();
        let id = load_last_account_id();
        assert!(id.is_none());
    }

    #[test]
    #[ignore = "requires OS keychain (keyring mock does not share state between Entry objects)"]
    fn delete_token_removes_entry() {
        let id = "test-delete-token";
        save_token(id, "gho_delete_me").unwrap();
        delete_token(id).unwrap();
        let loaded = load_token(id);
        assert!(loaded.is_none());
    }

    #[test]
    fn dev_file_store_token_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tokens.json");
        dev_file_store::save_token_at(&path, "octo", "gho_file123").unwrap();
        assert_eq!(
            dev_file_store::load_token_at(&path, "octo"),
            Some("gho_file123".to_string())
        );
        assert!(dev_file_store::load_token_at(&path, "unknown").is_none());
    }

    #[test]
    fn dev_file_store_last_account_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tokens.json");
        assert!(dev_file_store::load_last_account_id_at(&path).is_none());
        dev_file_store::save_last_account_id_at(&path, "octo").unwrap();
        assert_eq!(
            dev_file_store::load_last_account_id_at(&path),
            Some("octo".to_string())
        );
    }

    #[test]
    fn dev_file_store_delete_token_removes_entry() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tokens.json");
        dev_file_store::save_token_at(&path, "octo", "gho_x").unwrap();
        dev_file_store::delete_token_at(&path, "octo").unwrap();
        assert!(dev_file_store::load_token_at(&path, "octo").is_none());
    }

    #[test]
    fn dev_file_store_preserves_other_entries() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tokens.json");
        dev_file_store::save_token_at(&path, "a", "gho_a").unwrap();
        dev_file_store::save_token_at(&path, "b", "gho_b").unwrap();
        dev_file_store::save_last_account_id_at(&path, "a").unwrap();
        dev_file_store::delete_token_at(&path, "a").unwrap();
        assert_eq!(
            dev_file_store::load_token_at(&path, "b"),
            Some("gho_b".to_string())
        );
        assert_eq!(
            dev_file_store::load_last_account_id_at(&path),
            Some("a".to_string())
        );
    }

    #[cfg(unix)]
    #[test]
    fn dev_file_store_sets_owner_only_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tokens.json");
        dev_file_store::save_token_at(&path, "octo", "gho_perm").unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
