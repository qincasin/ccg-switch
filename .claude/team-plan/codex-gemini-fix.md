# Team Plan: codex-gemini-fix

## 概述
修复 claude-switch-1.0 中 Codex 和 Gemini 配置切换无效的 bug：`sync_to_generic_settings` 写错了文件路径和格式。

## 根因分析
`provider_service.rs` 的 `sync_to_generic_settings` 函数：
- Codex：写 `~/.codex/codex.json`，键名 `CODEX_AUTH_TOKEN` → **错误**
- Gemini：写 `~/.gemini/gemini.json`，键名 `GEMINI_AUTH_TOKEN` → **错误**

正确应参考 cc-switch 实现：
- Codex：写 `~/.codex/auth.json`（JSON，含 `OPENAI_API_KEY`）+ `~/.codex/config.toml`（TOML）
- Gemini：写 `~/.gemini/.env`（KEY=VALUE）+ `~/.gemini/settings.json`（设 `security.auth.selectedType`）

## 子任务列表

### Task 1: 修复 provider_service.rs 配置同步逻辑
- **类型**: 后端（Rust）
- **文件范围**:
  - `claude-switch-1.0/src-tauri/src/services/provider_service.rs`
- **依赖**: 无
- **实施步骤**:
  1. 在 `sync_provider_to_app_config` 中新增 Codex/Gemini 分支，替换通用的 `_ => sync_to_generic_settings(provider)` 为：
     ```rust
     AppType::Codex => sync_to_codex_config(provider),
     AppType::Gemini => sync_to_gemini_config(provider),
     _ => sync_to_generic_settings(provider),
     ```
  2. 新增 `sync_to_codex_config(provider)` 函数：
     - 创建 `~/.codex/` 目录
     - 写 `~/.codex/auth.json` = `{"OPENAI_API_KEY": "<api_key>"}`
     - 若 `provider.url` 有值，写 `~/.codex/config.toml`：
       ```toml
       model_provider = "newapi"
       model = "<default_sonnet_model 或 o4-mini>"

       [model_providers.newapi]
       name = "Custom"
       base_url = "<normalized_url>"
       wire_api = "responses"
       requires_openai_auth = true
       ```
     - URL 规范化：若只有 host 则追加 `/v1`，若已有 `/v1` 则保留
  3. 新增 `sync_to_gemini_config(provider)` 函数：
     - 创建 `~/.gemini/` 目录
     - 写 `~/.gemini/.env`（KEY=VALUE 格式，每行一个）：
       - `GOOGLE_GEMINI_BASE_URL=<url>`（若 url 有值）
       - `GEMINI_API_KEY=<api_key>`
       - `GEMINI_MODEL=<default_sonnet_model>`（若有值）
     - 写 `~/.gemini/settings.json`：保留现有内容，仅更新 `security.auth.selectedType = "gemini-api-key"`
  4. 新增 `normalize_codex_base_url(url: &str) -> String` 辅助函数
- **验收标准**:
  - 切换 Codex 类型的 provider 后，`~/.codex/auth.json` 存在且含 `OPENAI_API_KEY`
  - 切换 Codex 类型的 provider 后，`~/.codex/config.toml` 存在且含 `model_provider = "newapi"` 和正确的 `base_url`
  - 切换 Gemini 类型的 provider 后，`~/.gemini/.env` 存在且含 `GEMINI_API_KEY`
  - 切换 Gemini 类型的 provider 后，`~/.gemini/settings.json` 中 `security.auth.selectedType = "gemini-api-key"`
  - Claude 类型切换行为不受影响
  - `cargo check` 无编译错误

## 文件冲突检查
✅ 无冲突
- Task 1: provider_service.rs（唯一修改文件）

## 并行分组
- **Layer 1（单任务）**: Task 1
