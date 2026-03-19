# Team Plan: proxy-fix

## 概述
将参考项目 cc-switch 的完整反代架构移植到 claude-switch-1.0，修复反代无法工作的问题。

## Codex 分析摘要
Codex 执行失败（stdin 模式兼容问题），由 Claude 基于研究阶段的深度代码分析替代。

**后端核心问题**：
1. `provider_router.rs` 调用空壳 `list_providers()` → 永远返回空
2. `ProxyState` 无 Database 引用
3. 单一 fallback handler 不区分 API 类型
4. 12 个模块需从参考项目移植
5. 数据库 DAO 缺少 10+ 个参考项目需要的方法

## Gemini 分析摘要
Gemini 前端分析完成。关键发现：

**当前前端调用的 Tauri 命令**：
- `get_proxy_status` → 返回简单 ProxyState
- `get_proxy_config` / `save_proxy_config`
- `start_proxy` / `stop_proxy`

**前端文件清单**：
- `src/stores/useProxyStore.ts` — Zustand store，需适配新命令名
- `src/types/proxy.ts` — 类型定义，需扩展
- `src/components/proxy/ProxyStatus.tsx` — 状态展示
- `src/components/proxy/ProxyConfig.tsx` — 配置面板
- `src/components/proxy/CircuitBreakerPanel.tsx` — 熔断器（当前 Mock 数据）
- `src/components/proxy/FailoverQueue.tsx` — 故障转移队列

## 技术方案

### 核心策略
从参考项目 **逐文件移植**，按依赖层级分 3 层执行：
- Layer 1：基础模块（无依赖，可并行）
- Layer 2：核心逻辑（依赖 Layer 1）
- Layer 3：胶水层 + 前端适配（依赖 Layer 2）

### 关键技术决策
1. **保持 0.0.0.0 默认监听**（用户确认）
2. **ProxyState 重构**：从全局单例 → Axum State 注入 `Arc<Database>`
3. **路由分离**：按 API 类型分路由（Claude/Codex/Gemini）
4. **DAO 新增方法**：在现有 Database 上添加参考项目需要的方法
5. **前端命令名变更**：`start_proxy` → `start_proxy_server`，`stop_proxy` → `stop_proxy_with_restore`

---

## 子任务列表

### Task 1: 移植基础工具模块
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/proxy/error.rs` (重写 - 扩展错误类型)
  - `src-tauri/src/proxy/error_mapper.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/log_codes.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/session.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/body_filter.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/model_mapper.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/health.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/providers/auth.rs` (新建 - 从参考项目复制)
  - `src-tauri/src/proxy/providers/models/` (新建目录 - anthropic.rs, openai.rs, mod.rs)
- **依赖**: 无
- **实施步骤**:
  1. 从参考项目复制 error.rs 内容，适配当前项目的 import 路径
  2. 复制 error_mapper.rs, log_codes.rs, session.rs, body_filter.rs, model_mapper.rs, health.rs
  3. 复制 providers/auth.rs 和 providers/models/ 目录
  4. 所有文件需将 `crate::app_config::AppType` 改为 `crate::models::app_type::AppType`
  5. 将 `crate::provider::Provider` 改为 `crate::models::provider::Provider`
  6. 将 `crate::error::AppError` 改为 `crate::proxy::error::ProxyError` 或适配当前项目错误类型
- **验收标准**: `cargo check` 这些文件无编译错误

### Task 2: 数据库 DAO 扩展
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/database/dao/providers.rs` (扩展)
  - `src-tauri/src/database/dao/proxy_config.rs` (新建)
  - `src-tauri/src/database/dao/failover_queue.rs` (新建)
  - `src-tauri/src/database/dao/provider_health.rs` (新建)
  - `src-tauri/src/database/dao/mod.rs` (更新 - 添加新模块)
  - `src-tauri/src/database/schema.rs` (更新 - 添加新表)
- **依赖**: 无
- **实施步骤**:
  1. 在 schema.rs 中添加 `proxy_config`, `failover_queue`, `provider_health` 表
  2. 在 providers.rs 中添加按 app_type 过滤的查询方法：
     - `list_providers_by_app(app_type: &str) -> Vec<Provider>`
     - `get_provider_by_app(id: &str, app_type: &str) -> Option<Provider>`
     - `get_current_provider_id(app_type: &str) -> Option<String>` (查 is_active)
     - `set_current_provider(app_type: &str, id: &str)` (更新 is_active)
  3. 新建 proxy_config.rs 实现：
     - `get_proxy_config_for_app(app_type: &str) -> AppProxyConfig`（async）
     - `update_proxy_config_for_app(config: AppProxyConfig)`（async）
     - `get_global_proxy_config() -> GlobalProxyConfig`
     - `update_global_proxy_config(config: GlobalProxyConfig)`
     - `get_rectifier_config() -> RectifierConfig`
  4. 新建 failover_queue.rs 实现：
     - `get_failover_queue(app_type: &str) -> Vec<FailoverQueueItem>`
     - `add_to_failover_queue(app_type: &str, provider_id: &str)`
  5. 新建 provider_health.rs 实现：
     - `update_provider_health_with_threshold(...)`
     - `get_proxy_flags_sync(app_type: &str) -> (bool, bool)`
     - `set_proxy_flags_sync(app_type: &str, enabled: bool, failover: bool)`
- **验收标准**: `cargo check` 编译通过，新方法可从 Database 实例调用

### Task 3: types.rs 扩展 + ProxyState 重构
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/proxy/types.rs` (重写)
- **依赖**: 无
- **实施步骤**:
  1. 保留现有类型（已有 AppProxyConfig, RectifierConfig 等）
  2. 添加缺失的类型：ProxyConfig(listen_address/listen_port), ProxyStatus, ProxyServerInfo, ProxyTakeoverStatus, ActiveTarget, ProviderHealth, LiveBackup, GlobalProxyConfig
  3. 保留旧 ProxyState 为 ProxyStatusSimple（兼容过渡）
  4. 确保所有类型实现 Serialize/Deserialize
- **验收标准**: 编译通过

### Task 4: 核心转发模块移植
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/proxy/handler_context.rs` (新建)
  - `src-tauri/src/proxy/handler_config.rs` (新建)
  - `src-tauri/src/proxy/response_handler.rs` (新建)
  - `src-tauri/src/proxy/response_processor.rs` (新建)
  - `src-tauri/src/proxy/forwarder.rs` (新建 - 这是不存在的文件，当前只有 provider_router)
- **依赖**: Task 1 (error/session/body_filter), Task 2 (DAO), Task 3 (types)
- **实施步骤**:
  1. 从参考项目复制 handler_context.rs，适配 import 路径
  2. 复制 handler_config.rs（各 API 解析配置）
  3. 复制 response_handler.rs + response_processor.rs（响应处理+流式支持）
  4. 复制 forwarder.rs（核心转发+重试+熔断器集成）
  5. 适配所有 import：AppType, Provider, Database, ProxyError 路径
- **验收标准**: 编译通过

### Task 5: server.rs + handlers.rs + provider_router.rs 重写
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/proxy/server.rs` (重写)
  - `src-tauri/src/proxy/handlers.rs` (重写)
  - `src-tauri/src/proxy/provider_router.rs` (重写)
  - `src-tauri/src/proxy/http_client.rs` (微调 - 添加 set_proxy_port)
  - `src-tauri/src/proxy/mod.rs` (更新 - 添加所有新模块声明)
- **依赖**: Task 4 (forwarder/handler_context/response_processor)
- **实施步骤**:
  1. 重写 server.rs：
     - ProxyState struct 包含 Arc<Database>, ProviderRouter, FailoverSwitchManager
     - ProxyServer struct 包含 config, state, shutdown_tx, server_handle
     - build_router() 分路由注册
     - start/stop 生命周期
  2. 重写 handlers.rs：
     - handle_messages (Claude /v1/messages)
     - handle_chat_completions (Codex /v1/chat/completions)
     - handle_responses (Codex /v1/responses)
     - handle_gemini (Gemini /v1beta/*)
  3. 重写 provider_router.rs：
     - select_providers() 从数据库查询 + 熔断器过滤
     - allow_provider_request/record_result 接口
  4. 在 http_client.rs 添加 set_proxy_port()
  5. 更新 mod.rs 声明所有新模块
- **验收标准**: `cargo check` 编译通过

### Task 6: proxy_service + proxy_commands 重写
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/proxy_service.rs` (重写)
  - `src-tauri/src/commands/proxy_commands.rs` (重写)
  - `src-tauri/src/lib.rs` (更新 - 修改 generate_handler 注册)
  - `src-tauri/src/store.rs` (更新 - AppState 添加 proxy_server 字段)
- **依赖**: Task 5 (server)
- **实施步骤**:
  1. 在 store.rs 的 AppState 中添加 `proxy_server: Arc<RwLock<Option<ProxyServer>>>`
  2. 重写 proxy_service.rs：
     - start/stop 使用 AppState 中的 ProxyServer
     - get_status/get_config/update_config
     - takeover 管理（备份/恢复 Live 配置）
  3. 重写 proxy_commands.rs：
     - `start_proxy_server(state)` — 传 AppState
     - `stop_proxy_with_restore(state)` — 停止+恢复
     - `get_proxy_status(state)` — 返回详细状态
     - `get_proxy_config(state)` / `update_proxy_config(state, config)`
     - `get_proxy_takeover_status(state)` / `set_proxy_takeover_for_app(state, app_type, enabled)`
     - 全局/应用级配置命令
     - 熔断器管理命令
  4. 在 lib.rs 的 generate_handler! 中注册新命令，移除旧命令
- **验收标准**: `cargo build` 完整编译通过

### Task 7: 前端适配
- **类型**: 前端
- **文件范围**:
  - `src/types/proxy.ts` (更新)
  - `src/stores/useProxyStore.ts` (重写)
  - `src/components/proxy/ProxyStatus.tsx` (更新)
  - `src/components/proxy/ProxyConfig.tsx` (更新)
  - `src/components/proxy/CircuitBreakerPanel.tsx` (更新)
- **依赖**: Task 6 (新命令已注册)
- **实施步骤**:
  1. 更新 types/proxy.ts：
     - ProxyStatus 扩展字段（success_rate, failover_count, active_targets 等）
     - 新增 ProxyTakeoverStatus, AppProxyConfig, GlobalProxyConfig 类型
  2. 重写 useProxyStore.ts：
     - `start_proxy` → `start_proxy_server`
     - `stop_proxy` → `stop_proxy_with_restore`
     - `save_proxy_config` → `update_proxy_config`
     - 新增 takeover 状态管理方法
  3. 更新 ProxyStatus.tsx 展示详细信息
  4. 更新 CircuitBreakerPanel.tsx 对接真实数据
- **验收标准**: `npm run build` 编译通过

---

## 文件冲突检查

✅ 无冲突 — 每个 Task 的文件范围完全隔离：
- Task 1: proxy 工具模块（新建文件）
- Task 2: database/dao（数据库层）
- Task 3: proxy/types.rs（单文件）
- Task 4: proxy 核心模块（新建文件）
- Task 5: proxy server/handlers/router（核心重写）
- Task 6: services/commands/lib.rs（胶水层）
- Task 7: src/ 前端文件

⚠️ 跨 Task 依赖通过 Layer 分组解决。

## 并行分组

```
Layer 1 (并行): Task 1, Task 2, Task 3
  ↓
Layer 2 (依赖 Layer 1): Task 4
  ↓
Layer 3 (依赖 Layer 2): Task 5
  ↓
Layer 4 (依赖 Layer 3): Task 6
  ↓
Layer 5 (依赖 Layer 4): Task 7
```

**最大并行度**: Layer 1 可用 3 个 Builder 并行

## 编译检查点

| 检查点 | 时机 | 命令 |
|--------|------|------|
| CP1 | Layer 1 完成 | `cargo check` |
| CP2 | Task 4 完成 | `cargo check` |
| CP3 | Task 5 完成 | `cargo check` |
| CP4 | Task 6 完成 | `cargo build` |
| CP5 | Task 7 完成 | `npm run build` |
