use keyring::Entry;
use thiserror::Error;

const SERVICE: &str = "pulse-github";

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
    fn delete_token_removes_entry() {
        let id = "test-delete-token";
        save_token(id, "gho_delete_me").unwrap();
        delete_token(id).unwrap();
        let loaded = load_token(id);
        assert!(loaded.is_none());
    }
}
