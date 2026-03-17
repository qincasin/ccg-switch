# Team Research: 设置页 Tab 切换卡顿（仅 Production）

## 增强后的需求

**问题描述**：exe 安装版本中，每次从其他页面切换到设置页后，点击任何 tab 都会卡顿 1-2 秒。npm 开发模式无此问题。

**复现路径**：其他页面 → 设置页 → 点击任意 tab → 卡顿 1-2 秒

**目标**：消除 production build 中设置页 tab 切换的卡顿

## 根因分析

### 发现 1: 组件每次进入设置页都完全重建

Settings 页使用 `React.lazy()` 懒加载 (`App.tsx:22`)：
```tsx
const Settings = lazy(() => import('./pages/Settings'));
```

每次离开设置页再回来，**所有组件被销毁重建**，所有 `useEffect` 重新执行。

### 发现 2: 进入设置页时触发大量并发后端调用

Settings 页挂载时同时触发：

| 调用 | 来源 | 类型 | 操作 |
|------|------|------|------|
| `get_auto_launch_status` | Settings.tsx useEffect | 同步命令 | **生成 `reg.exe` 子进程** |
| `get_tool_versions` | AboutPanel useEffect | async 命令 | 检查缓存，可能生成 4 个子进程 |
| `loadAppVersion` | AboutPanel useEffect | async 命令 | 获取应用版本 |

然后用户点击 tab 时额外触发：

| Tab | 调用 | 操作 |
|-----|------|------|
| 代理 | `get_global_proxy` (同步) | DB 读取 |
| 高级 | `list_db_backups` (同步) + `get_backup_settings` (同步) + `get_webdav_config` (同步) | 文件系统 + DB |
| 通用 | 无 | 仅渲染 |
| 关于 | 已挂载 (hidden) | 无额外调用 |

### 发现 3: Tab 切换使用条件渲染，组件反复销毁重建

```tsx
{activeTab === 'proxy' && <GlobalProxyPanel />}     // 销毁/重建
{activeTab === 'advanced' && <ImportExportPanel />}  // 销毁/重建
<div className={activeTab === 'about' ? '' : 'hidden'}>  // 仅 about 保持挂载
    <AboutPanel />
</div>
```

每次切换 tab：旧组件销毁 → 新组件创建 → useEffect 重跑 → 重新调用后端。

### 发现 4: Production 与 Dev 的差异

| 方面 | Dev 模式 | Production |
|------|---------|------------|
| 前端加载 | Vite HMR, 模块直接从磁盘加载 | 从 `tauri://` 协议加载打包资源 |
| 进程创建 | 无杀毒扫描干扰 | exe 进程创建可能触发 Windows Defender 扫描 |
| `reg.exe` | 环境已"热"，响应快 | 冷启动可能更慢 |
| `tool --version` | Debug 模式 Rust 较慢但进程环境已缓存 | 生产环境首次进程创建可能需要额外时间 |

### 根因总结

**不是单一瓶颈，而是多因素叠加**：

1. `React.lazy` 导致组件每次进入都重建（非持久化）
2. 进入时同时触发多个后端调用（包括同步的进程创建）
3. Tab 用条件渲染 → 切换时组件销毁重建 → 重复调用后端
4. Production 环境下进程创建和文件 I/O 比 dev 慢（杀毒、签名验证等）
5. 这些延迟在 dev 模式下单独不可感知（< 50ms），但在 production 叠加达到 1-2 秒

## 约束集

### 硬约束

- [HC-1] **Tab 切换不应销毁组件** — 来源：性能需求
  - 当前 `{activeTab === 'xxx' && <Component />}` 模式导致每次切换都重建
  - 改为 CSS 隐藏 (`hidden`) 可保持组件实例，避免重复调用后端
  - `AboutPanel` 已经用这种方式（line 279），其他 tab 应统一

- [HC-2] **后端数据应在 Store 中缓存** — 来源：前端架构
  - `GlobalProxyPanel`、`BackupPanel`、`WebDavBackupPanel` 的数据应持久化到 Zustand store
  - 组件 mount 时先用缓存渲染，后台静默刷新

- [HC-3] **`getAutoLaunchStatus` 结果需缓存** — 来源：代码分析
  - Settings.tsx 中的 useEffect 每次 mount 都调用 `getAutoLaunchStatus()`
  - 这是同步 Tauri 命令，内部生成 `reg.exe` 子进程
  - 应缓存结果，避免每次进入设置页都调用

### 软约束

- [SC-1] **优先使用 CSS 隐藏方案** — 来源：最小改动
  - 将 `{activeTab === 'xxx' && ...}` 改为 `<div className={activeTab !== 'xxx' ? 'hidden' : ''}>...</div>`
  - 这是最简单且最有效的修复
  - 副作用：所有 tab 内容在进入设置页时一起渲染（但都是轻量组件，可接受）

- [SC-2] **保持现有组件 API 不变** — 来源：最小侵入性
  - 不需要重构子组件内部逻辑
  - 只改 Settings.tsx 的渲染方式

### 风险

- [RISK-1] **所有 tab 同时渲染的性能影响** — 缓解：各 tab 组件都很轻量（< 100 行），同时渲染总量远小于一个复杂页面

## 成功判据

- [OK-1] Production build 中设置页 tab 切换无明显卡顿（< 100ms）
- [OK-2] 各 tab 功能不受影响
- [OK-3] 从其他页面切换到设置页不卡顿
- [OK-4] Dev 模式行为不变

## 修改范围

| 文件 | 修改内容 | 行数估计 |
|------|----------|----------|
| `src/pages/Settings.tsx` | 条件渲染改为 CSS hidden | ~10 行 |
