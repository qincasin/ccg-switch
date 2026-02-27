use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type SkillApps = HashMap<String, bool>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub content: String,
    pub file_path: String,
    pub source: SkillSource,
    #[serde(default)]
    pub apps: SkillApps,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    User,
    Project,
}
