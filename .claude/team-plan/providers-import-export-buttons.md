# Team Plan: providers-import-export-buttons

## 概述
在 `Providers` 页面新增“一键导出 / 导入配置”按钮，复用现有全量配置导入导出能力，确保交互一致、可并行实施。

## Codex 分析摘要
- 可行性高，后端可零改动：`export_config` / `import_config` 命令链路已完整可用（`src-tauri/src/commands/utility_commands.rs` → `src-tauri/src/services/import_export_service.rs`）。
- `providers.json` 已在导入导出映射中，满足 Providers 页面数据恢复需求。
- 推荐前端复用 `ImportExportPanel` 的交互模式（Blob 下载 + file input 导入 + invoke）。
- 关键风险：当前导入导出是“全量配置”（config/providers/mcp/skills），不是 providers-only，需在文案上明确。

## Gemini 分析摘要
- 推荐在 `ProvidersPage` 标题操作区加入导入/导出按钮，样式与现有按钮体系一致（`btn-sm` / `btn-ghost`），保持主次层级。
- 交互建议：导入导出期间展示 loading/禁用状态，完成后统一 toast 反馈；导入后强制刷新列表。
- 建议将导入导出逻辑封装到可复用层，避免在 `Settings` 与 `Providers` 重复实现。
- 建议补齐 i18n key（中英文），避免按钮与提示回退为硬编码或 key 文本。

## 技术方案
1. 保持 Rust 后端不变，继续复用 `export_config` / `import_config`。
2. 前端新增共享配置传输服务（或等价复用层），统一处理：
   - 导出：`invoke('export_config')` + Blob 下载。
   - 导入：文件选择 + `JSON.parse` + `invoke('import_config')`。
3. 在 `ProvidersPage` 接入两个按钮与交互状态；导入成功后调用 `loadAllProviders(true)` 同步 UI。
4. 同步补齐 `zh/en` 文案，明确“导入/导出配置”为全量行为。

## 子任务列表

### Task 1: 抽取共享导入导出能力
- **类型**: 前端
- **文件范围**:
  - `src/services/configTransferService.ts`（新建）
  - `src/components/settings/ImportExportPanel.tsx`
- **依赖**: 无
- **实施步骤**:
  1. 新建共享函数：导出到文件、从文件导入配置。
  2. 将 `ImportExportPanel` 改为调用共享函数，保持现有行为不变。
  3. 统一返回结构（成功信息 / 导入文件列表 / 错误抛出约定）。
- **验收标准**:
  - Settings 页导入导出功能行为与改造前一致。
  - 共享函数可被 `ProvidersPage` 直接复用。

### Task 2: Providers 页面接入导入导出按钮
- **类型**: 前端
- **文件范围**:
  - `src/pages/ProvidersPage.tsx`
- **依赖**: Task 1
- **实施步骤**:
  1. 在标题操作区新增“导出配置 / 导入配置”按钮。
  2. 接入共享导入导出函数。
  3. 增加页面级 `ioLoading`（或等价）状态，控制按钮禁用与 loading UI。
  4. 导入成功后执行 `loadAllProviders(true)` 并 toast 提示。
- **验收标准**:
  - 按钮可用且样式与页面现有操作按钮一致。
  - 导入后列表自动刷新，无需手动点击刷新。
  - 失败路径有明确错误提示。

### Task 3: 国际化文案补齐与对齐
- **类型**: 前端（i18n）
- **文件范围**:
  - `src/locales/zh.json`
  - `src/locales/en.json`
- **依赖**: 无
- **实施步骤**:
  1. 增加 providers 页面按钮与提示文案 key。
  2. 补齐 settings 导入导出相关已使用但缺失/不完整的 key。
  3. 校对中英文语义一致，特别是“全量配置”提示。
- **验收标准**:
  - 中英文切换下不出现 raw key。
  - 提示文案准确表达导入导出范围。

### Task 4: 集成验证与回归
- **类型**: 验证
- **文件范围**:
  - （不新增业务代码）
- **依赖**: Task 2, Task 3
- **实施步骤**:
  1. 验证 Providers 页面导出下载成功、文件名正确。
  2. 验证合法 JSON 导入成功并自动刷新列表。
  3. 验证非法 JSON 导入失败提示。
  4. 验证导入导出期间按钮禁用生效。
  5. 验证 Settings 页面导入导出功能未回归。
- **验收标准**:
  - 关键路径通过，且无明显 UI/交互回退。

## 文件冲突检查
⚠️ 已通过依赖关系解决
- Task 1 与 Task 2 的冲突风险（共享函数契约）通过“Task 2 依赖 Task 1”消除。
- 其余任务文件范围互不重叠。

## 并行分组
- **Layer 1（并行）**: Task 1, Task 3
- **Layer 2（依赖 Layer 1）**: Task 2
- **Layer 3（依赖 Layer 2）**: Task 4
