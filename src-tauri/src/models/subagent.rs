use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subagent {
    pub name: String,
    pub content: String,
    pub file_path: String,
}
