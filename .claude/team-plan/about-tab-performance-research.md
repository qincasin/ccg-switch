# Team Research: about-tab-performance

## 增强后的需求

**目标**: 解决 CCG Switch (Tauri 2) 桌面应用 Settings 页面 About 标签页首次打开卡顿问题

**现象描述**:
- 点击 Settings → About 标签，首次需等待 1-2 秒才显示内容
- Dev 模式下也有轻微卡顿，但打包成 exe 后明显加重
- 仅首次软件启动时卡顿，后续 5 分钟内重复打开不卡（命中内存缓存）

**技术上下文**:
- 前端: React 19 + Vite 7 + Tauri 2 (WebView2)
- 后端: Rust + tokio + reqwest
- 平台: Windows

**范围边界**:
- 仅优化 About 标签页首次打开性能
- 不移除工具版本检测功能
- 不影响其他页面和标签页

## 约束集

### 硬约束
- [HC-1] 首次调用 `get_tool_versions` 必走真实检测路径（内存缓存为空） — 来源：Codex
- [HC-2] Windows 进程创建 `cmd /C <tool> --version` 成本高，尤其 PATH 搜索未安装工具时可达数百 ms — 来源：Codex
- [HC-3] HTTP 请求（npm registry/GitHub API）超时设为 10s，网络慢时拉长首屏延迟 — 来源：Codex
- [HC-4] `futures::future::join_all` 等待全部 4 组（本地进程+远程请求）完成后才统一返回 — 来源：Codex
- [HC-5] 条件渲染 `{activeTab === 'about' && <AboutPanel />}` 导致每次切换到 About 都会重新挂载组件并触发全部 useEffect — 来源：Gemini
- [HC-6] Settings 页面是 `React.lazy` 懒加载，首次进入有 chunk 加载开销 — 来源：Gemini
- [HC-7] exe 环境下 GUI 启动的 PATH 比终端环境更受限，加重进程搜索耗时 — 来源：Codex

### 软约束
- [SC-1] App.tsx 已有 `requestIdleCallback` 预热模式（用于 Token 数据），可复用 — 来源：Gemini
- [SC-2] 当前 5 分钟内存缓存有效，重复访问不卡 — 来源：Codex
- [SC-3] 仅全量请求（tools=null）时更新缓存，子集请求不回填 — 来源：Codex
- [SC-4] `loadingTools` 初始为 `true`，理论上应立即显示 spinner，但实际 tab 切换本身被感知为卡顿 — 来源：Gemini
- [SC-5] Lucide 图标导入增加 bundle 大小但非核心瓶颈 — 来源：Gemini
- [SC-6] Vite 配置未做 `rollupOptions` 分块优化，所有 Settings 子组件打包在同一 chunk — 来源：Claude 分析

### 依赖关系
- [DEP-1] 前端 `AboutPanel` → Tauri IPC invoke → 后端 `tool_version_service` → 系统进程(cmd) + 网络请求(reqwest)
- [DEP-2] Settings 页面 lazy load → Vite chunk 加载 → WebView2 渲染
- [DEP-3] `auto_launch_service` 也在 Settings 页面 mount 时调用 `reg query`（轻量但叠加）

### 风险
- [RISK-1] 首屏阻塞：命令需等待全部 4 组检测完成才返回，直接放大 UI 卡顿感知 — 缓解：后台预热或流式返回
- [RISK-2] 网络波动或限流导致接近 10s 超时 — 缓解：分离本地检测与远程检测，或降低远程超时
- [RISK-3] 未安装工具时 PATH 搜索 + 进程启动开销显著（Windows 尤其明显） — 缓解：增加磁盘持久化缓存
- [RISK-4] Release 模式更重的进程创建开销会放大卡顿 — 缓解：应用启动时后台预热

## 根因分析

```
用户点击 About Tab
  ↓
AboutPanel 组件挂载
  ↓
useEffect 触发 loadToolVersions()
  ↓
invoke('get_tool_versions', { tools: null, force: false })
  ↓ (IPC 到 Rust)
tool_version_service::get_tool_versions()
  ↓ (缓存为空, 首次调用)
join_all([
  spawn_blocking(cmd /C claude --version) + fetch_npm_latest("@anthropic-ai/claude-code"),
  spawn_blocking(cmd /C codex --version)  + fetch_npm_latest("@openai/codex"),
  spawn_blocking(cmd /C gemini --version) + fetch_npm_latest("@google/gemini-cli"),
  spawn_blocking(cmd /C opencode --version) + fetch_github_latest("anomalyco/opencode")
])
  ↓ (等待全部完成: 进程创建 ~200-500ms × 4 + 网络 ~500-10000ms)
返回结果 → 前端渲染
```

**核心瓶颈**: `get_tool_versions` 在 About 面板首次挂载时才触发，且需等待全部检测完成。

## 成功判据
- [OK-1] About 标签页点击后 <300ms 内完成 UI 框架渲染（tab 切换无感知卡顿）
- [OK-2] 工具版本数据可异步加载，显示 Loading/Skeleton 状态
- [OK-3] exe 打包后首次打开体验与 dev 模式无显著差异
- [OK-4] 5 分钟内重复打开不触发任何本地进程或网络请求（缓存命中）
- [OK-5] 离线或工具未安装时 500ms 内返回可解释状态

## 开放问题（已解决）
- Q1: "关于"指哪个范围？ → A: 仅指 Settings 页 About 标签页 → 约束：[HC-5]
- Q2: 卡顿表现？ → A: 点击按钮后 1-2 秒 tab 才切换出来，仅首次启动 → 约束：[HC-1], [RISK-1]
- Q3: Dev vs Exe？ → A: Dev 也有点卡但 exe 更严重 → 约束：[HC-7]

## 推荐方向（非决策，供 Plan 阶段参考）

| 方向 | 说明 | 来源 |
|------|------|------|
| 后台预热 | App 启动时 `requestIdleCallback` 预热 `get_tool_versions` | Codex + Gemini |
| 分离本地/远程 | 本地版本立即返回，远程最新版本异步补充 | Codex |
| 磁盘持久化缓存 | 跨重启保留检测结果，避免每次冷启动都走真实检测 | Codex |
| 延迟调用 + 骨架屏 | useEffect 中 setTimeout 100ms 延迟，保证 UI 先渲染 | Gemini |
| 全局 Store | 将工具版本放入 Zustand store 避免重复挂载时重新 fetch | Gemini |
