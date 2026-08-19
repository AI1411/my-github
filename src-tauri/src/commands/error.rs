use thiserror::Error;

/// Structured command-layer errors. Commands still return `String` at the IPC
/// boundary; map with `AppError::into_string()` until serde error payloads land.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("no token for account")]
    NoTokenForAccount,
    #[error("no signed-in account")]
    NoSignedInAccount,
    #[error("sqlite pool not initialized")]
    PoolNotInitialized,
    #[error("{0}")]
    Message(String),
}

impl AppError {
    pub fn into_string(self) -> String {
        self.to_string()
    }
}

impl From<crate::auth::pat::PatError> for AppError {
    fn from(value: crate::auth::pat::PatError) -> Self {
        AppError::Message(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_formats_message() {
        let err = AppError::NoTokenForAccount;
        assert_eq!(err.to_string(), "no token for account");
    }
}
