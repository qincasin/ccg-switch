//! Antigravity 本地应用集成层：进程管理、版本检测、凭据注入、账号切换。
//!
//! 职责：
//! - 检测/关闭/启动 Antigravity 进程（含 IDE 变体）
//! - 检测安装版本，选择凭据注入方式（Keychain >= 2.0.0，SQLite DB < 2.0.0）
//! - 写入 macOS Keychain / Windows Credential Manager / Linux Secret Service
//! - 编排完整的切换流程：关闭进程 → 注入凭据 → 重启进程

use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
use sysinfo::System;

// ── 进程检测 ──

/// 检��� Antigravity（或 Antigravity IDE）是否正在运行。
/// 排除 Helper/Renderer/GPU 等子进程，只匹配主进程。
pub fn is_antigravity_running(target_ide: Option<&str>) -> bool {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);
    let current_pid = std::process::id();

    for (pid, process) in system.processes() {
        if pid.as_u32() == current_pid {
            continue;
        }

        let name = process.name().to_string_lossy().to_lowercase();
        let exe_path = process
            .exe()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_lowercase();

        let args = process.cmd();
        let args_str = args
            .iter()
            .map(|arg| arg.to_string_lossy().to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");

        let is_helper = args_str.contains("--type=")
            || name.contains("helper")
            || name.contains("plugin")
            || name.contains("renderer")
            || name.contains("gpu")
            || name.contains("crashpad")
            || name.contains("utility")
            || name.contains("audio")
            || name.contains("sandbox")
            || exe_path.contains("crashpad");

        if is_helper {
            continue;
        }

        let is_match = if target_ide == Some("ide") {
            exe_path.contains("antigravity ide")
                || exe_path.contains("antigravity-ide")
                || name.contains("antigravity ide")
                || name.contains("antigravity-ide")
        } else {
            (exe_path.contains("antigravity") || name.contains("antigravity"))
                && !exe_path.contains("antigravity ide")
                && !exe_path.contains("antigravity-ide")
                && !name.contains("antigravity ide")
                && !name.contains("antigravity-ide")
        };

        if is_match {
            return true;
        }
    }
    false
}

/// Get PIDs of all Antigravity main processes (excluding helpers).
fn get_antigravity_pids(target_ide: Option<&str>) -> Vec<u32> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);
    let current_pid = std::process::id();
    let mut pids = Vec::new();

    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        if pid_u32 == current_pid {
            continue;
        }

        let name = process.name().to_string_lossy().to_lowercase();
        let exe_path = process
            .exe()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_lowercase();

        let args = process.cmd();
        let args_str = args
            .iter()
            .map(|arg| arg.to_string_lossy().to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");

        let is_helper = args_str.contains("--type=")
            || name.contains("helper")
            || name.contains("plugin")
            || name.contains("renderer")
            || name.contains("gpu")
            || name.contains("crashpad")
            || name.contains("utility")
            || name.contains("audio")
            || name.contains("sandbox");

        if is_helper {
            continue;
        }

        let is_match = if target_ide == Some("ide") {
            exe_path.contains("antigravity ide")
                || exe_path.contains("antigravity-ide")
                || name.contains("antigravity ide")
                || name.contains("antigravity-ide")
        } else {
            (exe_path.contains("antigravity") || name.contains("antigravity"))
                && !exe_path.contains("antigravity ide")
                && !exe_path.contains("antigravity-ide")
                && !name.contains("antigravity ide")
                && !name.contains("antigravity-ide")
        };

        if is_match {
            pids.push(pid_u32);
        }
    }
    pids
}

// ── 进程管理 ──

/// 关闭 Antigravity：先 SIGTERM 优雅关闭，超时后 SIGKILL 强制结束。
pub fn close_antigravity(timeout_secs: u64, target_ide: Option<&str>) -> Result<(), String> {
    tracing::info!("Closing Antigravity ({:?})...", target_ide);

    #[cfg(target_os = "windows")]
    {
        let pids = get_antigravity_pids(target_ide);
        for pid in &pids {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(0x08000000)
                .output();
        }
        thread::sleep(Duration::from_millis(200));
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let pids = get_antigravity_pids(target_ide);
        if pids.is_empty() {
            tracing::info!("Antigravity not running, no need to close");
            return Ok(());
        }

        // Phase 1: SIGTERM
        tracing::info!("Sending SIGTERM to {} processes", pids.len());
        for pid in &pids {
            let _ = Command::new("kill")
                .args(["-15", &pid.to_string()])
                .output();
        }

        let graceful_timeout = (timeout_secs * 7) / 10;
        let start = std::time::Instant::now();
        while start.elapsed() < Duration::from_secs(graceful_timeout) {
            if !is_antigravity_running(target_ide) {
                tracing::info!("Antigravity closed gracefully");
                return Ok(());
            }
            thread::sleep(Duration::from_millis(500));
        }

        // Phase 2: SIGKILL remaining
        let remaining = get_antigravity_pids(target_ide);
        if !remaining.is_empty() {
            tracing::warn!("Force killing {} remaining processes", remaining.len());
            for pid in &remaining {
                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
            thread::sleep(Duration::from_secs(1));
        }
    }

    Ok(())
}

/// 查找 Antigravity 安装路径（运行中进程 > 标准安装目录）。
pub fn find_antigravity_path(target_ide: Option<&str>) -> Option<PathBuf> {
    // Strategy 1: From running process
    if let Some(path) = find_path_from_running_process(target_ide) {
        return Some(path);
    }

    // Strategy 2: Standard locations
    find_standard_location(target_ide)
}

fn find_path_from_running_process(target_ide: Option<&str>) -> Option<PathBuf> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All);

    for (_, process) in system.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        let exe_path = process
            .exe()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_lowercase();

        let args = process.cmd();
        let args_str = args
            .iter()
            .map(|arg| arg.to_string_lossy().to_lowercase())
            .collect::<Vec<String>>()
            .join(" ");

        let is_helper = args_str.contains("--type=")
            || name.contains("helper")
            || name.contains("plugin")
            || name.contains("renderer")
            || name.contains("gpu")
            || name.contains("crashpad");

        if is_helper {
            continue;
        }

        let is_match = if target_ide == Some("ide") {
            exe_path.contains("antigravity ide") || exe_path.contains("antigravity-ide")
        } else {
            (exe_path.contains("antigravity") || name.contains("antigravity"))
                && !exe_path.contains("antigravity ide")
                && !exe_path.contains("antigravity-ide")
        };

        if is_match {
            if let Some(exe) = process.exe() {
                #[cfg(target_os = "macos")]
                {
                    let p = exe.to_string_lossy();
                    if p.contains("frameworks") {
                        // Inside Frameworks dir — extract .app path
                        if let Some(idx) = p.find(".app") {
                            return Some(PathBuf::from(&p[..idx + 4]));
                        }
                    }
                    if let Some(idx) = p.find(".app") {
                        return Some(PathBuf::from(&p[..idx + 4]));
                    }
                }
                return Some(exe.to_path_buf());
            }
        }
    }
    None
}

fn find_standard_location(target_ide: Option<&str>) -> Option<PathBuf> {
    let folder_name = if target_ide == Some("ide") {
        "Antigravity IDE"
    } else {
        "Antigravity"
    };

    #[cfg(target_os = "macos")]
    {
        let path = PathBuf::from(format!("/Applications/{}.app", folder_name));
        if path.exists() {
            return Some(path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let path = PathBuf::from(&local)
                .join("Programs")
                .join(folder_name)
                .join(format!("{}.exe", folder_name));
            if path.exists() {
                return Some(path);
            }
        }
        let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
        let path = PathBuf::from(&pf)
            .join(folder_name)
            .join(format!("{}.exe", folder_name));
        if path.exists() {
            return Some(path);
        }
    }

    #[cfg(target_os = "linux")]
    {
        let exe_name = if target_ide == Some("ide") {
            "antigravity-ide"
        } else {
            "antigravity"
        };
        let candidates = vec![
            PathBuf::from(format!("/usr/bin/{}", exe_name)),
            PathBuf::from(format!("/opt/{}/{}", folder_name, exe_name)),
        ];
        for path in candidates {
            if path.exists() {
                return Some(path);
            }
        }
        if let Some(home) = dirs::home_dir() {
            let p = home.join(format!(".local/bin/{}", exe_name));
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// 启动 Antigravity 应用（macOS 用 `open`，其他平台直接执行）。
pub fn start_antigravity(target_ide: Option<&str>) -> Result<(), String> {
    tracing::info!("Starting Antigravity ({:?})...", target_ide);

    start_antigravity_at_path(target_ide, None)
}

/// 用已知路径启动 Antigravity（优先使用缓存路径，避免关闭后找不到）。
pub fn start_antigravity_at_path(target_ide: Option<&str>, cached_path: Option<PathBuf>) -> Result<(), String> {
    let path = cached_path
        .or_else(|| find_antigravity_path(target_ide))
        .ok_or_else(|| "Cannot find Antigravity installation".to_string())?;

    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        if path_str.ends_with(".app") || path.is_dir() {
            let output = Command::new("open")
                .arg(&path_str)
                .output()
                .map_err(|e| format!("Failed to execute open command: {}", e))?;
            if !output.status.success() {
                let err = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Failed to start Antigravity: {}", err.trim()));
            }
        } else {
            Command::new(&path_str)
                .spawn()
                .map_err(|e| format!("Failed to start Antigravity: {}", e))?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to start Antigravity: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to start Antigravity: {}", e))?;
    }

    tracing::info!("Antigravity start command sent ({})", path_str);
    Ok(())
}

// ── 版本检测 ──

/// 检测 Antigravity 版本号（macOS 读 Info.plist，其他平台尝试 --version）。
fn get_antigravity_version(target_ide: Option<&str>) -> Option<String> {
    let exe_path = find_antigravity_path(target_ide)?;

    #[cfg(target_os = "macos")]
    {
        let path_str = exe_path.to_string_lossy();
        let app_path = if let Some(idx) = path_str.find(".app") {
            PathBuf::from(&path_str[..idx + 4])
        } else {
            exe_path
        };

        let plist_path = app_path.join("Contents/Info.plist");
        if !plist_path.exists() {
            return None;
        }

        let content = std::fs::read(&plist_path).ok()?;
        // Simple plist parsing: look for CFBundleShortVersionString
        let content_str = String::from_utf8_lossy(&content);
        extract_version_from_plist(&content_str)
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows/Linux, try running --version
        let output = Command::new(&exe_path)
            .arg("--version")
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        extract_semver(&stdout)
    }
}

fn extract_version_from_plist(content: &str) -> Option<String> {
    // Find the string after CFBundleShortVersionString
    let lines: Vec<&str> = content.lines().collect();
    for i in 0..lines.len() {
        if lines[i].contains("CFBundleShortVersionString") {
            // Next line with <string> tag
            for j in i + 1..lines.len().min(i + 3) {
                if let Some(start) = lines[j].find("<string>") {
                    if let Some(end) = lines[j].find("</string>") {
                        let version = &lines[j][start + 8..end];
                        return Some(version.trim().to_string());
                    }
                }
            }
        }
    }
    None
}

fn extract_semver(raw: &str) -> Option<String> {
    for token in raw.split(|c: char| c.is_whitespace() || c == ',' || c == ';') {
        let t = token.trim_matches(|c: char| c == '"' || c == '\'' || c == '(' || c == ')');
        let mut parts = t.split('.');
        let p1 = parts.next()?;
        let p2 = parts.next()?;
        let p3 = parts.next()?;
        if [p1, p2, p3].iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())) {
            return Some(t.to_string());
        }
    }
    None
}

/// Compare two version strings. Returns Ordering.
fn compare_version(v1: &str, v2: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse().ok())
            .collect::<Vec<_>>()
    };
    let p1 = parse(v1);
    let p2 = parse(v2);
    for i in 0..p1.len().max(p2.len()) {
        let a = p1.get(i).unwrap_or(&0);
        let b = p2.get(i).unwrap_or(&0);
        match a.cmp(b) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

// ── 凭据注入 ──

/// 将 token 写入系统凭据存储（macOS Keychain / Windows Credential Manager / Linux Secret Service）。
/// 用于 Antigravity >= 2.0.0 版本。
fn write_to_system_keyring(
    access_token: &str,
    refresh_token: &str,
    expiry_timestamp: i64,
) -> Result<(), String> {
    let expiry_dt = chrono::DateTime::from_timestamp(expiry_timestamp, 0)
        .unwrap_or_else(chrono::Utc::now);
    let expiry_str = expiry_dt.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);

    #[derive(serde::Serialize)]
    struct KeyringTokenDetails {
        access_token: String,
        token_type: String,
        refresh_token: String,
        expiry: String,
    }

    #[derive(serde::Serialize)]
    struct KeyringPayload {
        token: KeyringTokenDetails,
        auth_method: String,
    }

    let payload_json = serde_json::to_string(&KeyringPayload {
        token: KeyringTokenDetails {
            access_token: access_token.to_string(),
            token_type: "Bearer".to_string(),
            refresh_token: refresh_token.to_string(),
            expiry: expiry_str,
        },
        auth_method: "consumer".to_string(),
    })
    .map_err(|e| format!("Failed to serialize keyring payload: {}", e))?;

    tracing::info!("Writing token to system credential store");

    #[cfg(target_os = "macos")]
    {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        let encoded = STANDARD.encode(&payload_json);
        let full_value = format!("go-keyring-base64:{}", encoded);

        // Delete old entry
        let _ = Command::new("security")
            .args(["delete-generic-password", "-s", "gemini", "-a", "antigravity"])
            .output();

        // Write new entry (-A allows all local apps to read without password)
        let output = Command::new("security")
            .args([
                "add-generic-password",
                "-s", "gemini",
                "-a", "antigravity",
                "-w", &full_value,
                "-A",
            ])
            .output()
            .map_err(|e| format!("Failed to execute security command: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("macOS Keychain write failed: {}", err_msg.trim()));
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::ptr;
        use std::os::windows::ffi::OsStrExt;

        #[repr(C)]
        struct FILETIME {
            dw_low_date_time: u32,
            dw_high_date_time: u32,
        }

        #[repr(C)]
        struct CREDENTIALW {
            flags: u32,
            cred_type: u32,
            target_name: *const u16,
            comment: *const u16,
            last_written: FILETIME,
            credential_blob_size: u32,
            credential_blob: *const u8,
            persist: u32,
            attribute_count: u32,
            attributes: *const std::ffi::c_void,
            target_alias: *const u16,
            user_name: *const u16,
        }

        #[link(name = "advapi32")]
        extern "system" {
            fn CredWriteW(credential: *const CREDENTIALW, flags: u32) -> i32;
            fn CredDeleteW(target_name: *const u16, type_: u32, flags: u32) -> i32;
        }

        let target = "gemini:antigravity";
        let secret = payload_json.as_bytes();

        let target_wide: Vec<u16> = std::ffi::OsStr::new(target)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let user_wide: Vec<u16> = std::ffi::OsStr::new("antigravity")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let cred = CREDENTIALW {
            flags: 0,
            cred_type: 1,
            target_name: target_wide.as_ptr(),
            comment: ptr::null(),
            last_written: FILETIME { dw_low_date_time: 0, dw_high_date_time: 0 },
            credential_blob_size: secret.len() as u32,
            credential_blob: secret.as_ptr(),
            persist: 2,
            attribute_count: 0,
            attributes: ptr::null(),
            target_alias: ptr::null(),
            user_name: user_wide.as_ptr(),
        };

        unsafe {
            let _ = CredDeleteW(target_wide.as_ptr(), 1, 0);
            let res = CredWriteW(&cred, 0);
            if res == 0 {
                return Err(format!("Windows CredWriteW failed: {}", std::io::Error::last_os_error()));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        let mut child = Command::new("secret-tool")
            .args(["store", "--label=gemini", "service", "gemini", "username", "antigravity"])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn secret-tool: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(payload_json.as_bytes())
                .map_err(|e| format!("Failed to write to secret-tool: {}", e))?;
        }

        let output = child.wait_with_output()
            .map_err(|e| format!("Failed to wait for secret-tool: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Linux secret-tool failed: {}", err_msg.trim()));
        }
    }

    tracing::info!("Successfully wrote token to system credential store");
    Ok(())
}

/// Get the Antigravity state.vscdb path (for older versions using SQLite).
fn get_db_path(target_ide: Option<&str>) -> Option<PathBuf> {
    let folder_name = if target_ide == Some("ide") {
        "Antigravity IDE"
    } else {
        "Antigravity"
    };

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir()?;
        let path = home.join(format!(
            "Library/Application Support/{}/User/globalStorage/state.vscdb",
            folder_name
        ));
        if path.exists() {
            return Some(path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let path = PathBuf::from(appdata)
                .join(folder_name)
                .join("User\\globalStorage\\state.vscdb");
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir()?;
        let path = home.join(format!(".config/{}/User/globalStorage/state.vscdb", folder_name));
        if path.exists() {
            return Some(path);
        }
    }

    None
}

/// Simple DB injection for older Antigravity versions — just write the onboarding flag
/// and a simple auth hint. Full protobuf-based injection is in Antigravity-Manager.
fn inject_db_simple(
    db_path: &PathBuf,
    _access_token: &str,
    _refresh_token: &str,
    _email: &str,
) -> Result<(), String> {
    // For older versions, the primary injection is via protobuf which is complex.
    // We write the onboarding flag at minimum.
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Failed to open Antigravity DB: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        ["antigravityOnboarding", "true"],
    )
    .map_err(|e| format!("Failed to write onboarding flag: {}", e))?;

    tracing::info!("DB simple injection completed");
    Ok(())
}

	// ── 主切换流程 ──

/// 账号切换所需的凭据数据。
pub struct SwitchAccountData {
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expiry_timestamp: i64,
}

/// 执行完整的本地账号切换：关闭进程 → 注入凭据 → 重启进程。
///
/// 自动检测 Antigravity 版本选择注入方式（Keychain >= 2.0.0，SQLite < 2.0.0）。
pub fn execute_local_switch(
    account: &SwitchAccountData,
    target_ide: Option<&str>,
) -> Result<(), String> {
    tracing::info!(
        "Executing local switch for {} (target_ide: {:?})",
        account.email,
        target_ide
    );

    // 1. Capture app path before closing (so we can restart after)
    let app_path = find_antigravity_path(target_ide);

    // 2. Close Antigravity if running
    if is_antigravity_running(target_ide) {
        close_antigravity(20, target_ide)?;
        thread::sleep(Duration::from_millis(500));
    }

    // 2. Determine injection method based on version
    let use_keyring = match get_antigravity_version(target_ide) {
        Some(ver) => {
            tracing::info!("Detected Antigravity version: {}", ver);
            compare_version(&ver, "2.0.0") != std::cmp::Ordering::Less
        }
        None => {
            // If version detection fails, default to keyring (modern approach)
            tracing::warn!(
                "Could not detect Antigravity version, defaulting to Keychain injection"
            );
            true
        }
    };

    if use_keyring {
        // Modern path: write to system Keychain/Credential Manager
        write_to_system_keyring(
            &account.access_token,
            &account.refresh_token,
            account.expiry_timestamp,
        )?;
    } else {
        // Legacy path: inject into SQLite DB
        if let Some(db_path) = get_db_path(target_ide) {
            tracing::info!("Using legacy DB injection at {:?}", db_path);
            // Backup first
            let backup_path = db_path.with_extension("vscdb.backup");
            let _ = std::fs::copy(&db_path, &backup_path);
            inject_db_simple(
                &db_path,
                &account.access_token,
                &account.refresh_token,
                &account.email,
            )?;
        } else {
            tracing::warn!("No DB path found for legacy injection, trying keyring fallback");
            write_to_system_keyring(
                &account.access_token,
                &account.refresh_token,
                account.expiry_timestamp,
            )?;
        }
    }

    // 3. Restart Antigravity (use cached path to avoid "not found" after close)
    start_antigravity_at_path(target_ide, app_path)?;

    tracing::info!("Local switch completed for {}", account.email);
    Ok(())
}

#[cfg(target_os = "windows")]
trait CommandExt {
    fn creation_flags(&mut self, flags: u32) -> &mut Command;
}

#[cfg(target_os = "windows")]
impl CommandExt for Command {
    fn creation_flags(&mut self, flags: u32) -> &mut Command {
        use std::os::windows::process::CommandExt;
        self.as_std().creation_flags(flags);
        self
    }
}
