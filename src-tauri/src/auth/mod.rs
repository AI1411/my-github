use serde::{Deserialize, Serialize};

pub mod device_flow;
pub mod pat;
pub mod token_store;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Method {
    DeviceFlow,
    Pat,
}
