# Codex 配置切换系统设计

## 1. 功能概述

管理 Codex 的配置文件（`~/.codex/config.toml` 和 `~/.codex/auth.json`），支持多配置预设快速切换，避免手动编辑配置文件的痛点。

## 2. 目标配置文件

### 2.1 config.toml
**位置**: `~/.codex/config.toml`

TOML 格式配置文件，包含 Codex 的各种设置。

### 2.2 auth.json
**位置**: `~/.codex/auth.json`

JSON 格式认证文件，包含 API keys 和认证信息。

## 3. 数据存储

### 3.1 Codex 预设配置文件
**位置**: `~/.claude-switch/codex-presets.json`

```json
{
  "presets": [
    {
      "id": "preset-1",
      "name": "默认配置",
      "description": "日常开发使用",
      "configToml": "... base64 encoded content ...",
      "authJson": "... base64 encoded content ...",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsed": "2024-01-15T10:30:00Z"
    },
    {
      "id": "preset-2",
      "name": "测试环境",
      "description": "用于测试",
      "configToml": "... base64 encoded content ...",
      "authJson": "... base64 encoded content ...",
      "isActive": false,
      "createdAt": "2024-01-05T00:00:00Z",
      "lastUsed": null
    }
  ],
  "backups": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "configToml": "... base64 encoded ...",
      "authJson": "... base64 encoded ..."
    }
  ]
}
```

## 4. 后端设计（Rust）

### 4.1 依赖

```toml
# Cargo.toml
[dependencies]
toml = "0.8"  # TOML 解析
base64 = "0.21"  # Base64 编解码
```

### 4.2 数据模型

```rust
// src-tauri/src/models/codex.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexPreset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "configToml")]
    pub config_toml: String,  // Base64 encoded
    #[serde(rename = "authJson")]
    pub auth_json: String,  // Base64 encoded
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastUsed")]
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodexBackup {
    pub timestamp: DateTime<Utc>,
    #[serde(rename = "configToml")]
    pub config_toml: String,
    #[serde(rename = "authJson")]
    pub auth_json: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodexPresetsConfig {
    pub presets: Vec<CodexPreset>,
    pub backups: Vec<CodexBackup>,
}
```

### 4.3 Service 层

```rust
// src-tauri/src/services/codex_service.rs
use crate::models::codex::{CodexPreset, CodexBackup, CodexPresetsConfig};
use std::fs;
use std::io;
use std::path::PathBuf;
use serde_json;
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};

fn get_codex_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".codex"))
}

fn get_presets_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch").join("codex-presets.json"))
}

pub fn list_presets() -> Result<Vec<CodexPreset>, io::Error> {
    let presets_path = get_presets_path()?;

    if !presets_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&presets_path)?;
    let config: CodexPresetsConfig = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(config.presets)
}

pub fn get_current_config() -> Result<(String, String), io::Error> {
    let codex_dir = get_codex_dir()?;
    let config_path = codex_dir.join("config.toml");
    let auth_path = codex_dir.join("auth.json");

    let config_toml = if config_path.exists() {
        fs::read_to_string(&config_path)?
    } else {
        String::new()
    };

    let auth_json = if auth_path.exists() {
        fs::read_to_string(&auth_path)?
    } else {
        String::new()
    };

    Ok((config_toml, auth_json))
}

pub fn create_backup() -> Result<(), io::Error> {
    let presets_path = get_presets_path()?;
    let (config_toml, auth_json) = get_current_config()?;

    // Base64 编码
    let config_encoded = general_purpose::STANDARD.encode(config_toml.as_bytes());
    let auth_encoded = general_purpose::STANDARD.encode(auth_json.as_bytes());

    let backup = CodexBackup {
        timestamp: Utc::now(),
        config_toml: config_encoded,
        auth_json: auth_encoded,
    };

    // 读取现有配置
    let mut config = if presets_path.exists() {
        let content = fs::read_to_string(&presets_path)?;
        serde_json::from_str::<CodexPresetsConfig>(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?
    } else {
        CodexPresetsConfig {
            presets: vec![],
            backups: vec![],
        }
    };

    // 添加备份（最多保留 10 个）
    config.backups.insert(0, backup);
    if config.backups.len() > 10 {
        config.backups.truncate(10);
    }

    // 保存
    if let Some(parent) = presets_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&presets_path, content)?;

    Ok(())
}

pub fn save_as_preset(name: String, description: Option<String>) -> Result<(), io::Error> {
    let presets_path = get_presets_path()?;
    let (config_toml, auth_json) = get_current_config()?;

    // Base64 编码
    let config_encoded = general_purpose::STANDARD.encode(config_toml.as_bytes());
    let auth_encoded = general_purpose::STANDARD.encode(auth_json.as_bytes());

    let preset = CodexPreset {
        id: format!("preset-{}", Utc::now().timestamp_millis()),
        name,
        description,
        config_toml: config_encoded,
        auth_json: auth_encoded,
        is_active: false,
        created_at: Utc::now(),
        last_used: None,
    };

    let mut config = if presets_path.exists() {
        let content = fs::read_to_string(&presets_path)?;
        serde_json::from_str::<CodexPresetsConfig>(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?
    } else {
        CodexPresetsConfig {
            presets: vec![],
            backups: vec![],
        }
    };

    config.presets.push(preset);

    if let Some(parent) = presets_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&presets_path, content)?;

    Ok(())
}

pub fn switch_preset(preset_id: &str) -> Result<(), io::Error> {
    // 先备份当前配置
    create_backup()?;

    let presets_path = get_presets_path()?;
    let mut config = if presets_path.exists() {
        let content = fs::read_to_string(&presets_path)?;
        serde_json::from_str::<CodexPresetsConfig>(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?
    } else {
        return Err(io::Error::new(io::ErrorKind::NotFound, "No presets found"));
    };

    // 找到要激活的预设
    let preset = config.presets.iter_mut()
        .find(|p| p.id == preset_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Preset not found"))?;

    // 解码配置
    let config_toml = general_purpose::STANDARD.decode(&preset.config_toml)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let auth_json = general_purpose::STANDARD.decode(&preset.auth_json)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    // 写入 Codex 配置目录
    let codex_dir = get_codex_dir()?;
    fs::create_dir_all(&codex_dir)?;

    fs::write(codex_dir.join("config.toml"), config_toml)?;
    fs::write(codex_dir.join("auth.json"), auth_json)?;

    // 更新状态
    for p in config.presets.iter_mut() {
        p.is_active = p.id == preset_id;
        if p.is_active {
            p.last_used = Some(Utc::now());
        }
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&presets_path, content)?;

    Ok(())
}

pub fn delete_preset(preset_id: &str) -> Result<(), io::Error> {
    let presets_path = get_presets_path()?;
    let mut config = if presets_path.exists() {
        let content = fs::read_to_string(&presets_path)?;
        serde_json::from_str::<CodexPresetsConfig>(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?
    } else {
        return Err(io::Error::new(io::ErrorKind::NotFound, "No presets found"));
    };

    config.presets.retain(|p| p.id != preset_id);

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&presets_path, content)?;

    Ok(())
}

pub fn restore_backup(timestamp: DateTime<Utc>) -> Result<(), io::Error> {
    let presets_path = get_presets_path()?;
    let config = if presets_path.exists() {
        let content = fs::read_to_string(&presets_path)?;
        serde_json::from_str::<CodexPresetsConfig>(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?
    } else {
        return Err(io::Error::new(io::ErrorKind::NotFound, "No backups found"));
    };

    let backup = config.backups.iter()
        .find(|b| b.timestamp == timestamp)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Backup not found"))?;

    // 解码备份
    let config_toml = general_purpose::STANDARD.decode(&backup.config_toml)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let auth_json = general_purpose::STANDARD.decode(&backup.auth_json)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    // 写入 Codex 配置目录
    let codex_dir = get_codex_dir()?;
    fs::write(codex_dir.join("config.toml"), config_toml)?;
    fs::write(codex_dir.join("auth.json"), auth_json)?;

    Ok(())
}
```

### 4.4 Tauri Commands

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn get_codex_presets() -> Result<Vec<CodexPreset>, String> {
    codex_service::list_presets().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_codex_preset(name: String, description: Option<String>) -> Result<(), String> {
    codex_service::save_as_preset(name, description).map_err(|e| e.to_string())
}

#[tauri::command]
fn switch_codex_preset(preset_id: String) -> Result<(), String> {
    codex_service::switch_preset(&preset_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_codex_preset(preset_id: String) -> Result<(), String> {
    codex_service::delete_preset(&preset_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_codex_backup() -> Result<(), String> {
    codex_service::create_backup().map_err(|e| e.to_string())
}
```

## 5. 前端设计（React + TypeScript）

### 5.1 类型定义

```typescript
// src/types/codex.ts
export interface CodexPreset {
    id: string;
    name: string;
    description?: string;
    configToml: string;  // Base64
    authJson: string;  // Base64
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
}
```

### 5.2 Store

```typescript
// src/stores/useCodexStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { CodexPreset } from '../types/codex';

interface CodexState {
    presets: CodexPreset[];
    loading: boolean;
    error: string | null;

    loadPresets: () => Promise<void>;
    saveCurrentAsPreset: (name: string, description?: string) => Promise<void>;
    switchPreset: (presetId: string) => Promise<void>;
    deletePreset: (presetId: string) => Promise<void>;
    createBackup: () => Promise<void>;
}

export const useCodexStore = create<CodexState>((set, get) => ({
    presets: [],
    loading: false,
    error: null,

    loadPresets: async () => {
        set({ loading: true, error: null });
        try {
            const presets = await invoke<CodexPreset[]>('get_codex_presets');
            set({ presets, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    saveCurrentAsPreset: async (name: string, description?: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('save_codex_preset', { name, description });
            await get().loadPresets();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    switchPreset: async (presetId: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('switch_codex_preset', { presetId });
            await get().loadPresets();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deletePreset: async (presetId: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_codex_preset', { presetId });
            await get().loadPresets();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    createBackup: async () => {
        set({ loading: true, error: null });
        try {
            await invoke('create_codex_backup');
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
```

### 5.3 UI 组件

页面结构：
- 当前 Codex 配置状态显示
- 预设列表卡片
- 快速操作：
  - 保存当前配置为预设
  - 切换预设
  - 删除预设
  - 创建备份
- 备份历史列表
- 恢复备份功能

## 6. 实现步骤

1. 添加 `toml` 和 `base64` 依赖
2. 创建 Rust models 和 services
3. 实现配置文件读写和编解码
4. 注册 Tauri commands
5. 创建前端 types 和 store
6. 实现 Codex 配置管理页面 UI
7. 测试配置切换和备份恢复

## 7. 安全考虑

- 配置文件使用 Base64 编码存储
- 自动备份机制（切换前备份）
- 保留最近 10 个备份
- 文件权限检查
