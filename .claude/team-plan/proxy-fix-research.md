# Team Research: 反代功能修复（参考项目对齐）

## 增强后的需求

**目标**：修复 CCG Switch 的反代功能，使其他机器能通过代理服务访问 Claude/Codex/Gemini API。
**参考实现**：`C:\guodevelop\demo\cc-switch` 的完整反代架构。

## 约束集

### 硬约束
- [HC-1] 当前 `provider_service::list_providers()` 是空壳，返回 `Ok(vec![])` — 来源：代码分析
- [HC-2] 当前 `ProxyState` 无 `Database` 引用，无法查询数据库 — 来源：代码分析
- [HC-3] 当前使用 `fallback(any(...))` 单一 handler，无法区分 Claude/Codex/Gemini 请求 — 来源：代码分析
- [HC-4] 参考项目使用 `axum::extract::State<ProxyState>` 架构，ProxyState 持有 `Arc<Database>` — 来源：cc-switch
- [HC-5] 参考项目按 API 类型分路由：`/v1/messages`(Claude), `/v1/chat/completions`(Codex), `/v1beta/*`(Gemini) — 来源：cc-switch
- [HC-6] 当前项目已有 `providers/` 子模块（adapter、transform、streaming），但 handler 没有使用 — 来源：代码分析
- [HC-7] 当前 `proxy_commands.rs` 的 `start_proxy` 不传入 AppState/Database — 来源：代码分析

### 软约束
- [SC-1] 当前项目 types.rs 已定义了许多参考项目相同的类型（AppProxyConfig, RectifierConfig 等） — 来源：代码分析
- [SC-2] 当前项目 mod.rs 缺少部分参考项目模块（handler_context, handler_config, response_processor, response_handler, session, log_codes, body_filter, error_mapper, model_mapper） — 来源：代码分析
- [SC-3] 前端 ProxyPanel 组件已支持故障转移队列 UI — 来源：代码分析

### 依赖关系
- [DEP-1] server.rs 重写 → handlers.rs 重写 → provider_router.rs 重写
- [DEP-2] proxy_commands.rs 改为传入 AppState → start_proxy 接收 Database
- [DEP-3] forwarder.rs 需要 → handler_context.rs, response_processor.rs

### 风险
- [RISK-1] 大量文件从参考项目移植可能引入编译错误 — 缓解：逐模块移植+编译验证
- [RISK-2] 数据库 schema 差异可能导致 DAO 方法缺失 — 缓解：检查并补全 database 模块

## 成功判据
- [OK-1] 代理启动后，别的机器通过 `http://<本机IP>:9876/v1/messages` 可正常访问 Claude API
- [OK-2] 代理启动后，`/v1/chat/completions` 可正常转发到 Codex provider
- [OK-3] 代理启动后，`/v1beta/*` 可正常转发到 Gemini provider
- [OK-4] `/health` 端点返回正常状态
- [OK-5] 故障转移队列中的 Provider 可按优先级自动切换
- [OK-6] `cargo build` 编译通过

## 实施计划

### 核心差异总结

| 文件 | 当前项目 | 参考项目 | 需要动作 |
|------|---------|---------|---------|
| proxy/server.rs | 全局单例，无State | ProxyServer struct + ProxyState(含DB) | **重写** |
| proxy/handlers.rs | 单一 fallback handler | 分路由：messages/chat/responses/gemini | **重写** |
| proxy/provider_router.rs | 调空壳函数 | 数据库查询+熔断器+故障转移 | **重写** |
| proxy/types.rs | 简单 ProxyState | 完整类型定义 | 已有大部分，微调 |
| proxy/error.rs | 5种错误 | 更多错误类型 | **对齐** |
| proxy/http_client.rs | 有基本功能 | 类似+代理端口检测 | 微调 |
| proxy/forwarder.rs | **不存在** | 完整转发+重试+熔断器 | **从参考移植** |
| proxy/handler_context.rs | **不存在** | 请求上下文管理 | **从参考移植** |
| proxy/handler_config.rs | **不存在** | 各API解析配置 | **从参考移植** |
| proxy/response_processor.rs | **不存在** | 响应处理+流式 | **从参考移植** |
| proxy/response_handler.rs | **不存在** | 响应处理辅助 | **从参考移植** |
| proxy/session.rs | **不存在** | Session ID管理 | **从参考移植** |
| proxy/log_codes.rs | **不存在** | 日志编码常量 | **从参考移植** |
| proxy/body_filter.rs | **不存在** | 请求体过滤 | **从参考移植** |
| proxy/error_mapper.rs | **不存在** | 错误映射 | **从参考移植** |
| proxy/model_mapper.rs | **不存在** | 模型名映射 | **从参考移植** |
| proxy/health.rs | **不存在** | 健康检查 | **从参考移植** |
| proxy/mod.rs | 基本导出 | 完整模块+公共导出 | **对齐** |
| services/proxy_service.rs | 简单启停 | 完整生命周期管理 | **参考重写** |
| commands/proxy_commands.rs | 不传AppState | 传AppState | **重写** |
