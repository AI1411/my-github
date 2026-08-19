use serde::Serialize;
use thiserror::Error;

/// Structured command error surfaced to the frontend as a serializable message.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[error("{0}")]
    Auth(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    pub fn network(msg: impl Into<String>) -> Self {
        Self::Network(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

impl From<AppError> for String {
    fn from(value: AppError) -> Self {
        value.to_string()
    }
}
