# Team Research: session-manager-bugfix

## 增强后的需求
session_manager 多平台会话扫描功能实现后，Codex 和 Gemini 两个 Provider 无法扫描到本地会话数据。用户通过 UI 测试发现，本地确实存在两个平台的会话数据文件，但 `list_sessions` 返回的结果中缺少这两个平台的会话。

## 约束集

### 硬约束
- [HC-1] Codex 会话目录结构为 `~/.codex/sessions/YYYY/MM/DD/*.jsonl`（按年月日嵌套），不是 `~/.codex/sessions/*.jsonl`（扁平结构） — 来源：本地文件系统验证
- [HC-2] Codex 文件名格式为 `rollout-YYYY-MM-DDTHH-MM-SS-<UUID>.jsonl`，UUID 在文件名尾部 — 来源：本地文件系统验证
- [HC-3] Gemini CLI 会话 JSON 消息格式使用 `type` + `content` 字段，不是 `role` + `parts` 字段 — 来源：本地 session JSON 文件内容验证
- [HC-4] Gemini 消息 type 值包括 "user"、"model"、"info"（info 为系统通知消息，应跳过） — 来源：本地文件验证
- [HC-5] Gemini 消息 content 是纯字符串，不是 `[{text: "..."}]` 数组 — 来源：本地文件验证
- [HC-6] Gemini 目录结构 `~/.gemini/tmp/` 下除了 hash 目录外，还有命名目录（如 `administrator/`, `ccg-switch/`），这些也可能包含 chats — 来源：本地文件系统验证

### 软约束
- [SC-1] Codex `session_meta` 行的 payload 包含 `cwd` 字段，格式正确 — 来源：验证
- [SC-2] Gemini session JSON 顶层包含 `sessionId`, `startTime`, `lastUpdated` 字段，格式符合 RFC3339 — 来源：验证

### 依赖关系
无跨模块依赖，两个 bug 完全独立可并行修复。

### 风险
- [RISK-1] Gemini `~/.gemini/tmp/` 下的命名目录（非 hash）可能有不同结构 — 缓解：统一遍历所有子目录的 `chats/` 文件夹

## 成功判据
- [OK-1] `list_sessions` 返回结果中包含 Codex 会话（providerId === "codex"）
- [OK-2] `list_sessions` 返回结果中包含 Gemini 会话（providerId === "gemini"）
- [OK-3] 点击 Provider 筛选标签 "Codex" 时仅显示 Codex 会话
- [OK-4] 点击 Provider 筛选标签 "Gemini" 时仅显示 Gemini 会话
- [OK-5] 点击 Gemini 会话能正确加载对话消息
- [OK-6] `cargo check` 通过

## Bug 详细分析

### Bug 1: Codex 扫描无结果
**文件**: `src-tauri/src/session_manager/providers/codex.rs:22`
**根因**: `fs::read_dir(&sessions_dir)` 只读取 `~/.codex/sessions/` 顶层目录。顶层包含的是 `2025/`、`2026/` 年份目录（非 .jsonl 文件），全部被 line 32-34 的 `.jsonl` 扩展名检查跳过。
**修复**: 将扁平 `read_dir` 替换为递归目录遍历，深入 `YYYY/MM/DD/` 子目录查找 `.jsonl` 文件。

### Bug 2: Gemini 消息格式不匹配
**文件**: `src-tauri/src/session_manager/providers/gemini.rs`
**根因**: 代码假设 Gemini API 消息格式（`role` + `parts[].text`），但 Gemini CLI 实际使用完全不同的格式（`type` + `content` 字符串）。
- `extract_title()` L28: `msg.get("role")` 应为 `msg.get("type")`
- `extract_parts_text()` L43: 查找 `parts` 数组 → 应直接用 `content` 字符串
- `load_gemini_messages()` L186-193: 角色映射基于 `role` 字段 → 应基于 `type` 字段
- `type === "info"` 的消息应被跳过（系统通知，非对话消息）

**实际格式**:
```json
{
  "id": "...",
  "timestamp": "2026-01-20T09:13:31.607Z",
  "type": "user",
  "content": "消息文本（纯字符串）"
}
```

## 开放问题（已解决）
无开放问题。
