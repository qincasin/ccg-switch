# Team Plan: antigravity-account-management

> 版本：v1.6.0 · 日期：2026-06-06

## 概述

将独立项目 Antigravity-Manager 的账号管理能力整合进 ccg-switch，让用户在同一桌面应用内同时管理 Claude API Token 与 Google Antigravity / Antigravity IDE 账号，覆盖账号生命周期、本地切换、Token 与配额可视化、操作历史与预热等完整流程。

## 技术方案

**新增模块**：
- 后端 `src-tauri/src/services/antigravity_service.rs` —— 账号 CRUD、Token 刷新、配额抓取、loadCodeAssist 调用、预热
- 后端 `src-tauri/src/services/ag_integration.rs` —— 本地 Antigravity / Antigravity IDE 进程检测、凭证注入、关停重启
- 后端 `src-tauri/src/models/antigravity.rs` —— 账号 / 配额 / Token 状态等数据模型
- 前端 `src/pages/AntigravityPage.tsx` —— 账号列表页（含筛选、视图切换、批量操作）
- 前端 `src/components/antigravity/*` —— AccountCard / AccountListRow / QuotaDisplay / AccountDetailsDialog 等
- 前端 `src/stores/useAntigravityStore.ts` —— 账号状态与 Tauri 命令封装

**关键调用链**：

```
切换账号:
  AccountCard.handleSwitch
    → useAntigravityStore.switchAccount
    → Tauri ag_switch_account
    → ag_integration::execute_local_switch
        1. find_antigravity_path(target_ide)   // 提前拿到 app 路径
        2. close_antigravity(timeout, target)  // 关闭已运行的进程
        3. 注入凭证到本地配置目录
        4. start_antigravity_at_path(target_ide, cached_path)
           // macOS: open <path>，不带 -a（-a 期望 app name 不是路径）

抓配额:
  fetch_account_quota
    → 先尝试 cloudcode-pa endpoints
    → 403 时同 endpoint 不带 project_id 重试一次
    → 仍 403 才换下一个 endpoint
    → quota.is_forbidden 时强制再调 fetch_project_id_and_tier 刷新 tier
    → project_id 拿到后落库，下次跳过 loadCodeAssist
```

**风控规避**：
- 所有 Google API 调用统一带 `User-Agent: vscode/1.99.0 (Antigravity/4.2.1)`
- project_id 缓存：成功拿过 quota 后不再每次重复调 loadCodeAssist
- 账号支持手动 warmup（伪造常规请求）

## 功能点罗列

### 账号管理
- 账号增删改查
- 自定义标签（customLabel，鼠标移上去可直接改）
- 批量导入 / 导出（JSON）
- 启用 / 禁用账号
- 账号列表支持网格 / 列表双视图切换
- 按订阅等级（FREE / PRO / ULTRA）筛选
- 仅显示付费账号、仅显示活跃账号

### 切换 & 启动
- 本地一键切换 Antigravity
- 本地一键切换 Antigravity IDE
- 切换流程：检测进程 → 优雅关闭 → 注入凭证 → 重新启动
- 切换按钮独立 spin 动画（切 Antigravity 只转 Antigravity 那个）
- Toast 进度提示，切成功 / 失败后自动消失

### Token & 配额
- Token 状态可视化（剩余有效期、最近刷新时间、刷新次数）
- 手动刷新 Token
- 过期 Token 在卡片上自动告警
- 按模型分组的配额展示（进度条 + 重置时间 + 推荐 / 思考 / 图像 badge）
- 卡片预览前 3 个模型，更多模型可点击进详情

### 历史 & 预热
- 操作历史记录：token_refresh / account_switch / quota_refresh / warmup / 添加 / 删除 / 启停
- 操作类型彩色 badge
- 账号 warmup，降低被风控概率

## 子任务列表（实际实现顺序）

### Task 1: 后端数据模型 & 持久化
- **类型**: 后端
- **文件**: `src-tauri/src/models/antigravity.rs`、`src-tauri/src/services/antigravity_storage.rs`
- **实施**: 定义 AntigravityAccount / Quota / TokenStatus / OperationLog；JSON 落盘到 `~/.ccg-switch/antigravity.json`

### Task 2: Google API 集成
- **类型**: 后端
- **文件**: `src-tauri/src/services/antigravity_service.rs`
- **实施**:
  - OAuth token exchange / refresh
  - userinfo
  - loadCodeAssist（拿 project_id + subscription tier）
  - quota endpoints（含 403 降级重试）
  - warmup
  - 全部 6 个请求点统一 User-Agent

### Task 3: 本地切换实现
- **类型**: 后端
- **文件**: `src-tauri/src/services/ag_integration.rs`
- **实施**:
  - find_antigravity_path（区分 Antigravity / Antigravity IDE）
  - is_antigravity_running / close_antigravity
  - 凭证注入到 Antigravity 配置目录
  - start_antigravity_at_path（macOS 直接 open <path>）

### Task 4: 前端账号列表 & 卡片
- **类型**: 前端
- **文件**: `src/pages/AntigravityPage.tsx`、`src/components/antigravity/AccountCard.tsx`
- **实施**:
  - Zustand store
  - 列表 / 网格视图切换
  - 筛选（tier / status）
  - 卡片 actions：切换 / 刷新 / 编辑标签 / 详情 / 导出 / 删除

### Task 5: 详情弹窗
- **类型**: 前端
- **文件**: `src/components/antigravity/AccountDetailsDialog.tsx`、`QuotaDisplay.tsx`
- **实施**:
  - max-w-4xl 宽弹窗
  - Token 状态 section（含手动刷新）
  - 配额 section（QuotaDisplay 子组件，单列 + icon badge）
  - 操作历史 section
  - Warmup section

### Task 6: 风控规避与 UX 调优
- **类型**: 全栈
- **实施**:
  - 全请求加 User-Agent
  - project_id 缓存
  - Toast 自动消失（showToast 返回 id + dismissToast）
  - 切换按钮独立 spin
  - tier 字符串模糊匹配（substring，避免大小写 / 后缀差异）

## 后续可扩展
- 账号配额自动定时刷新
- 多账号 round-robin 切换（按配额优先级）
- 失效账号自动隔离
- 与 Claude Token 共用同一套快捷键面板
