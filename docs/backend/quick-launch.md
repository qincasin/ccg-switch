# 快速启动（工作目录管理）系统设计

## 1. 功能概述

管理常用工作目录，支持一键在 CMD/PowerShell 中打开指定目录。

## 2. 数据存储

### 2.1 工作目录配置文件
**位置**: `~/.claude-switch/workspaces.json`

```json
{
  "workspaces": [
    {
      "id": "ws-1",
      "name": "Claude Switch",
      "path": "C:\\guodevelop\\claude-switch-v1",
      "description": "Claude Switch 项目",
      "tags": ["dev", "tauri"],
      "color": "#3b82f6",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastAccessed": "2024-01-15T10:30:00Z"
    },
    {
      "id": "ws-2",
      "name": "个人项目",
      "path": "D:\\projects\\my-app",
      "description": "",
      "tags": ["personal"],
      "color": "#10b981",
      "createdAt": "2024-01-05T00:00:00Z",
      "lastAccessed": null
    }
  ]
}
```

## 3. 后端设计（Rust）

### 3.1 数据模型

```rust
// src-tauri/src/models/workspace.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub color: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "lastAccessed")]
    pub last_accessed: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspacesConfig {
    pub workspaces: Vec<Workspace>,
}
```

### 3.2 Service 层

```rust
// src-tauri/src/services/workspace_service.rs
use crate::models::workspace::{Workspace, WorkspacesConfig};
use std::fs;
use std::io;
use std::path::PathBuf;
use serde_json;
use chrono::Utc;

fn get_workspaces_path() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;
    Ok(home.join(".claude-switch").join("workspaces.json"))
}

pub fn list_workspaces() -> Result<Vec<Workspace>, io::Error> {
    let workspaces_path = get_workspaces_path()?;

    if !workspaces_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&workspaces_path)?;
    let config: WorkspacesConfig = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    Ok(config.workspaces)
}

pub fn add_workspace(workspace: Workspace) -> Result<(), io::Error> {
    let workspaces_path = get_workspaces_path()?;

    // 确保目录存在
    if let Some(parent) = workspaces_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut workspaces = list_workspaces().unwrap_or_default();

    // 检查路径是否存在
    if !PathBuf::from(&workspace.path).exists() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "Directory not found"));
    }

    workspaces.push(workspace);

    let config = WorkspacesConfig { workspaces };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&workspaces_path, content)?;
    Ok(())
}

pub fn update_workspace(workspace_id: &str, updated: Workspace) -> Result<(), io::Error> {
    let workspaces_path = get_workspaces_path()?;
    let mut workspaces = list_workspaces()?;

    let workspace_index = workspaces.iter()
        .position(|w| w.id == workspace_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Workspace not found"))?;

    workspaces[workspace_index] = updated;

    let config = WorkspacesConfig { workspaces };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&workspaces_path, content)?;
    Ok(())
}

pub fn delete_workspace(workspace_id: &str) -> Result<(), io::Error> {
    let workspaces_path = get_workspaces_path()?;
    let mut workspaces = list_workspaces()?;

    workspaces.retain(|w| w.id != workspace_id);

    let config = WorkspacesConfig { workspaces };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&workspaces_path, content)?;
    Ok(())
}

pub fn update_last_accessed(workspace_id: &str) -> Result<(), io::Error> {
    let workspaces_path = get_workspaces_path()?;
    let mut workspaces = list_workspaces()?;

    if let Some(workspace) = workspaces.iter_mut().find(|w| w.id == workspace_id) {
        workspace.last_accessed = Some(Utc::now());
    }

    let config = WorkspacesConfig { workspaces };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    fs::write(&workspaces_path, content)?;
    Ok(())
}
```

### 3.3 Tauri Commands

```rust
// src-tauri/src/lib.rs
use tauri::Manager;
use std::process::Command;

#[tauri::command]
fn get_workspaces() -> Result<Vec<Workspace>, String> {
    workspace_service::list_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_workspace(workspace: Workspace) -> Result<(), String> {
    workspace_service::add_workspace(workspace).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_workspace(workspace_id: String, workspace: Workspace) -> Result<(), String> {
    workspace_service::update_workspace(&workspace_id, workspace).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_workspace(workspace_id: String) -> Result<(), String> {
    workspace_service::delete_workspace(&workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_in_terminal(workspace_id: String, path: String, terminal_type: String) -> Result<(), String> {
    // 更新最后访问时间
    workspace_service::update_last_accessed(&workspace_id)
        .map_err(|e| e.to_string())?;

    // 根据终端类型打开
    #[cfg(target_os = "windows")]
    {
        let command = match terminal_type.as_str() {
            "cmd" => {
                Command::new("cmd")
                    .args(&["/c", "start", "cmd", "/k", "cd", "/d", &path])
                    .spawn()
            },
            "powershell" => {
                Command::new("powershell")
                    .args(&["-Command", &format!("Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location \"{}\"'", path)])
                    .spawn()
            },
            "wt" => {
                // Windows Terminal
                Command::new("wt")
                    .args(&["-d", &path])
                    .spawn()
            },
            _ => {
                Command::new("cmd")
                    .args(&["/c", "start", "cmd", "/k", "cd", "/d", &path])
                    .spawn()
            }
        };

        command.map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented for this platform".to_string())
    }
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented for this platform".to_string())
    }
}
```

## 4. 前端设计（React + TypeScript）

### 4.1 类型定义

```typescript
// src/types/workspace.ts
export interface Workspace {
    id: string;
    name: string;
    path: string;
    description?: string;
    tags: string[];
    color?: string;
    createdAt: string;
    lastAccessed?: string;
}

export type TerminalType = 'cmd' | 'powershell' | 'wt';
```

### 4.2 Store

```typescript
// src/stores/useWorkspaceStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Workspace, TerminalType } from '../types/workspace';

interface WorkspaceState {
    workspaces: Workspace[];
    loading: boolean;
    error: string | null;

    loadWorkspaces: () => Promise<void>;
    addWorkspace: (workspace: Omit<Workspace, 'id' | 'createdAt' | 'lastAccessed'>) => Promise<void>;
    updateWorkspace: (id: string, workspace: Workspace) => Promise<void>;
    deleteWorkspace: (id: string) => Promise<void>;
    openInTerminal: (id: string, path: string, terminalType: TerminalType) => Promise<void>;
    openInExplorer: (path: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    workspaces: [],
    loading: false,
    error: null,

    loadWorkspaces: async () => {
        set({ loading: true, error: null });
        try {
            const workspaces = await invoke<Workspace[]>('get_workspaces');
            set({ workspaces, loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    addWorkspace: async (workspaceData) => {
        set({ loading: true, error: null });
        try {
            const newWorkspace: Workspace = {
                ...workspaceData,
                id: `ws-${Date.now()}`,
                createdAt: new Date().toISOString(),
            };
            await invoke('add_workspace', { workspace: newWorkspace });
            await get().loadWorkspaces();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    updateWorkspace: async (id: string, workspace: Workspace) => {
        set({ loading: true, error: null });
        try {
            await invoke('update_workspace', { workspaceId: id, workspace });
            await get().loadWorkspaces();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteWorkspace: async (id: string) => {
        set({ loading: true, error: null });
        try {
            await invoke('delete_workspace', { workspaceId: id });
            await get().loadWorkspaces();
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    openInTerminal: async (id: string, path: string, terminalType: TerminalType) => {
        try {
            await invoke('open_in_terminal', { workspaceId: id, path, terminalType });
            await get().loadWorkspaces(); // 刷新 lastAccessed
        } catch (error) {
            set({ error: String(error) });
            throw error;
        }
    },

    openInExplorer: async (path: string) => {
        try {
            await invoke('open_in_explorer', { path });
        } catch (error) {
            set({ error: String(error) });
            throw error;
        }
    },
}));
```

### 4.3 UI 组件

页面结构：
- 工作目录卡片列表（带颜色标签）
- 快速操作按钮：
  - 打开 CMD
  - 打开 PowerShell
  - 打开 Windows Terminal
  - 打开文件浏览器
- 添加/编辑工作目录对话框
- 标签筛选
- 搜索功能

## 5. 实现步骤

1. 创建 Rust models 和 services
2. 实现终端打开功能（platform-specific）
3. 注册 Tauri commands
4. 创建前端 types 和 store
5. 实现工作目录管理页面 UI
6. 测试各种终端打开方式

## 6. 技术要点

- 使用 Tauri shell API 打开外部程序
- Windows 平台特定实现（cmd, powershell, wt, explorer）
- 路径验证（确保目录存在）
- 最近访问时间追踪
