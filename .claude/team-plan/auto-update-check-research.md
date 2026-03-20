# Team Research: auto-update-check

## 增强后的需求

**目标**: 为 CCG Switch (Tauri 2 桌面应用) 添加定时自动检测更新机制。

**功能规格**:
1. **定时检查**: 应用启动后根据配置自动检查 GitHub Release 更新，默认每 24 小时检查一次
2. **用户通知**: 发现新版本时，在应用内显示全局 Toast 通知（不阻断操作），点击可跳转到设置页关于标签
3. **可配置性**: 设置页提供开关 + 检查间隔下拉（预设: 1/6/12/24/48/72 小时），支持完全关闭
4. **配置持久化**: 更新检查配置存入现有 Config 模型（数据库 app_configs 表）

**技术约束**:
- 后端定时器采用现有 `spawn + loop + sleep` 模式，每次唤醒读取最新配置
- 配置变更"下一次轮询时生效"（不需要热重建定时器）
- 启动时立即检查一次（参照已有的 backup 模式）
- 后台检查发现新版本时通过 Tauri event 推送前端
- 同一版本只推送一次通知（记录 `lastCheckedVersion`）

**范围边界**:
- 不修改现有手动检查更新的逻辑
- 不引入新的第三方依赖
- 不实现定时器动态取消/重建

## 约束集

### 硬约束
- [HC-1] Config 新增字段必须带 `#[serde(default = "...")]`，否则旧 `app_config` JSON 反序列化失败导致应用启动报错 — 来源: Codex
- [HC-2] 前端 `Config` interface (`src/types/config.ts`) 必须与后端 `Config` struct (`src-tauri/src/models/config.rs`) 字段同步 — 来源: Codex + Gemini
- [HC-3] `save_config_to_db()` 是整对象覆盖保存，前端保存时必须传完整 Config，否则丢字段 — 来源: Codex
- [HC-4] 现有 `check_update()` 不接收 `AppHandle`，后台任务需要包装函数来 emit 事件 — 来源: Codex
- [HC-5] Tauri 事件名必须用 kebab-case（现有风格: `update-download-progress`, `tool-versions-updated`） — 来源: Codex
- [HC-6] 现有 Toast 组件不支持 onClick 跳转，需扩展 `ToastProps` — 来源: Gemini
- [HC-7] Settings 页面不支持通过 URL 参数定位到特定 Tab，需修改逻辑支持跳转到"关于"Tab — 来源: Gemini

### 软约束
- [SC-1] 配置数据库化惯例: 完整 JSON 放 `app_configs.value`，运行时元数据（如 lastCheckTime）可独立 key 存储 — 来源: Codex
- [SC-2] 定时任务现有模式是固定频率轮询（每小时醒一次检查是否该执行），不是精确调度 — 来源: Codex
- [SC-3] DTO 使用 struct-level `#[serde(rename_all = "camelCase")]`，Config 字段使用字段级 `#[serde(rename = "...")]` — 来源: Codex
- [SC-4] i18n 翻译 key 命名规范: `settings.xxx`，支持 `defaultValue` 内联 fallback — 来源: Gemini
- [SC-5] 组件使用 PascalCase 命名，样式使用 Tailwind CSS + DaisyUI — 来源: Gemini

### 依赖关系
- [DEP-1] `models/config.rs` → `types/config.ts`: Rust Config 新增字段后，前端类型必须同步更新
- [DEP-2] `config_service.rs` → `database/dao/app_configs.rs`: 配置读写依赖 `get_app_config`/`set_app_config`
- [DEP-3] `lib.rs` setup → `updater_service.rs`: 定时器在 setup 中启动，调用 updater_service 的检查函数
- [DEP-4] `lib.rs` setup → `config_service.rs`: 定时器每次唤醒需读取最新 Config 获取检查间隔
- [DEP-5] `useAboutStore` → `check_for_updates` command: 手动检查走 invoke，自动检查走 event 监听
- [DEP-6] `App.tsx` → `useAboutStore` + `useConfigStore`: 启动时初始化事件监听器
- [DEP-7] Toast 组件 → react-router-dom: 点击 Toast 需要 `navigate('/settings')` 跳转

### 风险
- [RISK-1] 旧数据反序列化失败 — 缓解: 所有新增字段使用 `serde(default)` + 前端可选字段 `?:`
- [RISK-2] 启动首次 event 可能丢失（前端监听器初始化晚于后端 emit） — 缓解: 后台任务延迟 3-5 秒后再首次检查，或前端主动 invoke 一次
- [RISK-3] GitHub API 限流/网络故障导致后台持续报错 — 缓解: 错误静默处理（tracing::warn），不 emit 错误事件给前端
- [RISK-4] setInterval 内存泄漏 — 缓解: 前端定时器不需要（后端负责调度），前端只监听事件

## 成功判据
- [OK-1] 旧版本升级后，应用能正常启动并加载配置（新字段取默认值）
- [OK-2] 应用启动 3-5 秒后自动执行首次更新检查（如果自动检查已开启且到达间隔）
- [OK-3] 后台定时检查发现新版本时，前端收到 `auto-update-available` 事件并弹出 Toast
- [OK-4] Toast 通知可点击，点击后跳转到 Settings 页面并自动切换到"关于"Tab
- [OK-5] 设置页显示"自动检查更新"开关 + 间隔下拉框，修改后保存到数据库
- [OK-6] 关闭自动检查后，后台不再发起 GitHub 请求
- [OK-7] 手动"检查更新"按钮功能不受影响
- [OK-8] 同一版本号在一个运行周期内只 Toast 通知一次

## 开放问题（已解决）
- Q1: 通知位置？ → A: 全局 Toast 通知 → 约束: [HC-6]
- Q2: 间隔粒度？ → A: 小时级预设 (1/6/12/24/48/72) → 约束: Config 新增 `checkUpdateIntervalHours: u32`
- Q3: 支持关闭？ → A: 支持 → 约束: Config 新增 `autoCheckUpdate: bool`
- Q4: "关闭"以哪个字段为准？ → A: `autoCheckUpdate: bool` 为开关，`checkUpdateIntervalHours` 仅在开启时生效 → 决策: 两字段独立
- Q5: 配置并入 Config 还是独立 key？ → A: 并入 Config 主对象（用户需求明确），运行时元数据 `lastCheckTime` 独立存 key → 约束: [SC-1]
- Q6: 配置变更后生效时机？ → A: 下一次轮询时生效，不需要热重建定时器 → 约束: 无需 AppState 持有定时器句柄
- Q7: 启动是否立即检查？ → A: 是，延迟 3-5 秒后执行首次检查 → 缓解: [RISK-2]
- Q8: 后台检查是否每次都 emit？ → A: 仅"新版本首次发现"时 emit，使用 lastCheckedVersion 去重 → 约束: [OK-8]

## 新增字段设计（预览）

### Rust Config (src-tauri/src/models/config.rs)
```rust
#[serde(default = "default_auto_check_update", rename = "autoCheckUpdate")]
pub auto_check_update: bool,  // 默认 true

#[serde(default = "default_check_update_interval", rename = "checkUpdateIntervalHours")]
pub check_update_interval_hours: u32,  // 默认 24
```

### TypeScript Config (src/types/config.ts)
```typescript
autoCheckUpdate?: boolean;       // 默认 true
checkUpdateIntervalHours?: number; // 默认 24
```

### 新 Tauri Event
- `auto-update-available` — payload: `UpdateInfo`（复用现有结构）

### 新数据库 Key
- `update_check_last_run` — 值: Unix timestamp 字符串（存入 app_configs 表）
