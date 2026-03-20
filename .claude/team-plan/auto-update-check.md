# Team Plan: auto-update-check

## 概述
为 CCG Switch 添加定时自动检测更新机制：后端定时检查 GitHub Release + 前端 Toast 通知 + 设置页配置 UI。

## Codex 分析摘要
- **Config 扩展**: 新增 `auto_check_update: bool` (默认 true) + `check_update_interval_hours: u32` (默认 24)，使用字段级 `serde(default)` + `rename` 保证旧数据兼容
- **核心函数**: `check_update_and_emit(app, db)` — 读取 Config 判断开关 → 读取 `update_check_last_run` 判断间隔 → 调用 `check_update()` → 写入 last_run → 去重 emit
- **去重机制**: 模块级 `static LAST_EMITTED_VERSION: Lazy<RwLock<Option<String>>>` 记录已推送版本，同一版本只 emit 一次
- **定时器**: 在 lib.rs setup 中 `spawn + loop`，启动延迟 5 秒，每次唤醒后重新读取 Config 获取间隔，`interval_hours.max(1)` 防止 busy loop
- **事件**: `auto-update-available`，payload 复用 `UpdateInfo`

## Gemini 分析摘要
- **Toast 扩展**: `ToastProps` 新增 `onClick?: () => void`，点击时触发回调并关闭 Toast，关闭按钮 `e.stopPropagation()` 防冲突
- **showToast 签名**: 新增第4参数 `onClick?: () => void`
- **App.tsx 监听**: `useEffect` 中 `listen<UpdateInfo>('auto-update-available', ...)` → `showToast(msg, 'info', 8000, () => navigate)`
- **Settings Tab 定位**: `useSearchParams` 读取 `?tab=about`，`handleTabChange` 同步 URL
- **配置 UI**: 通用 Tab 新增卡片 — toggle 开关 + select 下拉 (1/6/12/24/48/168h)
- **i18n**: zh/en 各 6 个设置 key + `about.update_available` 顶层 key

## 技术方案

### 后端（以 Codex 方案为准）
1. `models/config.rs` — 新增 2 个字段 + 2 个默认值函数 + Default impl
2. `services/updater_service.rs` — 新增 `check_update_and_emit()` + `should_check_update()` + 常量 + 去重变量
3. `lib.rs` setup — 新增自动更新检查 spawn 块（backup 定时器后面）

### 前端（以 Gemini 方案为准，已由 Gemini 直接实现）
1. `types/config.ts` — 新增 2 个可选字段 ✅ (已改)
2. `Toast.tsx` — 扩展 onClick 支持 ✅ (已改)
3. `ToastContainer.tsx` — showToast 新增 onClick 参数 ✅ (已改)
4. `App.tsx` — 监听 auto-update-available 事件 ✅ (已改)
5. `Settings.tsx` — URL tab 定位 + 自动更新配置 UI ✅ (已改)
6. `locales/zh.json + en.json` — 翻译 key ✅ (已改)

### 需要修正的前端问题
- App.tsx 中 `info.version` 应改为 `info.latestVersion`（UpdateInfo 结构体字段名）
- Settings.tsx 中 `autoCheckUpdate` 默认值应为 `true`（`config?.autoCheckUpdate ?? true` 而非 `?? false`）
- Settings.tsx 间隔选项缺少 72 小时，多了 168（需求预设是 1/6/12/24/48/72）

## 子任务列表

### Task 1: 后端 Config 模型扩展
- **类型**: 后端 (Rust)
- **文件范围**: `src-tauri/src/models/config.rs`
- **依赖**: 无
- **实施步骤**:
  1. 新增 `default_auto_check_update() -> bool` 返回 `true`
  2. 新增 `default_check_update_interval_hours() -> u32` 返回 `24`
  3. Config struct 新增 `auto_check_update: bool` 带 `serde(default, rename)`
  4. Config struct 新增 `check_update_interval_hours: u32` 带 `serde(default, rename)`
  5. Default impl 补充两个新字段
- **验收标准**: `cargo check` 通过，旧 JSON 反序列化不报错

### Task 2: 后端自动更新检查服务
- **类型**: 后端 (Rust)
- **文件范围**: `src-tauri/src/services/updater_service.rs`
- **依赖**: Task 1 (Config 字段)
- **实施步骤**:
  1. 新增 imports: `crate::database::Database`, `crate::services::config_service`, `chrono::Utc`, `once_cell::sync::Lazy`, `std::sync::Arc`, `tokio::sync::RwLock`
  2. 新增常量 `AUTO_UPDATE_AVAILABLE_EVENT`, `UPDATE_CHECK_LAST_RUN_KEY`
  3. 新增 `static LAST_EMITTED_VERSION: Lazy<RwLock<Option<String>>>`
  4. 新增 `should_check_update(last_run, interval_hours) -> Result<bool>`
  5. 新增 `check_update_and_emit(app, db) -> Result<()>` — 完整逻辑见 Codex 方案
- **验收标准**: `cargo check` 通过，函数签名与 lib.rs 调用匹配

### Task 3: 后端定时器注册
- **类型**: 后端 (Rust)
- **文件范围**: `src-tauri/src/lib.rs`
- **依赖**: Task 2 (check_update_and_emit 函数)
- **实施步骤**:
  1. 在 backup 定时器块之后新增更新检查 spawn 块
  2. clone `app.handle()` 和 `db_for_backup`
  3. 延迟 5 秒后进入 loop
  4. 每次循环调用 `check_update_and_emit`，错误 `tracing::warn`
  5. 读取最新 Config 获取 `check_update_interval_hours.max(1)`，sleep 对应秒数
- **验收标准**: `cargo check` 通过，应用启动 5 秒后日志可见检查行为

### Task 4: 前端修正与完善
- **类型**: 前端 (TypeScript/React)
- **文件范围**: `src/App.tsx`, `src/pages/Settings.tsx`
- **依赖**: 无（已有改动基础上修正）
- **实施步骤**:
  1. App.tsx: `info.version` → `info.latestVersion`（匹配 UpdateInfo 类型）
  2. Settings.tsx: `config?.autoCheckUpdate ?? false` → `config?.autoCheckUpdate ?? true`
  3. Settings.tsx: 间隔选项改为 1/6/12/24/48/72（去掉 168，加上 72）
- **验收标准**: TypeScript 编译通过，UI 默认开启自动检查，间隔选项符合需求

## 文件冲突检查
- Task 1: `models/config.rs` — 独占 ✅
- Task 2: `services/updater_service.rs` — 独占 ✅
- Task 3: `lib.rs` — 独占 ✅
- Task 4: `App.tsx` + `Settings.tsx` — 独占 ✅

✅ 无冲突

## 并行分组
- **Layer 1 (并行)**: Task 1, Task 4
- **Layer 2 (依赖 Task 1)**: Task 2
- **Layer 3 (依赖 Task 2)**: Task 3

## Builder 数量
- Layer 1: 2 Builders (后端 Config + 前端修正)
- Layer 2: 1 Builder (updater service)
- Layer 3: 1 Builder (lib.rs 定时器)

总计: 最多 2 并行 Builder，3 层串行
