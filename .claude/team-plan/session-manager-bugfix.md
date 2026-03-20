# Team Plan: session-manager-bugfix

## 概述
修复 Codex 和 Gemini 两个 Provider 的会话扫描 Bug：Codex 目录遍历不够深，Gemini 消息格式假设错误。

## 研究基础
基于 `session-manager-bugfix-research.md` 的完整诊断，所有根因已通过代码审查 + 本地文件系统验证确认。

## 技术方案

### Bug 1 修复: Codex 递归扫描
- **当前**: `fs::read_dir(sessions_dir)` 只扫描顶层
- **实际**: 文件在 `YYYY/MM/DD/` 三级子目录下
- **方案**: 用递归函数遍历所有子目录，收集 `.jsonl` 文件

### Bug 2 修复: Gemini 消息格式适配
- **当前**: 假设 `role` + `parts[].text`（Gemini API 格式）
- **实际**: `type` + `content`（Gemini CLI 格式）
- **方案**:
  - `extract_title()`: `msg.get("role")` → `msg.get("type")`
  - 新增 `extract_content()`: 直接读 `content` 字符串，替代 `extract_parts_text()`
  - `load_gemini_messages()`: 角色映射改用 `type` 字段，跳过 `type === "info"`

## 子任务列表

### Task 1: Fix Codex recursive scanning
- **类型**: 后端
- **文件范围**: `src-tauri/src/session_manager/providers/codex.rs`
- **依赖**: 无
- **实施步骤**:
  1. 新增递归函数 `collect_jsonl_files(dir, files)`，遍历目录树收集所有 `.jsonl` 文件
  2. 替换 `scan_codex_sessions()` 中的 `fs::read_dir(&sessions_dir)` + `.jsonl` 过滤逻辑为调用 `collect_jsonl_files`
  3. 遍历收集到的文件列表，保留现有的 UUID 提取、session_meta 解析、消息提取逻辑不变
- **验收标准**:
  - 能扫描到 `~/.codex/sessions/2026/03/17/*.jsonl` 等嵌套文件
  - `cargo check` 通过

### Task 2: Fix Gemini message format
- **类型**: 后端
- **文件范围**: `src-tauri/src/session_manager/providers/gemini.rs`
- **依赖**: 无
- **实施步骤**:
  1. 修改 `extract_title()`: 将 `msg.get("role")` 改为 `msg.get("type")`，匹配 `"user"` 类型
  2. 删除 `extract_parts_text()` 函数，替换为直接读取 `msg.get("content").as_str()`
  3. 修改 `parse_session_file()` 中的 title 提取调用
  4. 修改 `load_gemini_messages()`:
     - 角色字段从 `msg.get("role")` 改为 `msg.get("type")`
     - 角色映射: `"user"` → `"user"`, `"model"` → `"assistant"`, `"info"` → 跳过
     - content 提取: 从 `extract_parts_text(msg)` 改为 `msg.get("content").as_str()`
     - ts 提取: 直接用 `msg.get("timestamp")`
- **验收标准**:
  - 能扫描到 Gemini 会话并正确提取标题
  - 能加载 Gemini 会话消息，type=info 的消息被跳过
  - `cargo check` 通过

## 文件冲突检查
✅ 无冲突 — 两个 Task 修改完全不同的文件

## 并行分组
- **Layer 1 (并行)**: Task 1 (codex.rs), Task 2 (gemini.rs)

## Builder 数量
- 2 个 Builder（并行），或 Lead 直接串行修复（改动量小，合计约 50 行）
