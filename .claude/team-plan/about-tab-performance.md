# Team Plan: about-tab-performance

## 概述
优化 Settings 页面 About 标签页首次打开卡顿问题（1-2秒→<300ms），通过后端磁盘缓存+事件推送、前端 Zustand Store+组件拆分+骨架屏实现。

## Codex 分析摘要
- **根因确认**: `join_all` 等待 4 个工具的 `cmd /C <tool> --version`（Windows 进程创建 ~200-500ms×4）+ 网络请求（10s 超时），全部完成后才返回
- **推荐方案**: "stale-while-revalidate" 模式 — 优先返回内存/磁盘缓存，后台刷新完成后通过 Tauri 事件推送更新
- **关键改动**:
  1. `tool_version_service.rs`: 新增 `load_persisted_cache()` / `save_persisted_cache()` 磁盘持久化
  2. `tool_version_service.rs`: 真实检测逻辑放入 `tokio::spawn`，刷新完成后 emit 事件
  3. `lib.rs`: `get_tool_versions` 命令注入 `AppHandle` 用于 emit
- **风险**: 缓存一致性（用 updatedAt 去重）、磁盘缓存损坏（fallback 到空态+触发刷新）

## Gemini 分析摘要
- **根因确认**: 条件渲染导致每次切换重新挂载 + 454 行大组件阻塞主线程 + 无状态持久化
- **推荐方案**: Zustand Store 缓存 + 组件原子化拆分 + 骨架屏
- **关键改动**:
  1. 新建 `useAboutStore.ts`: 全局状态管理，5 分钟前端缓存，持久化下载进度
  2. `AboutPanel.tsx` 拆分为 5 个子组件: VersionInfoCard, UpdateBanner, ToolStatusGrid, ToolStatusCard, InstallCommandPanel
  3. 骨架屏使用 DaisyUI `skeleton` 类保持视觉一致性
- **交互要点**: 渐进式披露、skeleton 尺寸匹配防止 CLS、copy 操作反馈

## 技术方案

### 核心策略: "stale-while-revalidate" + 全局 Store

```
用户点击 About Tab
  ↓
useAboutStore.fetchToolVersions()
  ↓ (检查 store 缓存: lastFetchTime < 5min?)
  ├── 命中缓存 → 直接渲染（<50ms）
  └── 未命中 → invoke('get_tool_versions')
                  ↓ (后端检查内存缓存)
                  ├── 内存缓存命中 → 立即返回
                  └── 内存缓存 miss → 检查磁盘缓存
                      ├── 磁盘缓存命中 → 立即返回旧数据 + tokio::spawn 后台刷新
                      └── 磁盘缓存 miss → 返回空 + tokio::spawn 后台刷新
                          ↓
                      后台刷新完成 → emit('tool-versions-updated') → 前端 store 更新
```

### 预热机制
App.tsx 空闲时触发 `useAboutStore.getState().fetchToolVersions()`，确保用户进入 About 前数据已就绪。

## 子任务列表

### Task 1: 后端磁盘缓存 + Stale-While-Revalidate + 事件推送
- **类型**: 后端 (Rust)
- **文件范围**:
  - `src-tauri/src/services/tool_version_service.rs` (修改)
  - `src-tauri/src/lib.rs` (修改 `get_tool_versions` 命令签名)
- **依赖**: 无
- **实施步骤**:
  1. 在 `tool_version_service.rs` 新增磁盘缓存函数:
     - `fn cache_file_path() -> PathBuf` — 返回 `~/.ccg-switch/tool_versions_cache.json`
     - `fn load_persisted_cache() -> Option<Vec<ToolVersion>>` — 读取磁盘缓存（JSON 反序列化）
     - `fn save_persisted_cache(data: &[ToolVersion])` — 写入磁盘缓存
  2. 修改 `get_tool_versions()` 函数签名，新增 `app_handle: Option<tauri::AppHandle>` 参数
  3. 在 `get_tool_versions()` 内存缓存 miss 时:
     - 尝试读取磁盘缓存，若有效则立即返回磁盘缓存数据
     - 无论是否命中磁盘缓存，都 `tokio::spawn` 后台执行真实检测
     - 后台检测完成后: 更新内存缓存 + 写入磁盘缓存 + `app_handle.emit("tool-versions-updated", &results)`
  4. 为 `ToolVersion` 添加 `Deserialize` trait（当前只有 `Serialize`）
  5. 在 `lib.rs` 的 `get_tool_versions` 命令中:
     - 添加 `app: tauri::AppHandle` 参数
     - 传递给 service 层: `get_tool_versions(tools, force, Some(app))`
- **验收标准**:
  - 首次调用返回磁盘缓存或空数组（<50ms）
  - 后台刷新完成后发出 `tool-versions-updated` 事件
  - 磁盘缓存文件生成在 `~/.ccg-switch/tool_versions_cache.json`
  - `cargo build` 编译通过

### Task 2: 前端类型定义 + Zustand Store
- **类型**: 前端 (TypeScript)
- **文件范围**:
  - `src/types/about.ts` (新建)
  - `src/stores/useAboutStore.ts` (新建)
- **依赖**: 无
- **实施步骤**:
  1. 新建 `src/types/about.ts`:
     - 从 `AboutPanel.tsx` 提取接口: `ToolVersion`, `UpdateInfo`, `DownloadProgress`, `InstallProgress`
     - 新增 `AboutState` 接口定义 store 状态
  2. 新建 `src/stores/useAboutStore.ts`:
     - 状态字段: `toolVersions`, `loadingTools`, `lastFetchTime`, `appVersion`, `updateInfo`, `checking`, `checkError`, `downloading`, `downloadProgress`, `downloadedPath`, `installing`, `installStage`
     - `fetchToolVersions(force?: boolean)`:
       - 5 分钟前端缓存检查 (`Date.now() - lastFetchTime < 300_000`)
       - 缓存未命中时调用 `invoke('get_tool_versions')`
     - `checkForUpdates()`: 调用 `invoke('check_for_updates')`
     - `downloadUpdate(url: string)`: 调用 `invoke('download_update')`
     - `installUpdate(filePath: string)`: 调用 `invoke('install_update')`
     - `initEventListeners()`: 监听 3 个 Tauri 事件:
       - `tool-versions-updated` → 更新 `toolVersions` + `lastFetchTime`
       - `update-download-progress` → 更新 `downloadProgress`
       - `update-install-progress` → 更新 `installStage`
     - 导出 `useAboutStore`
- **验收标准**:
  - TypeScript 类型检查通过
  - Store 包含完整的状态和 actions
  - 事件监听器正确注册和清理

### Task 3: 前端组件拆分 + 骨架屏 UI
- **类型**: 前端 (React + TypeScript)
- **文件范围**:
  - `src/components/settings/about/VersionInfoCard.tsx` (新建)
  - `src/components/settings/about/UpdateBanner.tsx` (新建)
  - `src/components/settings/about/ToolStatusGrid.tsx` (新建)
  - `src/components/settings/about/InstallCommandPanel.tsx` (新建)
  - `src/components/settings/AboutPanel.tsx` (重写)
- **依赖**: Task 2 (需要 types/about.ts 和 useAboutStore)
- **实施步骤**:
  1. 新建 `src/components/settings/about/VersionInfoCard.tsx`:
     - 从 AboutPanel 提取"版本信息卡片"部分（行 184-366）
     - 使用 `useAboutStore` 获取 `appVersion`, `updateInfo`, `checking` 等状态
     - 包含检查更新按钮和更新日志链接
  2. 新建 `src/components/settings/about/UpdateBanner.tsx`:
     - 从 AboutPanel 提取"发现新版本"部分（行 268-365）
     - 包含下载进度条、安装按钮、重启按钮
     - 使用 store 中的 `downloading`, `downloadProgress`, `downloadedPath`, `installing`, `installStage`
  3. 新建 `src/components/settings/about/ToolStatusGrid.tsx`:
     - 从 AboutPanel 提取"本地环境检查"部分（行 368-427）
     - 接收 `loading` 和 `toolVersions` props
     - loading 时显示 DaisyUI skeleton:
       ```tsx
       <div className="skeleton h-20 w-full rounded-xl" />
       ```
     - skeleton 尺寸匹配实际卡片（防止 CLS）
  4. 新建 `src/components/settings/about/InstallCommandPanel.tsx`:
     - 从 AboutPanel 提取"一键安装命令"部分（行 429-449）
     - 纯静态组件，包含复制功能
  5. 重写 `src/components/settings/AboutPanel.tsx`:
     - 移除所有本地 state 和 useEffect
     - 使用 `useAboutStore` 获取状态
     - 组合 4 个子组件
     - useEffect 中调用 `fetchToolVersions()`（会被 store 缓存拦截）
- **验收标准**:
  - AboutPanel 从 454 行减少到 ~50 行
  - 子组件各自独立，props 清晰
  - 骨架屏在 loading 时正确显示
  - TypeScript 编译通过

### Task 4: Settings 页面优化 + App 预热集成
- **类型**: 前端 (React + TypeScript)
- **文件范围**:
  - `src/pages/Settings.tsx` (修改)
  - `src/App.tsx` (修改)
- **依赖**: Task 2 + Task 3
- **实施步骤**:
  1. 修改 `src/App.tsx`:
     - 在现有 `requestIdleCallback` 预热 useEffect 旁新增工具版本预热:
       ```tsx
       useEffect(() => {
         const warmup = () => {
           void useAboutStore.getState().fetchToolVersions();
           useAboutStore.getState().initEventListeners();
         };
         if ('requestIdleCallback' in window) {
           const idleId = requestIdleCallback(warmup, { timeout: 3000 });
           return () => cancelIdleCallback(idleId);
         }
         const timer = setTimeout(warmup, 500);
         return () => clearTimeout(timer);
       }, []);
       ```
     - import `useAboutStore`
  2. 修改 `src/pages/Settings.tsx`:
     - 将 `{activeTab === 'about' && <AboutPanel />}` 改为:
       ```tsx
       <div className={activeTab === 'about' ? '' : 'hidden'}>
         <AboutPanel />
       </div>
       ```
     - 这样 AboutPanel 只挂载一次，切换 tab 不重新挂载
- **验收标准**:
  - App 启动后空闲时自动预热工具版本数据
  - 切换 About 标签不触发重新挂载
  - 事件监听器在 App 级别初始化，全局生效
  - `npm run build` 编译通过

## 文件冲突检查
✅ 无冲突 — 每个 Task 的文件范围完全隔离:
- Task 1: `src-tauri/src/services/tool_version_service.rs`, `src-tauri/src/lib.rs`
- Task 2: `src/types/about.ts`, `src/stores/useAboutStore.ts`
- Task 3: `src/components/settings/about/*`, `src/components/settings/AboutPanel.tsx`
- Task 4: `src/pages/Settings.tsx`, `src/App.tsx`

## 并行分组
- **Layer 1** (并行): Task 1 (后端), Task 2 (前端 Store)
- **Layer 2** (依赖 Layer 1): Task 3 (组件拆分，依赖 Task 2)
- **Layer 3** (依赖 Layer 1+2): Task 4 (集成，依赖 Task 1+2+3)

## 预期效果
| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| About 标签首帧 | 1-2 秒 | <300ms（骨架屏） |
| 重复打开 | 1-2 秒（重新挂载） | <50ms（Store 缓存） |
| 冷启动检测 | 阻塞等待全部完成 | 立即返回磁盘缓存 |
| exe vs dev 差异 | 明显 | 无感知差异 |
