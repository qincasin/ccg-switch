# Team Plan: providers-provider-only-and-ui-stability

## 概述
将 Providers 页导入/导出改为仅处理 providers 配置，补足导出位置提示，修复中英文切换导致的顶栏布局抖动，并移除前端中的 OpenCode/OpenClaw 选项卡入口。

## Codex 分析摘要
- 可行性高：现有链路 `ProvidersPage -> configTransferService -> export_config/import_config -> import_export_service` 清晰，适合新增 provider-only 命令并保留全量命令。
- 后端建议：在 `src-tauri/src/services/import_export_service.rs` 增加 `export_providers_config/import_providers_config`，仅映射 `providers.json`；通过 `src-tauri/src/commands/utility_commands.rs` 暴露命令，并在 `src-tauri/src/lib.rs` 注册。
- 导出提示问题根因：当前 `Blob + a.download` 无法确定最终保存路径，需升级交互反馈。
- 布局抖动根因：`src/pages/ProvidersPage.tsx` 顶栏单行 `flex`，右侧按钮+长文案在中英文切换时发生挤压换行。
- OpenCode/OpenClaw 收敛建议：优先移除前端可见入口，后端枚举先保留兼容，避免历史数据反序列化风险。

## Gemini 分析摘要
- UX 建议：Providers 导出优先使用桌面端保存对话框/位置感知提示；至少在成功提示中明确“默认下载目录 + 文件名”。
- 组件建议：将 Providers 顶栏动作区从页面中解耦（或至少结构化为可控 action 区），并对按钮设置 `whitespace-nowrap`、固定最小宽度或响应式降级，确保语言切换稳定。
- 实施建议：导入/导出逻辑在 service 层拆分为全量与 providers-only 两套 API；Providers 页面使用 providers-only，Settings 保持全量。
- 交互建议：导入成功后继续自动刷新列表，且提示语义必须改为“仅 providers 配置”。

## 技术方案
1. **后端新增 provider-only 命令**：
   - 保留 `export_config/import_config`（Settings 全量）。
   - 新增 `export_providers_config/import_providers_config`（Providers 专用）。
2. **前端 service 分层**：
   - `configTransferService.ts` 增加 providers-only 导入导出函数。
   - Providers 页切到 providers-only；Settings 继续走全量。
3. **导出位置提示优化**：
   - 第一阶段：基于当前下载机制，toast 明确“已触发下载，默认保存到系统下载目录，文件名 xxx”。
   - （可选第二阶段）后续再切 Tauri 保存对话框。
4. **布局稳定性修复**：
   - Providers 顶栏改为可换行/分段布局，按钮防换行，缩小中英切换引发的抖动。
5. **移除 OpenCode/OpenClaw 选项卡**：
   - 前端 `src/types/app.ts` 及引用处仅保留 Claude/Codex/Gemini 的可见选项。
   - 暂不删除后端 enum，保证旧数据兼容。

## 子任务列表

### Task 1: 后端实现 providers-only 导入导出命令
- **类型**: 后端
- **文件范围**:
  - `src-tauri/src/services/import_export_service.rs`
  - `src-tauri/src/commands/utility_commands.rs`
  - `src-tauri/src/lib.rs`
- **依赖**: 无
- **实施步骤**:
  1. 在 `import_export_service.rs` 提取/复用导入导出映射逻辑。
  2. 新增 `export_providers_config()`：只导出 `providers.json` 为 `data.providers`。
  3. 新增 `import_providers_config(data)`：只备份并写入 `providers.json`，返回 `importedFiles`。
  4. 在 `utility_commands.rs` 新增对应 Tauri command。
  5. 在 `lib.rs` 的 `generate_handler!` 注册新命令。
- **验收标准**:
  - 调用新导出命令只包含 providers 数据。
  - 调用新导入命令后仅 `providers.json` 发生变化。
  - 旧全量命令行为不变。
  - `cargo check` 通过。

### Task 2: 前端配置传输服务拆分全量/providers-only
- **类型**: 前端
- **文件范围**:
  - `src/services/configTransferService.ts`
  - `src/components/settings/ImportExportPanel.tsx`
- **依赖**: Task 1
- **实施步骤**:
  1. 在 service 中保留现有全量函数。
  2. 新增 providers-only 函数（调用 `export_providers_config/import_providers_config`）。
  3. 统一返回结构，导出结果包含可用于提示的 `fileName` 与 `locationHint`。
  4. `ImportExportPanel` 继续使用全量函数，不改业务语义。
- **验收标准**:
  - Settings 页仍是全量导入/导出。
  - Service 同时支持全量和 providers-only。
  - TS 类型检查通过。

### Task 3: Providers 页面切换为 providers-only + 顶栏布局稳定化
- **类型**: 前端
- **文件范围**:
  - `src/pages/ProvidersPage.tsx`
- **依赖**: Task 2
- **实施步骤**:
  1. 将导入/导出 handler 替换为 providers-only service。
  2. 成功提示改为 providers-only 语义，附带导出位置提示。
  3. 顶栏改为稳定布局（分段/可换行容器 + 按钮 `whitespace-nowrap` + 关键按钮固定宽度策略）。
  4. 保留导入后 `loadAllProviders(true)` 刷新逻辑。
- **验收标准**:
  - Providers 导入导出只影响 providers。
  - 中英文切换后顶栏不出现明显抖动或错位。
  - 导入导出期间禁用状态与 loading 正常。

### Task 4: 移除 OpenCode/OpenClaw 前端选项卡入口
- **类型**: 前端
- **文件范围**:
  - `src/types/app.ts`
  - `src/components/dashboard/MultiAppStatsCard.tsx`
  - `src/components/providers/ProviderForm.tsx`
  - `src/components/providers/UniversalProviderPanel.tsx`
  - `src/pages/SkillsPage.tsx`
- **依赖**: 无
- **实施步骤**:
  1. `app.ts` 定义可见 app 列表仅 `claude/codex/gemini`。
  2. 各页面/组件中的应用下拉、tab、统计分组改用三应用列表。
  3. 清理 OpenCode/OpenClaw 的显示 label/color 与相关分支。
- **验收标准**:
  - UI 中不再出现 OpenCode/OpenClaw 选项卡/筛选项。
  - Providers/Skills/Dashboard 相关区域显示正常。
  - 不修改后端枚举，避免旧数据兼容风险。

### Task 5: 国际化文案收敛（providers-only vs full-config）
- **类型**: 前端（i18n）
- **文件范围**:
  - `src/locales/zh.json`
  - `src/locales/en.json`
- **依赖**: Task 3
- **实施步骤**:
  1. 将 `providers.import_export_scope` 改为“仅 providers 配置”。
  2. 新增/调整 Providers 导出位置提示文案 key。
  3. 保持 `settings.fullConfigNotice` 为全量语义。
  4. 中英文 key 对齐、避免 raw key。
- **验收标准**:
  - Providers 页面提示语义准确。
  - Settings 页面仍展示全量配置说明。
  - 中英文切换无缺失 key。

## 文件冲突检查
⚠️ 已通过依赖关系解决
- Task 2 依赖 Task 1（新命令契约）
- Task 3 依赖 Task 2（service API）
- Task 5 依赖 Task 3（文案键和页面引用一致性）
- Task 4 与其余任务文件范围不重叠，可并行

## 并行分组
- **Layer 1（并行）**: Task 1, Task 4
- **Layer 2（依赖 Layer 1）**: Task 2
- **Layer 3（依赖 Layer 2）**: Task 3
- **Layer 4（依赖 Layer 3）**: Task 5
