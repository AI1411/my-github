use serde::{Deserialize, Serialize};

pub mod device_flow;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Method {
    DeviceFlow,
    Pat,
}
