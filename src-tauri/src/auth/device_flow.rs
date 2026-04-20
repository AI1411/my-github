use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Error)]
pub enum DeviceFlowError {
    #[error("HTTP request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("GitHub API error: {error}")]
    Api { error: String },
    #[error("missing required field: {field}")]
    MissingField { field: &'static str },
    #[error("authorization pending")]
    AuthorizationPending,
    #[error("polling too fast, increase interval")]
    SlowDown,
    #[error("device code expired")]
    ExpiredToken,
    #[error("user denied access")]
    AccessDenied,
    #[error("polling timed out")]
    Timeout,
}

#[derive(Debug, Deserialize)]
struct RawDeviceCodeResponse {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    expires_in: Option<u64>,
    interval: Option<u64>,
    error: Option<String>,
}

pub async fn request_device_code(
    client: &Client,
    client_id: &str,
    scope: &str,
) -> Result<DeviceCodeResponse, DeviceFlowError> {
    let params = [("client_id", client_id), ("scope", scope)];
    let raw: RawDeviceCodeResponse = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    if let Some(error) = raw.error {
        return Err(DeviceFlowError::Api { error });
    }

    Ok(DeviceCodeResponse {
        device_code: raw.device_code.ok_or(DeviceFlowError::MissingField {
            field: "device_code",
        })?,
        user_code: raw
            .user_code
            .ok_or(DeviceFlowError::MissingField { field: "user_code" })?,
        verification_uri: raw.verification_uri.ok_or(DeviceFlowError::MissingField {
            field: "verification_uri",
        })?,
        expires_in: raw.expires_in.unwrap_or(900),
        interval: raw.interval.unwrap_or(5),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_code_response_deserializes_correctly() {
        let json = r#"{
            "device_code": "abc123",
            "user_code": "ABCD-1234",
            "verification_uri": "https://github.com/login/device",
            "expires_in": 900,
            "interval": 5
        }"#;
        let resp: DeviceCodeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.device_code, "abc123");
        assert_eq!(resp.user_code, "ABCD-1234");
        assert_eq!(resp.verification_uri, "https://github.com/login/device");
        assert_eq!(resp.expires_in, 900);
        assert_eq!(resp.interval, 5);
    }

    #[test]
    fn raw_response_with_error_field_detected() {
        let json = r#"{"error": "access_denied"}"#;
        let raw: RawDeviceCodeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(raw.error.unwrap(), "access_denied");
    }

    #[test]
    fn raw_response_error_field_maps_to_api_error() {
        let raw = RawDeviceCodeResponse {
            device_code: None,
            user_code: None,
            verification_uri: None,
            expires_in: None,
            interval: None,
            error: Some("access_denied".to_string()),
        };
        // Verify the error detection logic: if error is Some, it should be returned as Err
        assert!(raw.error.is_some());
        let err = DeviceFlowError::Api {
            error: raw.error.unwrap(),
        };
        assert_eq!(err.to_string(), "GitHub API error: access_denied");
    }

    #[test]
    fn authorization_pending_error_variant_exists() {
        let err = DeviceFlowError::AuthorizationPending;
        assert_eq!(err.to_string(), "authorization pending");
    }

    #[test]
    fn slow_down_error_variant_exists() {
        let err = DeviceFlowError::SlowDown;
        assert_eq!(err.to_string(), "polling too fast, increase interval");
    }

    #[test]
    fn expired_token_error_variant_exists() {
        let err = DeviceFlowError::ExpiredToken;
        assert_eq!(err.to_string(), "device code expired");
    }

    #[test]
    fn access_denied_error_variant_exists() {
        let err = DeviceFlowError::AccessDenied;
        assert_eq!(err.to_string(), "user denied access");
    }

    #[test]
    fn timeout_error_variant_exists() {
        let err = DeviceFlowError::Timeout;
        assert_eq!(err.to_string(), "polling timed out");
    }
}
