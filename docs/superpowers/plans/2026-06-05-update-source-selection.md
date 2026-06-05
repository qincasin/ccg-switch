# Update Source Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to choose between multiple GitHub release sources (cus45/ccg-switch and qincasin/ccg-switch) when manually checking for updates, while auto-check uses a configurable default source.

**Architecture:** Add an `update_source` config field and a `check_for_updates_all_sources` Rust command that queries both repos concurrently. The UpdateBanner UI displays each source's version info and lets the user pick which source to download from. The Settings page gets a dropdown to set the default source for auto-check.

**Tech Stack:** Rust (Tauri 2, reqwest, tokio), React 19, TypeScript, Zustand, TailwindCSS + DaisyUI, i18next

---

### Task 1: Add `update_source` to Config model

**Files:**
- Modify: `src-tauri/src/models/config.rs`

- [ ] **Step 1: Add `update_source` field with default and serde rename**

In `src-tauri/src/models/config.rs`, add a default function and field:

```rust
fn default_update_source() -> String {
    "cus45/ccg-switch".to_string()
}
```

Add to the `Config` struct after `check_update_interval_hours`:

```rust
#[serde(default = "default_update_source", rename = "updateSource")]
pub update_source: String,
```

Add to the `Default` impl:

```rust
update_source: default_update_source(),
```

- [ ] **Step 2: Verify Rust compilation**

Run: `cd /Users/jiaxing/code/github/ccg-switch && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: compilation succeeds (warnings ok, no errors)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models/config.rs
git commit -m "feat(config): add update_source field for multi-source updates"
```

---

### Task 2: Refactor `updater_service.rs` to accept repo parameter and add multi-source check

**Files:**
- Modify: `src-tauri/src/services/updater_service.rs`

- [ ] **Step 1: Replace hardcoded `GITHUB_REPO` with a constant list and modify `check_update`**

Replace line 12:

```rust
const GITHUB_REPO: &str = "cus45/ccg-switch";
```

With:

```rust
pub const UPDATE_SOURCES: [&str; 2] = ["cus45/ccg-switch", "qincasin/ccg-switch"];
```

Change the `check_update` function signature from:

```rust
pub async fn check_update(current_version: &str) -> Result<UpdateInfo, String> {
```

To:

```rust
pub async fn check_update(current_version: &str, repo: &str) -> Result<UpdateInfo, String> {
```

In the body of `check_update`, change the URL construction from:

```rust
let url = format!(
    "https://api.github.com/repos/{}/releases/latest",
    GITHUB_REPO
);
```

To:

```rust
let url = format!(
    "https://api.github.com/repos/{}/releases/latest",
    repo
);
```

- [ ] **Step 2: Add `SourceUpdateInfo` struct and `check_update_all_sources` function**

Add after the `InstallProgress` struct:

```rust
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceUpdateInfo {
    pub repo: String,
    pub update_info: UpdateInfo,
}
```

Add the multi-source check function after `check_update`:

```rust
/// 同时检查所有更新源
pub async fn check_update_all_sources(current_version: &str) -> Vec<SourceUpdateInfo> {
    let futures: Vec<_> = UPDATE_SOURCES
        .iter()
        .map(|repo| {
            let repo = repo.to_string();
            let version = current_version.to_string();
            async move {
                let result = check_update(&version, &repo).await;
                SourceUpdateInfo {
                    repo,
                    update_info: result.unwrap_or(UpdateInfo {
                        has_update: false,
                        current_version: version,
                        latest_version: String::new(),
                        release_notes: String::new(),
                        download_url: None,
                        file_size: None,
                        published_at: None,
                    }),
                }
            }
        })
        .collect();

    futures::future::join_all(futures).await
}
```

- [ ] **Step 3: Update `check_update_and_emit` to use config's `update_source`**

Change the `check_update_and_emit` function. Replace:

```rust
let update_info = check_update(&current_version).await?;
```

With:

```rust
let update_info = check_update(&current_version, &config.update_source).await?;
```

- [ ] **Step 4: Verify Rust compilation**

Run: `cd /Users/jiaxing/code/github/ccg-switch && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/updater_service.rs
git commit -m "feat(updater): support multi-source update checks"
```

---

### Task 3: Add Tauri commands for multi-source check and save update source

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `check_for_updates_all_sources` command**

Add after the `check_for_updates` command (after line 691):

```rust
#[tauri::command]
async fn check_for_updates_all_sources(
    app: tauri::AppHandle,
) -> Result<Vec<services::updater_service::SourceUpdateInfo>, String> {
    let version = app.package_info().version.to_string();
    Ok(services::updater_service::check_update_all_sources(&version).await)
}
```

- [ ] **Step 2: Add `save_update_source` command**

Add after `check_for_updates_all_sources`:

```rust
#[tauri::command]
async fn save_update_source(
    app: tauri::AppHandle,
    source: String,
) -> Result<(), String> {
    use crate::services::config_service;
    let db = app.state::<store::AppState>().db.clone();
    let mut config = config_service::load_config_from_db(&db)
        .map_err(|e| e.to_string())?;
    config.update_source = source;
    config_service::save_config_to_db(&db, &config)
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Register both commands in `generate_handler!`**

In the `generate_handler!` macro, add after `check_for_updates,`:

```rust
check_for_updates_all_sources,
save_update_source,
```

- [ ] **Step 4: Verify Rust compilation**

Run: `cd /Users/jiaxing/code/github/ccg-switch && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(commands): add multi-source update check and save update source commands"
```

---

### Task 4: Add TypeScript types for multi-source updates

**Files:**
- Modify: `src/types/about.ts`

- [ ] **Step 1: Add `SourceUpdateInfo` interface**

Add after the `InstallProgress` interface:

```typescript
export interface SourceUpdateInfo {
    repo: string;
    updateInfo: UpdateInfo;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/about.ts
git commit -m "feat(types): add SourceUpdateInfo type for multi-source updates"
```

---

### Task 5: Update Zustand store for multi-source updates

**Files:**
- Modify: `src/stores/useAboutStore.ts`

- [ ] **Step 1: Add `sourceUpdates` state and `checkForUpdatesAllSources` action**

Add `SourceUpdateInfo` to the import:

```typescript
import { ToolVersion, UpdateInfo, DownloadProgress, InstallProgress, SourceUpdateInfo } from '../types/about';
```

Add to `AboutState` interface, after `checkError`:

```typescript
sourceUpdates: SourceUpdateInfo[];
```

Add to the actions section:

```typescript
checkForUpdatesAllSources: () => Promise<void>;
```

- [ ] **Step 2: Add initial state and implementation**

Add to initial state after `checkError: null,`:

```typescript
sourceUpdates: [],
```

Add the action implementation after `checkForUpdates`:

```typescript
checkForUpdatesAllSources: async () => {
    set({ checking: true, updateInfo: null, sourceUpdates: [], checkError: null, downloadedPath: null, downloadProgress: null });
    try {
        const sources = await invoke<SourceUpdateInfo[]>('check_for_updates_all_sources');
        // 向后兼容：如果有任何源有更新，设置第一个有更新的源作为默认 updateInfo
        const firstWithUpdate = sources.find(s => s.updateInfo.hasUpdate);
        set({
            sourceUpdates: sources,
            updateInfo: firstWithUpdate ? firstWithUpdate.updateInfo : (sources[0]?.updateInfo || null),
            checking: false,
        });
    } catch (e: any) {
        set({
            checkError: typeof e === 'string' ? e : e?.message || '检查更新失败',
            checking: false,
        });
    }
},
```

- [ ] **Step 3: Update `checkForUpdates` to use `check_for_updates` with backward compat**

The existing `checkForUpdates` should now call `checkForUpdatesAllSources` instead. Replace the `checkForUpdates` implementation:

```typescript
checkForUpdates: async () => {
    const { checkForUpdatesAllSources } = get();
    await checkForUpdatesAllSources();
},
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/useAboutStore.ts
git commit -m "feat(store): add multi-source update check support"
```

---

### Task 6: Update UpdateBanner UI for source selection

**Files:**
- Modify: `src/components/settings/about/UpdateBanner.tsx`

- [ ] **Step 1: Add source selection UI**

Add `useState` import and source selection state. Update the component to accept and display `sourceUpdates`, and let the user pick a source before downloading.

Replace the entire file content with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, ArrowUpCircle, GitFork } from 'lucide-react';
import { useAboutStore } from '../../../stores/useAboutStore';
import { SourceUpdateInfo } from '../../../types/about';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRepoName(repo: string): string {
    return repo.split('/')[0];
}

function UpdateBanner() {
    const { t } = useTranslation();
    const {
        updateInfo, sourceUpdates, downloading, downloadProgress, downloadedPath,
        installing, installStage, downloadUpdate, installUpdate, handleRelaunch,
    } = useAboutStore();

    const sourcesWithUpdate = sourceUpdates.filter(s => s.updateInfo.hasUpdate);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);

    if (!updateInfo?.hasUpdate) return null;

    const activeSourceInfo: SourceUpdateInfo | undefined = selectedSource
        ? sourceUpdates.find(s => s.repo === selectedSource)
        : sourcesWithUpdate[0];

    const activeUpdateInfo = activeSourceInfo?.updateInfo || updateInfo;

    return (
        <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-base-content">
                        {t('settings.newVersionFound', { defaultValue: '发现新版本' })}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        v{activeUpdateInfo.latestVersion}
                    </span>
                </div>
                {activeUpdateInfo.publishedAt && (
                    <span className="text-xs text-gray-400">
                        {new Date(activeUpdateInfo.publishedAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* 多源选择 */}
            {sourcesWithUpdate.length > 1 && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <GitFork className="w-3.5 h-3.5" />
                        {t('settings.selectUpdateSource', { defaultValue: '选择更新源' })}
                    </div>
                    <div className="flex gap-2">
                        {sourcesWithUpdate.map(s => (
                            <button
                                key={s.repo}
                                onClick={() => setSelectedSource(s.repo)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                    (selectedSource || sourcesWithUpdate[0]?.repo) === s.repo
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-300'
                                }`}
                            >
                                {formatRepoName(s.repo)}
                                <span className="opacity-75">v{s.updateInfo.latestVersion}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Release Notes */}
            {activeUpdateInfo.releaseNotes && (
                <div className="text-xs text-gray-500 dark:text-gray-400 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-base-200/50 rounded-md p-2.5">
                    {activeUpdateInfo.releaseNotes}
                </div>
            )}

            {/* 下载进度条 */}
            {downloading && downloadProgress && (
                <div className="space-y-1.5">
                    <div className="w-full h-2 bg-gray-200 dark:bg-base-300 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${downloadProgress.percentage}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                        <span>{formatFileSize(downloadProgress.downloaded)} / {formatFileSize(downloadProgress.total)}</span>
                        <span>{downloadProgress.percentage.toFixed(0)}%</span>
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
                {!downloadedPath && !downloading && (
                    <button
                        onClick={() => downloadUpdate(activeUpdateInfo.downloadUrl!)}
                        disabled={!activeUpdateInfo.downloadUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm disabled:opacity-60"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('settings.downloadUpdate', { defaultValue: '下载更新' })}
                        {activeUpdateInfo.fileSize && (
                            <span className="opacity-75">({formatFileSize(activeUpdateInfo.fileSize)})</span>
                        )}
                    </button>
                )}
                {downloading && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {t('settings.downloading', { defaultValue: '下载中...' })}
                    </span>
                )}
                {downloadedPath && !installing && (
                    <button
                        onClick={() => installUpdate(downloadedPath)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm"
                    >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        {t('settings.installUpdate', { defaultValue: '安装更新' })}
                    </button>
                )}
                {installing && (
                    <>
                        {installStage === 'success' ? (
                            <button
                                onClick={handleRelaunch}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 transition-all shadow-sm"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                {t('settings.relaunchNow', { defaultValue: '立即重启' })}
                            </button>
                        ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-500">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                {t(`settings.installStage.${installStage}`, { defaultValue: '正在启动安装程序...' })}
                            </span>
                        )}
                    </>
                )}
                {!activeUpdateInfo.downloadUrl && (
                    <span className="text-xs text-gray-400">
                        {t('settings.noInstallerFound', { defaultValue: '未找到当前平台的安装包' })}
                    </span>
                )}
            </div>
        </div>
    );
}

export default UpdateBanner;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/about/UpdateBanner.tsx
git commit -m "feat(ui): add source selection in UpdateBanner for multi-source updates"
```

---

### Task 7: Add update source dropdown in Settings page

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add update source dropdown in Settings.tsx**

In `Settings.tsx`, add a handler after `handleCheckUpdateIntervalChange`:

```typescript
const handleUpdateSourceChange = async (source: string) => {
    if (!config) return;
    await saveConfig({ ...config, updateSource: source });
};
```

Add the dropdown after the check interval `</select>` and its parent `</div>`, but still inside the `config?.autoCheckUpdate` conditional block (after the interval row), add:

```tsx
{/* 更新源选择 */}
<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-base-200">
    <div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('settings.updateSource', '更新源')}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
            {t('settings.updateSourceHint', '自动检查更新时使用的源，手动检查时可切换')}
        </p>
    </div>
    <select
        value={config?.updateSource || 'cus45/ccg-switch'}
        onChange={(e) => handleUpdateSourceChange(e.target.value)}
        className="px-3 py-1.5 bg-gray-100 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
    >
        <option value="cus45/ccg-switch">cus45/ccg-switch</option>
        <option value="qincasin/ccg-switch">qincasin/ccg-switch</option>
    </select>
</div>
```

Also add `invoke` import if not present, and add the `saveConfig` call — this should already be available since the component uses `saveConfig` for other settings.

- [ ] **Step 2: Add i18n keys to zh.json**

In `src/locales/zh.json`, add inside the `"settings"` object, after `"check_update_interval"`:

```json
"updateSource": "更新源",
"updateSourceHint": "自动检查更新时使用的源，手动检查时可切换",
"selectUpdateSource": "选择更新源",
```

- [ ] **Step 3: Add i18n keys to en.json**

In `src/locales/en.json`, add inside the `"settings"` object, after `"check_update_interval"`:

```json
"updateSource": "Update Source",
"updateSourceHint": "Source used for auto-update checks; can switch when checking manually",
"selectUpdateSource": "Select Update Source",
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx src/locales/zh.json src/locales/en.json
git commit -m "feat(settings): add update source dropdown and i18n"
```

---

### Task 8: Verify the full app builds and runs

- [ ] **Step 1: Run Tauri dev build**

Run: `cd /Users/jiaxing/code/github/ccg-switch && npm run tauri dev 2>&1 | head -30`
Expected: App starts without errors

- [ ] **Step 2: Verify update source in Settings**

Navigate to Settings > About tab, click "Check for Updates", verify that:
- Both sources are checked
- Source selection buttons appear if both have updates
- Selecting a different source updates the download URL

- [ ] **Step 3: Verify update source dropdown in Settings > General**

Navigate to Settings > General, verify:
- Update source dropdown appears when auto-check is enabled
- Changing the source persists after page reload
