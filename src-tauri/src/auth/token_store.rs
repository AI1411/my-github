use keyring::Entry;
use thiserror::Error;

const SERVICE: &str = "pulse-github";
const LAST_ACCOUNT_KEY: &str = "__last_account__";

#[derive(Debug, Error)]
pub enum TokenStoreError {
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
}

pub fn save_token(account_id: &str, token: &str) -> Result<(), TokenStoreError> {
    let entry = Entry::new(SERVICE, account_id)?;
    entry.set_password(token)?;
    Ok(())
}

pub fn load_token(account_id: &str) -> Option<String> {
    let entry = Entry::new(SERVICE, account_id).ok()?;
    entry.get_password().ok()
}

pub fn delete_token(account_id: &str) -> Result<(), TokenStoreError> {
    let entry = Entry::new(SERVICE, account_id)?;
    entry.delete_credential()?;
    Ok(())
}

pub fn save_last_account_id(account_id: &str) -> Result<(), TokenStoreError> {
    let entry = Entry::new(SERVICE, LAST_ACCOUNT_KEY)?;
    entry.set_password(account_id)?;
    Ok(())
}

pub fn load_last_account_id() -> Option<String> {
    let entry = Entry::new(SERVICE, LAST_ACCOUNT_KEY).ok()?;
    entry.get_password().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    // keyring mock の Entry はオブジェクト間で状態を共有しないため、
    // ラウンドトリップテストは実 OS キーチェーンが必要 → #[ignore] で除外。
    // `cargo test -- --ignored` で手動実行可能。
    #[test]
    #[ignore = "requires OS keychain (keyring mock does not share state between Entry objects)"]
    fn save_and_load_token_roundtrip() {
        let id = "test-save-load-roundtrip";
        save_token(id, "gho_testtoken123").unwrap();
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
        save_last_account_id("octocat").unwrap();
        let id = load_last_account_id();
        assert_eq!(id, Some("octocat".to_string()));
        let _ = delete_token(LAST_ACCOUNT_KEY);
    }

    #[test]
    fn load_last_account_id_returns_none_when_not_set() {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
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
}
