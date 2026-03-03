# Team Plan: codex-config-partial-update

## 概述
改造 `sync_to_codex_config`：`config.toml` 从全量替换改为 partial update（只更新 model/base_url），`auth.json` 逻辑不动。

## 技术方案
使用已有依赖 `toml = "0.8"`：
1. 读取现有 `~/.codex/config.toml`（若存在）
2. 解析为 `toml::Value`
3. 仅更新 `model_provider`、`model`（顶层）和 `model_providers.newapi.base_url`
4. 若 `model_providers.newapi` 段不存在则新建（含 `name`/`wire_api`/`requires_openai_auth` 默认值）
5. 序列化写回

## 子任务列表

### Task 1: 改造 sync_to_codex_config 的 config.toml 写入逻辑
- **类型**: 后端（Rust）
- **文件范围**:
  - `claude-switch-1.0/src-tauri/src/services/provider_service.rs`
- **依赖**: 无
- **实施步骤**:

  将 `sync_to_codex_config` 中 `config.toml` 的写入部分从全量字符串替换改为如下逻辑（只改这一段，auth.json 部分不动）：

  ```rust
  // config.toml: partial update（只更新 model 和 base_url）
  if let Some(ref url) = provider.url {
      let base_url = normalize_codex_base_url(url);
      let model = provider.default_sonnet_model.as_deref().unwrap_or("o4-mini");
      let config_path = codex_dir.join("config.toml");

      // 读取现有 config.toml，不存在则从空表开始
      let existing = if config_path.exists() {
          fs::read_to_string(&config_path).unwrap_or_default()
      } else {
          String::new()
      };

      let mut doc: toml::Value = if existing.is_empty() {
          toml::Value::Table(toml::Table::new())
      } else {
          toml::from_str(&existing)
              .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?
      };

      if let toml::Value::Table(ref mut t) = doc {
          // 更新顶层关键字段
          t.insert("model_provider".to_string(), toml::Value::String("newapi".to_string()));
          t.insert("model".to_string(), toml::Value::String(model.to_string()));

          // 更新 [model_providers.newapi] 中的 base_url
          let mp = t.entry("model_providers".to_string())
              .or_insert(toml::Value::Table(toml::Table::new()));
          if let toml::Value::Table(ref mut mp_table) = mp {
              let newapi = mp_table.entry("newapi".to_string())
                  .or_insert(toml::Value::Table(toml::Table::new()));
              if let toml::Value::Table(ref mut newapi_table) = newapi {
                  newapi_table.insert("base_url".to_string(), toml::Value::String(base_url));
                  // 若新建则补充默认字段，已存在则不覆盖
                  newapi_table.entry("name".to_string())
                      .or_insert(toml::Value::String("Custom".to_string()));
                  newapi_table.entry("wire_api".to_string())
                      .or_insert(toml::Value::String("responses".to_string()));
                  newapi_table.entry("requires_openai_auth".to_string())
                      .or_insert(toml::Value::Boolean(true));
              }
          }
      }

      let toml_str = toml::to_string_pretty(&doc)
          .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
      fs::write(&config_path, toml_str.as_bytes())?;
  }
  ```

- **验收标准**:
  - `auth.json` 写入逻辑不变（全量覆盖 `{"OPENAI_API_KEY": "..."}`）
  - 现有 `config.toml` 中非 `model`/`model_provider`/`base_url` 字段（如 `model_reasoning_effort`、`disable_response_storage`）保留不变
  - 若 `config.toml` 不存在，能正确创建含所有必要字段的新文件
  - `cargo check` 无编译错误

## 文件冲突检查
✅ 无冲突

## 并行分组
- **Layer 1（单任务）**: Task 1
