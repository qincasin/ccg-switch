# Update Source Selection Design

## Goal

Allow users to choose between multiple GitHub release sources when checking for updates manually, while auto-check continues using a configurable default source.

## Sources

- `cus45/ccg-switch` (current default)
- `qincasin/ccg-switch`

These are forks maintained by different people; users may want updates from either.

## Data Layer

### Config

Add `update_source: String` field to Config struct (default: `"cus45/ccg-switch"`, serde rename: `"updateSource"`).

### Rust: updater_service.rs

- Modify `check_update(current_version)` → `check_update(current_version, repo: &str)`, replace hardcoded `cus45/ccg-switch` with the `repo` parameter
- Add `check_update_all_sources(current_version)` → returns `Vec<SourceUpdateInfo>` where each entry has `repo: String` and `update_info: UpdateInfo`
- `check_update_and_emit` (auto-check) continues using config's `update_source` field

### New Tauri Commands

- `check_for_updates_all_sources` → calls `check_update_all_sources`, returns all sources' update info
- `save_update_source(source: String)` → persists selected source to config

### Frontend Types

Add `SourceUpdateInfo`:
```typescript
interface SourceUpdateInfo {
  repo: string;
  updateInfo: UpdateInfo;
}
```

## UI Layer

### UpdateBanner

- Manual check invokes `check_for_updates_all_sources`
- When updates found, display each source with: repo name, version, publish date
- User selects a source via radio/select, then downloads from chosen source

### Settings Page

- Add "Update Source" dropdown below auto-check toggle
- Options: `cus45/ccg-switch`, `qincasin/ccg-switch`
- Selection saved via `save_update_source`, affects auto-check behavior

## Data Flow

```
Manual check → check_for_updates_all_sources → returns both sources
  → UI shows both → user picks one → download_update(chosen source URL)

Auto check → check_update_and_emit → uses config.update_source → emit event
```
