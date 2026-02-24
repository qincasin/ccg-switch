# Claude API Token 管理系统设计

## 1. 功能概述

管理多个 Claude API tokens，支持快速切换当前使用的 token。

## 2. 数据存储

### 2.1 Token 配置文件
**位置**: `~/.claude-switch/tokens.json`

```json
{
  "tokens": [
    {
      "id": "token-1",
      "name": "主账号",
      "apiKey": "sk-ant-xxx",
      "description": "日常开发使用",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsed": "2024-01-15T10:30:00Z"
    },
    {
      "id": "token-2",
      "name": "测试账号",
      "apiKey": "sk-ant-yyy",
      "description": "测试环境",
      "isActive": false,
      "createdAt": "2024-01-05T00:00:00Z",
      "lastUsed": null
    }
  ]
}
```

### 2.2 Claude 配置文件
**位置**: `~/.claude/settings.json`

切换 token 时修改此文件的 `apiKey` 字段。

## 3. 后端设计（Rust）

### 3.1 数据模型

```rust
// src-tauri/src/models/token.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiToken {
    pub id: String,
    pub name: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub description: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastUsed")]
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokensConfig {
    pub tokens: Vec<ApiToken>,
}
```

### 3.2 Service 层

```rust
// src-tauri/src/services/token_service.rs
use crate::models::token::{ApiToken, TokensConfig};
use std::fs;
use std::io;
use std::path::PathBuf;
use serde_json;
use chrono::Utc;

fn get_tokens_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch").join("tokens.json"))
}

fn get_claude_settings_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude").join("settings.json"))
}

pub fn list_tokens() -> Result<Vec<ApiToken>, io::Error> {
    let tokens_path = get_tokens_path()?;

    if !tokens_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&tokens_path)?;
    let config: TokensConfig = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(config.tokens)
}

pub fn add_token(token: ApiToken) -> Result<(), io::Error> {
    let tokens_path = get_tokens_path()?;

    // 确保目录存在
    if let Some(parent) = tokens_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut tokens = list_tokens().unwrap_or_default();
    tokens.push(token);

    let config = TokensConfig { tokens };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&tokens_path, content)?;
    Ok(())
}

pub fn switch_token(token_id: &str) -> Result<(), io::Error> {
    let tokens_path = get_tokens_path()?;
    let mut tokens = list_tokens()?;

    // 找到要激活的 token
    let token_to_activate = tokens.iter_mut()
        .find(|t| t.id == token_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Token not found"))?;

    // 获取 api_key
    let api_key = token_to_activate.api_key.clone();

    // 更新所有 token 的 active 状态
    for token in tokens.iter_mut() {
        token.is_active = token.id == token_id;
        if token.is_active {
            token.last_used = Some(Utc::now());
        }
    }

    // 保存 tokens.json
    let config = TokensConfig { tokens };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&tokens_path, content)?;

    // 更新 Claude settings.json
    let settings_path = get_claude_settings_path()?;
    let settings_content = fs::read_to_string(&settings_path)?;
    let mut settings: serde_json::Value = serde_json::from_str(&settings_content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    settings["apiKey"] = serde_json::Value::String(api_key);

    let updated_content = serde_json::to_string_pretty(&settings)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(&settings_path, updated_content)?;

    Ok(())
}

pub fn delete_token(token_id: &str) -> Result<(), io::Error> {
    let tokens_path = get_tokens_path()?;
    let mut tokens = list_tokens()?;

    tokens.retain(|t| t.id != token_id);

    let config = TokensConfig { tokens };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&tokens_path, content)?;
    Ok(())
}
```

### 3.3 Tauri Commands

```rust
// src-tauri/src/lib.rs
use crate::services::token_service;
use crate::models::token::ApiToken;

#[tauri::command]
fn get_tokens() -> Result<Vec<ApiToken>, String> {
    token_service::list_tokens().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_api_token(token: ApiToken) -> Result<(), String> {
    token_service::add_token(token).map_err(|e| e.to_string())
}

#[tauri::command]
fn switch_api_token(token_id: String) -> Result<(), String> {
    token_service::switch_token(&token_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_token(token_id: String) -> Result<(), String> {
    token_service::delete_token(&token_id).map_err(|e| e.to_string())
}
```

## 4. 前端设计（React + TypeScript）

### 4.1 类型定义

```typescript
// src/types/token.ts
export interface ApiToken {
    id: string;
    name: string;
    apiKey: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
}
```

### 4.2 Store

```typescript
// src/stores/useTokenStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ApiToken } from '../types/token';

interface TokenState {
    tokens: ApiToken[];
    loading: boolean;
    error: string | null;

    loadTokens: () => Promise<void>;
    addToken: (token: Omit<ApiToken, 'id' | 'createdAt' | 'isActive' | 'lastUsed'>) => Promise<void>;
    switchToken: (tokenId: string) => Promise<void>;
    deleteToken: (tokenId: string) => Promise<void>;
}

export const useTokenStore = create<TokenState>((set, get) => ({
    tokens: [],
    loading: false,
    error: null,

    loadTokens: async () => {
        set({ loading: true, error: null });
        try {
            const tokens = await invoke<ApiToken[]>('get_tokens');
            set({ tokens, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    addToken: async (tokenData) => {
        set({ loading: true, error: null });
        try {
            const newToken: ApiToken = {
                ...tokenData,
                id: `token-${Date.now()}`,
                isActive: false,
                createdAt: new Date().toISOString(),
            };
            await invoke('add_api_token', { token: newToken });
            await get().loadTokens();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    switchToken: async (tokenId: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('switch_api_token', { tokenId });
            await get().loadTokens();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteToken: async (tokenId: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_api_token', { tokenId });
            await get().loadTokens();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },
}));
```

### 4.3 UI 组件

页面结构：
- Token 列表卡片
- 添加 Token 对话框
- 切换按钮
- 删除确认对话框

## 5. 实现步骤

1. 创建 Rust models 和 services
2. 注册 Tauri commands
3. 创建前端 types 和 store
4. 实现 Token 管理页面 UI
5. 测试完整流程

## 6. 安全考虑

- API Key 存储在本地文件系统
- 不在 UI 中完整显示 key（显示 sk-ant-xxx...）
- 文件权限检查（仅用户可读写）
