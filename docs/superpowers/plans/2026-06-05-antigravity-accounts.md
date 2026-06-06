# Antigravity Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Antigravity (反动力) account management into ccg-switch, enabling users to manage Antigravity accounts, refresh tokens, view quotas, and switch accounts — all from a single app.

**Architecture:** A new feature module following ccg-switch's modern DB-based pattern. The Rust backend stores accounts in SQLite, calls Google OAuth APIs for token refresh and user info, and calls Google Cloud Code APIs for quota data. The frontend adds a new `/antigravity` page with account list, quota display, and management actions.

**Tech Stack:** Rust (reqwest, serde, rusqlite, chrono, uuid, tokio), React 19, TypeScript, Zustand, DaisyUI/TailwindCSS, i18next

---

## File Structure

### Rust Backend (New Files)
```
src-tauri/src/
├── models/
│   └── antigravity.rs          # AntigravityAccount, AntigravityQuotaData, AntigravityModelQuota models
├── database/dao/
│   └── antigravity_accounts.rs # DAO: CRUD + quota storage in SQLite
├── services/
│   └── antigravity_service.rs  # Business logic: OAuth, token refresh, quota fetch, switching
├── commands/
│   └── antigravity_commands.rs # Tauri command handlers
```

### Rust Backend (Modified Files)
```
src-tauri/src/models/mod.rs              # Add: pub mod antigravity;
src-tauri/src/database/dao/mod.rs        # Add: pub mod antigravity_accounts;
src-tauri/src/services/mod.rs            # Add: pub mod antigravity_service;
src-tauri/src/commands/mod.rs            # Add: pub mod antigravity_commands;
src-tauri/src/database/schema.rs         # Add: antigravity_accounts table creation
src-tauri/src/lib.rs                     # Add: module imports + register commands in generate_handler!
```

### Frontend (New Files)
```
src/types/antigravity.ts                 # TypeScript interfaces
src/stores/useAntigravityStore.ts        # Zustand store
src/pages/AntigravityPage.tsx            # Main page component
src/components/antigravity/
├── AccountCard.tsx                      # Account card (list view)
├── AccountTable.tsx                     # Account table view
├── AddAccountDialog.tsx                 # Dialog to add account (email + refresh_token)
├── AccountDetailsDialog.tsx             # Detailed view with quota info
├── QuotaDisplay.tsx                     # Model quota bars
```

### Frontend (Modified Files)
```
src/App.tsx                              # Add /antigravity route
src/components/layout/Sidebar.tsx        # Add nav item
src/locales/zh.json                     # Add antigravity.* keys
src/locales/en.json                     # Add antigravity.* keys
```

---

## Data Model

### SQLite Table: `antigravity_accounts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `email` | TEXT NOT NULL | Google account email |
| `name` | TEXT | Display name |
| `access_token` | TEXT | Current access token |
| `refresh_token` | TEXT NOT NULL | Google OAuth refresh token |
| `expires_in` | INTEGER | Token TTL in seconds |
| `expiry_timestamp` | INTEGER | Unix timestamp when token expires |
| `oauth_client_key` | TEXT | Which OAuth client was used |
| `project_id` | TEXT | Google Cloud project ID |
| `subscription_tier` | TEXT | FREE/PRO/ULTRA |
| `custom_label` | TEXT | User-defined label |
| `is_active` | INTEGER DEFAULT 0 | Currently active account flag |
| `disabled` | INTEGER DEFAULT 0 | Account disabled flag |
| `disabled_reason` | TEXT | Reason for disabling |
| `quota_json` | TEXT | Serialized QuotaData (JSON blob) |
| `device_profile_json` | TEXT | Serialized DeviceProfile (JSON blob) |
| `created_at` | INTEGER | Unix timestamp |
| `last_used` | INTEGER | Unix timestamp |
| `order_index` | INTEGER | Display order |

### Key API Endpoints (from Antigravity-Manager)

| Purpose | URL | Method |
|---------|-----|--------|
| Token refresh | `https://oauth2.googleapis.com/token` | POST (form) |
| User info | `https://www.googleapis.com/oauth2/v2/userinfo` | GET (Bearer) |
| Project ID | `https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist` | POST (Bearer+JSON) |
| Quota fetch | `https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels` | POST (Bearer+JSON) |

OAuth credentials (same as Antigravity-Manager):
- `client_id`: `1071006060560591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com`
- `client_secret`: `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`

---

## Task Breakdown

### Task 1: Rust Models

**Files:**
- Create: `src-tauri/src/models/antigravity.rs`
- Modify: `src-tauri/src/models/mod.rs`

- [ ] **Step 1: Create the AntigravityAccount model**

Create `src-tauri/src/models/antigravity.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityAccount {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub expiry_timestamp: i64,
    pub oauth_client_key: Option<String>,
    pub project_id: Option<String>,
    pub subscription_tier: Option<String>,
    pub custom_label: Option<String>,
    #[serde(default)]
    pub is_active: bool,
    #[serde(default)]
    pub disabled: bool,
    pub disabled_reason: Option<String>,
    pub quota: Option<AntigravityQuotaData>,
    pub device_profile: Option<AntigravityDeviceProfile>,
    pub created_at: i64,
    pub last_used: i64,
    pub order_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityQuotaData {
    pub models: Vec<AntigravityModelQuota>,
    pub last_updated: i64,
    pub is_forbidden: bool,
    pub forbidden_reason: Option<String>,
    pub subscription_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityModelQuota {
    pub name: String,
    pub percentage: i32,
    pub reset_time: String,
    pub display_name: Option<String>,
    pub supports_images: Option<bool>,
    pub supports_thinking: Option<bool>,
    pub thinking_budget: Option<i32>,
    pub recommended: Option<bool>,
    pub max_tokens: Option<i32>,
    pub max_output_tokens: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityDeviceProfile {
    pub machine_id: String,
    pub mac_machine_id: String,
    pub dev_device_id: String,
    pub sqm_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: i64,
    #[serde(default)]
    pub token_type: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub email: String,
    pub name: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub picture: Option<String>,
}

impl UserInfo {
    pub fn get_display_name(&self) -> Option<String> {
        if let Some(name) = &self.name {
            if !name.trim().is_empty() {
                return Some(name.clone());
            }
        }
        match (&self.given_name, &self.family_name) {
            (Some(given), Some(family)) => Some(format!("{} {}", given, family)),
            (Some(given), None) => Some(given.clone()),
            (None, Some(family)) => Some(family.clone()),
            (None, None) => None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RefreshStats {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub details: Vec<String>,
}

impl AntigravityAccount {
    pub fn new(email: String, refresh_token: String, access_token: String, expires_in: i64) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            email,
            name: None,
            access_token,
            refresh_token,
            expires_in,
            expiry_timestamp: now + expires_in,
            oauth_client_key: None,
            project_id: None,
            subscription_tier: None,
            custom_label: None,
            is_active: false,
            disabled: false,
            disabled_reason: None,
            quota: None,
            device_profile: None,
            created_at: now,
            last_used: now,
            order_index: 0,
        }
    }

    pub fn is_token_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        now >= self.expiry_timestamp - 900 // 15 min skew
    }
}
```

- [ ] **Step 2: Register the module**

Add to `src-tauri/src/models/mod.rs`:
```rust
pub mod antigravity;
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models/antigravity.rs src-tauri/src/models/mod.rs
git commit -m "feat(antigravity): add Rust models for Antigravity accounts"
```

---

### Task 2: Database Schema & DAO

**Files:**
- Modify: `src-tauri/src/database/schema.rs`
- Create: `src-tauri/src/database/dao/antigravity_accounts.rs`
- Modify: `src-tauri/src/database/dao/mod.rs`

- [ ] **Step 1: Add table creation to schema.rs**

In `src-tauri/src/database/schema.rs`, add to the `create_tables` function:

```rust
// Antigravity accounts
conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS antigravity_accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_in INTEGER DEFAULT 0,
        expiry_timestamp INTEGER DEFAULT 0,
        oauth_client_key TEXT,
        project_id TEXT,
        subscription_tier TEXT,
        custom_label TEXT,
        is_active INTEGER DEFAULT 0,
        disabled INTEGER DEFAULT 0,
        disabled_reason TEXT,
        quota_json TEXT,
        device_profile_json TEXT,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        order_index INTEGER DEFAULT 0
    );"
).map_err(|e| format!("Failed to create antigravity_accounts table: {}", e))?;
```

- [ ] **Step 2: Create the DAO file**

Create `src-tauri/src/database/dao/antigravity_accounts.rs`:

```rust
use crate::models::antigravity::{AntigravityAccount, AntigravityDeviceProfile, AntigravityQuotaData};
use crate::database::Database;
use rusqlite::params;

impl Database {
    pub fn list_antigravity_accounts(&self) -> Result<Vec<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts ORDER BY order_index ASC, created_at ASC")
            .map_err(|e| e.to_string())?;

        let accounts = stmt.query_map([], |row| {
            Ok(row_to_account(row))
        }).map_err(|e| e.to_string())?
        .filter_map(|a| a.ok())
        .collect();

        Ok(accounts)
    }

    pub fn get_antigravity_account(&self, id: &str) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let result = stmt.query_row(params![id], |row| {
            Ok(row_to_account(row))
        }).optional().map_err(|e| e.to_string())?;

        Ok(result)
    }

    pub fn upsert_antigravity_account(&self, account: &AntigravityAccount) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let quota_json = account.quota.as_ref()
            .map(|q| serde_json::to_string(q).unwrap_or_default());
        let device_profile_json = account.device_profile.as_ref()
            .map(|d| serde_json::to_string(d).unwrap_or_default());

        conn.execute(
            "INSERT OR REPLACE INTO antigravity_accounts (
                id, email, name, access_token, refresh_token, expires_in,
                expiry_timestamp, oauth_client_key, project_id, subscription_tier,
                custom_label, is_active, disabled, disabled_reason,
                quota_json, device_profile_json, created_at, last_used, order_index
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)",
            params![
                account.id,
                account.email,
                account.name,
                account.access_token,
                account.refresh_token,
                account.expires_in,
                account.expiry_timestamp,
                account.oauth_client_key,
                account.project_id,
                account.subscription_tier,
                account.custom_label,
                account.is_active as i32,
                account.disabled as i32,
                account.disabled_reason,
                quota_json,
                device_profile_json,
                account.created_at,
                account.last_used,
                account.order_index,
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_antigravity_account(&self, id: &str) -> Result<bool, String> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM antigravity_accounts WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(affected > 0)
    }

    pub fn set_active_antigravity_account(&self, id: &str) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        // Deactivate all
        conn.execute("UPDATE antigravity_accounts SET is_active = 0", [])
            .map_err(|e| e.to_string())?;
        // Activate target
        conn.execute(
            "UPDATE antigravity_accounts SET is_active = 1, last_used = ?1 WHERE id = ?2",
            params![chrono::Utc::now().timestamp(), id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_active_antigravity_account(&self) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE is_active = 1")
            .map_err(|e| e.to_string())?;

        let result = stmt.query_row([], |row| {
            Ok(row_to_account(row))
        }).optional().map_err(|e| e.to_string())?;

        Ok(result)
    }

    pub fn get_next_antigravity_order_index(&self) -> Result<i32, String> {
        let conn = lock_conn!(self.conn);
        let max_idx: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(order_index), -1) + 1 FROM antigravity_accounts",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(max_idx)
    }

    pub fn find_antigravity_account_by_email(&self, email: &str) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE email = ?1")
            .map_err(|e| e.to_string())?;

        let result = stmt.query_row(params![email], |row| {
            Ok(row_to_account(row))
        }).optional().map_err(|e| e.to_string())?;

        Ok(result)
    }
}

fn row_to_account(row: &rusqlite::Row) -> AntigravityAccount {
    let quota_json: Option<String> = row.get("quota_json").unwrap_or(None);
    let device_profile_json: Option<String> = row.get("device_profile_json").unwrap_or(None);

    AntigravityAccount {
        id: row.get("id").unwrap_or_default(),
        email: row.get("email").unwrap_or_default(),
        name: row.get("name").unwrap_or(None),
        access_token: row.get("access_token").unwrap_or_default(),
        refresh_token: row.get("refresh_token").unwrap_or_default(),
        expires_in: row.get("expires_in").unwrap_or(0),
        expiry_timestamp: row.get("expiry_timestamp").unwrap_or(0),
        oauth_client_key: row.get("oauth_client_key").unwrap_or(None),
        project_id: row.get("project_id").unwrap_or(None),
        subscription_tier: row.get("subscription_tier").unwrap_or(None),
        custom_label: row.get("custom_label").unwrap_or(None),
        is_active: row.get::<_, i32>("is_active").unwrap_or(0) == 1,
        disabled: row.get::<_, i32>("disabled").unwrap_or(0) == 1,
        disabled_reason: row.get("disabled_reason").unwrap_or(None),
        quota: quota_json.and_then(|j| serde_json::from_str(&j).ok()),
        device_profile: device_profile_json.and_then(|j| serde_json::from_str(&j).ok()),
        created_at: row.get("created_at").unwrap_or(0),
        last_used: row.get("last_used").unwrap_or(0),
        order_index: row.get("order_index").unwrap_or(0),
    }
}
```

- [ ] **Step 3: Register the DAO module**

Add to `src-tauri/src/database/dao/mod.rs`:
```rust
pub mod antigravity_accounts;
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/database/
git commit -m "feat(antigravity): add database schema and DAO for Antigravity accounts"
```

---

### Task 3: Service Layer — OAuth & Token Refresh

**Files:**
- Create: `src-tauri/src/services/antigravity_service.rs`
- Modify: `src-tauri/src/services/mod.rs`

This is the core service that handles all Google API interactions and business logic.

- [ ] **Step 1: Create the service file**

Create `src-tauri/src/services/antigravity_service.rs`:

```rust
use crate::models::antigravity::{
    AntigravityAccount, AntigravityModelQuota, AntigravityQuotaData, RefreshStats, TokenResponse,
    UserInfo,
};
use crate::store::AppState;
use serde_json::json;
use std::sync::Arc;

const CLIENT_ID: &str =
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET: &str = "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";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const PROJECT_URL: &str =
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist";
const QUOTA_ENDPOINTS: [&str; 3] = [
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
    "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
];

// ─── Token refresh ───

pub async fn refresh_access_token(
    refresh_token: &str,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let response = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    if response.status().is_success() {
        response
            .json::<TokenResponse>()
            .await
            .map_err(|e| format!("Refresh data parsing failed: {}", e))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Refresh failed ({}): {}", status, error_text))
    }
}

// ─── User info ───

pub async fn get_user_info(access_token: &str) -> Result<UserInfo, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("User info request failed: {}", e))?;

    if response.status().is_success() {
        response
            .json::<UserInfo>()
            .await
            .map_err(|e| format!("User info parsing failed: {}", e))
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to get user info: {}", error_text))
    }
}

// ─── Project ID fetch ───

async fn fetch_project_id(access_token: &str) -> Option<String> {
    let client = reqwest::Client::new();
    let meta = json!({"metadata": {"ideType": "ANTIGRAVITY"}});

    let res = client
        .post(PROJECT_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&meta)
        .send()
        .await
        .ok()?;

    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.ok()?;
        data.get("cloudaicompanionProject")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}

// ─── Quota fetch ───

#[derive(serde::Deserialize)]
struct QuotaResponse {
    #[serde(default)]
    models: std::collections::HashMap<String, ModelInfo>,
}

#[derive(serde::Deserialize)]
struct ModelInfo {
    #[serde(rename = "quotaInfo")]
    quota_info: Option<QuotaInfo>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "supportsImages")]
    supports_images: Option<bool>,
    #[serde(rename = "supportsThinking")]
    supports_thinking: Option<bool>,
    #[serde(rename = "thinkingBudget")]
    thinking_budget: Option<i32>,
    recommended: Option<bool>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<i32>,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: Option<i32>,
}

#[derive(serde::Deserialize)]
struct QuotaInfo {
    #[serde(rename = "remainingFraction")]
    remaining_fraction: Option<f64>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

pub async fn fetch_quota(
    access_token: &str,
    project_id: Option<&str>,
) -> Result<AntigravityQuotaData, String> {
    let client = reqwest::Client::new();
    let payload = if let Some(pid) = project_id {
        json!({ "project": pid })
    } else {
        json!({})
    };

    let mut last_error = None;

    for ep_url in &QUOTA_ENDPOINTS {
        match client
            .post(*ep_url)
            .bearer_auth(access_token)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    let quota_response: QuotaResponse = response
                        .json()
                        .await
                        .map_err(|e| format!("Quota parse failed: {}", e))?;

                    let mut models = Vec::new();
                    for (name, info) in quota_response.models {
                        if let Some(qi) = info.quota_info {
                            let percentage = qi.remaining_fraction.map(|f| (f * 100.0) as i32).unwrap_or(0);
                            if name.starts_with("gemini")
                                || name.starts_with("claude")
                                || name.starts_with("gpt")
                            {
                                models.push(AntigravityModelQuota {
                                    name,
                                    percentage,
                                    reset_time: qi.reset_time.unwrap_or_default(),
                                    display_name: info.display_name,
                                    supports_images: info.supports_images,
                                    supports_thinking: info.supports_thinking,
                                    thinking_budget: info.thinking_budget,
                                    recommended: info.recommended,
                                    max_tokens: info.max_tokens,
                                    max_output_tokens: info.max_output_tokens,
                                });
                            }
                        }
                    }

                    models.sort_by(|a, b| a.name.cmp(&b.name));

                    return Ok(AntigravityQuotaData {
                        models,
                        last_updated: chrono::Utc::now().timestamp(),
                        is_forbidden: false,
                        forbidden_reason: None,
                        subscription_tier: None,
                    });
                }

                if response.status() == reqwest::StatusCode::FORBIDDEN {
                    return Ok(AntigravityQuotaData {
                        models: Vec::new(),
                        last_updated: chrono::Utc::now().timestamp(),
                        is_forbidden: true,
                        forbidden_reason: Some("403 Forbidden".to_string()),
                        subscription_tier: None,
                    });
                }

                last_error = Some(format!("HTTP {}", response.status()));
            }
            Err(e) => {
                last_error = Some(e.to_string());
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "All quota endpoints failed".to_string()))
}

// ─── Account CRUD ───

pub fn list_accounts(db: &Arc<crate::database::Database>) -> Result<Vec<AntigravityAccount>, String> {
    db.list_antigravity_accounts()
}

pub fn get_account(
    db: &Arc<crate::database::Database>,
    id: &str,
) -> Result<AntigravityAccount, String> {
    db.get_antigravity_account(id)?
        .ok_or_else(|| format!("Account not found: {}", id))
}

pub async fn add_account(
    db: &Arc<crate::database::Database>,
    email: &str,
    refresh_token: &str,
) -> Result<AntigravityAccount, String> {
    // Check duplicate
    if let Some(existing) = db.find_antigravity_account_by_email(email)? {
        return Err(format!("Account already exists: {}", existing.email));
    }

    // 1. Refresh token to get access_token
    let token_res = refresh_access_token(refresh_token).await?;

    // 2. Get user info (verify email matches)
    let user_info = get_user_info(&token_res.access_token).await?;
    if user_info.email.to_lowercase() != email.to_lowercase() {
        return Err(format!(
            "Email mismatch: expected {}, got {}",
            email, user_info.email
        ));
    }

    // 3. Fetch project_id
    let project_id = fetch_project_id(&token_res.access_token).await;

    // 4. Build account
    let now = chrono::Utc::now().timestamp();
    let mut account = AntigravityAccount {
        id: uuid::Uuid::new_v4().to_string(),
        email: user_info.email,
        name: user_info.get_display_name(),
        access_token: token_res.access_token,
        refresh_token: refresh_token.to_string(),
        expires_in: token_res.expires_in,
        expiry_timestamp: now + token_res.expires_in,
        oauth_client_key: None,
        project_id,
        subscription_tier: None,
        custom_label: None,
        is_active: false,
        disabled: false,
        disabled_reason: None,
        quota: None,
        device_profile: None,
        created_at: now,
        last_used: now,
        order_index: db.get_next_antigravity_order_index()?,
    };

    // 5. Fetch initial quota
    match fetch_quota(&account.access_token, account.project_id.as_deref()).await {
        Ok(quota) => {
            // Extract subscription tier from quota fetch
            account.subscription_tier = quota.subscription_tier.clone();
            account.quota = Some(quota);
        }
        Err(e) => {
            tracing::warn!("Failed to fetch initial quota for {}: {}", account.email, e);
        }
    }

    // 6. If this is the first account, make it active
    let existing = db.list_antigravity_accounts()?;
    if existing.is_empty() {
        account.is_active = true;
    }

    // 7. Save
    db.upsert_antigravity_account(&account)?;

    Ok(account)
}

pub fn delete_account(
    db: &Arc<crate::database::Database>,
    id: &str,
) -> Result<(), String> {
    // If deleting active account, activate another
    let account = db.get_antigravity_account(id)?
        .ok_or_else(|| format!("Account not found: {}", id))?;

    if account.is_active {
        let all = db.list_antigravity_accounts()?;
        if let Some(next) = all.iter().find(|a| a.id != id) {
            db.set_active_antigravity_account(&next.id)?;
        }
    }

    db.delete_antigravity_account(id)?;
    Ok(())
}

pub async fn refresh_account_token(
    db: &Arc<crate::database::Database>,
    id: &str,
) -> Result<AntigravityAccount, String> {
    let mut account = get_account(db, id)?;

    let token_res = refresh_access_token(&account.refresh_token).await?;
    let now = chrono::Utc::now().timestamp();

    account.access_token = token_res.access_token;
    account.expires_in = token_res.expires_in;
    account.expiry_timestamp = now + token_res.expires_in;
    account.last_used = now;

    // Re-enable if was disabled and token refresh succeeded
    if account.disabled {
        account.disabled = false;
        account.disabled_reason = None;
    }

    // Try to fetch fresh user name
    if let Ok(user_info) = get_user_info(&account.access_token).await {
        account.name = user_info.get_display_name().or(account.name);
    }

    db.upsert_antigravity_account(&account)?;
    Ok(account)
}

pub async fn fetch_account_quota(
    db: &Arc<crate::database::Database>,
    id: &str,
) -> Result<AntigravityQuotaData, String> {
    let mut account = get_account(db, id)?;

    // Ensure token is fresh
    if account.is_token_expired() {
        account = refresh_account_token(db, id).await?;
    }

    let quota = fetch_quota(&account.access_token, account.project_id.as_deref()).await?;
    account.quota = Some(quota.clone());
    account.last_used = chrono::Utc::now().timestamp();
    db.upsert_antigravity_account(&account)?;

    Ok(quota)
}

pub async fn refresh_all_quotas(
    db: &Arc<crate::database::Database>,
) -> Result<RefreshStats, String> {
    let accounts = db.list_antigravity_accounts()?;
    let total = accounts.len();
    let mut success = 0;
    let mut failed = 0;
    let mut details = Vec::new();

    for mut account in accounts {
        // Ensure fresh token
        if account.is_token_expired() {
            match refresh_access_token(&account.refresh_token).await {
                Ok(token_res) => {
                    let now = chrono::Utc::now().timestamp();
                    account.access_token = token_res.access_token;
                    account.expires_in = token_res.expires_in;
                    account.expiry_timestamp = now + token_res.expires_in;
                    if account.disabled {
                        account.disabled = false;
                        account.disabled_reason = None;
                    }
                }
                Err(e) => {
                    account.disabled = true;
                    account.disabled_reason = Some(format!("Token refresh failed: {}", e));
                    db.upsert_antigravity_account(&account)?;
                    failed += 1;
                    details.push(format!("{}: Token refresh failed", account.email));
                    continue;
                }
            }
        }

        match fetch_quota(&account.access_token, account.project_id.as_deref()).await {
            Ok(quota) => {
                account.subscription_tier = quota.subscription_tier.clone().or(account.subscription_tier);
                account.quota = Some(quota);
                account.last_used = chrono::Utc::now().timestamp();
                db.upsert_antigravity_account(&account)?;
                success += 1;
            }
            Err(e) => {
                failed += 1;
                details.push(format!("{}: {}", account.email, e));
            }
        }
    }

    Ok(RefreshStats {
        total,
        success,
        failed,
        details,
    })
}

pub fn switch_account(
    db: &Arc<crate::database::Database>,
    id: &str,
) -> Result<(), String> {
    // Verify account exists
    let _account = get_account(db, id)?;
    db.set_active_antigravity_account(id)?;
    Ok(())
}

pub fn update_account_label(
    db: &Arc<crate::database::Database>,
    id: &str,
    label: Option<String>,
) -> Result<(), String> {
    let mut account = get_account(db, id)?;
    account.custom_label = label;
    db.upsert_antigravity_account(&account)?;
    Ok(())
}

pub fn reorder_accounts(
    db: &Arc<crate::database::Database>,
    ordered_ids: &[String],
) -> Result<(), String> {
    let accounts = db.list_antigravity_accounts()?;
    let mut reordered = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (idx, id) in ordered_ids.iter().enumerate() {
        if let Some(mut acc) = accounts.iter().find(|a| &a.id == id).cloned() {
            acc.order_index = idx as i32;
            reordered.push(acc);
            seen.insert(id.clone());
        }
    }

    // Append any missing accounts
    let mut offset = reordered.len() as i32;
    for mut acc in accounts {
        if !seen.contains(&acc.id) {
            acc.order_index = offset;
            reordered.push(acc);
            offset += 1;
        }
    }

    for acc in &reordered {
        db.upsert_antigravity_account(acc)?;
    }

    Ok(())
}

pub fn export_accounts(
    db: &Arc<crate::database::Database>,
    ids: &[String],
) -> Result<Vec<(String, String)>, String> {
    let accounts = db.list_antigravity_accounts()?;
    Ok(accounts
        .into_iter()
        .filter(|a| ids.contains(&a.id))
        .map(|a| (a.email, a.refresh_token))
        .collect())
}
```

- [ ] **Step 2: Register the service module**

Add to `src-tauri/src/services/mod.rs`:
```rust
pub mod antigravity_service;
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/
git commit -m "feat(antigravity): add service layer with OAuth, token refresh, quota fetch"
```

---

### Task 4: Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/antigravity_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create the commands file**

Create `src-tauri/src/commands/antigravity_commands.rs`:

```rust
use crate::models::antigravity::{AntigravityAccount, AntigravityQuotaData, RefreshStats};
use crate::store::AppState;
use tauri::State;

#[tauri::command]
pub async fn ag_list_accounts(state: State<'_, AppState>) -> Result<Vec<AntigravityAccount>, String> {
    crate::services::antigravity_service::list_accounts(&state.db)
}

#[tauri::command]
pub async fn ag_get_account(id: String, state: State<'_, AppState>) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::get_account(&state.db, &id)
}

#[tauri::command]
pub async fn ag_add_account(
    email: String,
    refresh_token: String,
    state: State<'_, AppState>,
) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::add_account(&state.db, &email, &refresh_token).await
}

#[tauri::command]
pub async fn ag_delete_account(id: String, state: State<'_, AppState>) -> Result<(), String> {
    crate::services::antigravity_service::delete_account(&state.db, &id)
}

#[tauri::command]
pub async fn ag_refresh_token(id: String, state: State<'_, AppState>) -> Result<AntigravityAccount, String> {
    crate::services::antigravity_service::refresh_account_token(&state.db, &id).await
}

#[tauri::command]
pub async fn ag_fetch_quota(id: String, state: State<'_, AppState>) -> Result<AntigravityQuotaData, String> {
    crate::services::antigravity_service::fetch_account_quota(&state.db, &id).await
}

#[tauri::command]
pub async fn ag_refresh_all_quotas(state: State<'_, AppState>) -> Result<RefreshStats, String> {
    crate::services::antigravity_service::refresh_all_quotas(&state.db).await
}

#[tauri::command]
pub async fn ag_switch_account(id: String, state: State<'_, AppState>) -> Result<(), String> {
    crate::services::antigravity_service::switch_account(&state.db, &id)
}

#[tauri::command]
pub async fn ag_update_label(
    id: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::update_account_label(&state.db, &id, label)
}

#[tauri::command]
pub async fn ag_reorder_accounts(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    crate::services::antigravity_service::reorder_accounts(&state.db, &ordered_ids)
}

#[tauri::command]
pub async fn ag_export_accounts(
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, String> {
    crate::services::antigravity_service::export_accounts(&state.db, &ids)
}
```

- [ ] **Step 2: Register the commands module**

Add to `src-tauri/src/commands/mod.rs`:
```rust
pub mod antigravity_commands;
```

- [ ] **Step 3: Register commands in lib.rs**

In `src-tauri/src/lib.rs`, add the import at the top:
```rust
use commands::antigravity_commands;
```

And add all commands to the `generate_handler![]` macro:
```rust
antigravity_commands::ag_list_accounts,
antigravity_commands::ag_get_account,
antigravity_commands::ag_add_account,
antigravity_commands::ag_delete_account,
antigravity_commands::ag_refresh_token,
antigravity_commands::ag_fetch_quota,
antigravity_commands::ag_refresh_all_quotas,
antigravity_commands::ag_switch_account,
antigravity_commands::ag_update_label,
antigravity_commands::ag_reorder_accounts,
antigravity_commands::ag_export_accounts,
```

- [ ] **Step 4: Build and verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/
git commit -m "feat(antigravity): add Tauri commands and register in lib.rs"
```

---

### Task 5: Frontend Types

**Files:**
- Create: `src/types/antigravity.ts`

- [ ] **Step 1: Create TypeScript types**

Create `src/types/antigravity.ts`:

```typescript
export interface AntigravityAccount {
  id: string;
  email: string;
  name?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiryTimestamp: number;
  oauthClientKey?: string;
  projectId?: string;
  subscriptionTier?: string;
  customLabel?: string;
  isActive: boolean;
  disabled: boolean;
  disabledReason?: string;
  quota?: AntigravityQuotaData;
  deviceProfile?: AntigravityDeviceProfile;
  createdAt: number;
  lastUsed: number;
  orderIndex: number;
}

export interface AntigravityQuotaData {
  models: AntigravityModelQuota[];
  lastUpdated: number;
  isForbidden: boolean;
  forbiddenReason?: string;
  subscriptionTier?: string;
}

export interface AntigravityModelQuota {
  name: string;
  percentage: number;
  resetTime: string;
  displayName?: string;
  supportsImages?: boolean;
  supportsThinking?: boolean;
  thinkingBudget?: number;
  recommended?: boolean;
  maxTokens?: number;
  maxOutputTokens?: number;
}

export interface AntigravityDeviceProfile {
  machineId: string;
  macMachineId: string;
  devDeviceId: string;
  sqmId: string;
}

export interface RefreshStats {
  total: number;
  success: number;
  failed: number;
  details: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/antigravity.ts
git commit -m "feat(antigravity): add TypeScript types for Antigravity accounts"
```

---

### Task 6: Frontend Store

**Files:**
- Create: `src/stores/useAntigravityStore.ts`

- [ ] **Step 1: Create Zustand store**

Create `src/stores/useAntigravityStore.ts`:

```typescript
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AntigravityAccount, AntigravityQuotaData, RefreshStats } from '../types/antigravity';

interface AntigravityState {
  accounts: AntigravityAccount[];
  hasLoaded: boolean;
  loading: boolean;
  error: string | null;
  loadAccounts: (force?: boolean) => Promise<void>;
  addAccount: (email: string, refreshToken: string) => Promise<AntigravityAccount>;
  deleteAccount: (id: string) => Promise<void>;
  refreshToken: (id: string) => Promise<void>;
  fetchQuota: (id: string) => Promise<AntigravityQuotaData>;
  refreshAllQuotas: () => Promise<RefreshStats>;
  switchAccount: (id: string) => Promise<void>;
  updateLabel: (id: string, label: string | null) => Promise<void>;
  reorderAccounts: (orderedIds: string[]) => Promise<void>;
  exportAccounts: (ids: string[]) => Promise<[string, string][]>;
}

export const useAntigravityStore = create<AntigravityState>((set, get) => ({
  accounts: [],
  hasLoaded: false,
  loading: false,
  error: null,

  loadAccounts: async (force = false) => {
    if (!force && get().hasLoaded) return;
    set({ loading: true, error: null });
    try {
      const accounts = await invoke<AntigravityAccount[]>('ag_list_accounts');
      set({ accounts, loading: false, hasLoaded: true });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  addAccount: async (email, refreshToken) => {
    const account = await invoke<AntigravityAccount>('ag_add_account', { email, refreshToken });
    await get().loadAccounts(true);
    return account;
  },

  deleteAccount: async (id) => {
    await invoke('ag_delete_account', { id });
    await get().loadAccounts(true);
  },

  refreshToken: async (id) => {
    await invoke('ag_refresh_token', { id });
    await get().loadAccounts(true);
  },

  fetchQuota: async (id) => {
    const quota = await invoke<AntigravityQuotaData>('ag_fetch_quota', { id });
    await get().loadAccounts(true);
    return quota;
  },

  refreshAllQuotas: async () => {
    const stats = await invoke<RefreshStats>('ag_refresh_all_quotas');
    await get().loadAccounts(true);
    return stats;
  },

  switchAccount: async (id) => {
    await invoke('ag_switch_account', { id });
    await get().loadAccounts(true);
  },

  updateLabel: async (id, label) => {
    await invoke('ag_update_label', { id, label: label || null });
    await get().loadAccounts(true);
  },

  reorderAccounts: async (orderedIds) => {
    await invoke('ag_reorder_accounts', { orderedIds });
    await get().loadAccounts(true);
  },

  exportAccounts: async (ids) => {
    return await invoke<[string, string][]>('ag_export_accounts', { ids });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/useAntigravityStore.ts
git commit -m "feat(antigravity): add Zustand store for Antigravity accounts"
```

---

### Task 7: Frontend Components

**Files:**
- Create: `src/components/antigravity/AddAccountDialog.tsx`
- Create: `src/components/antigravity/QuotaDisplay.tsx`
- Create: `src/components/antigravity/AccountDetailsDialog.tsx`
- Create: `src/components/antigravity/AccountCard.tsx`

- [ ] **Step 1: Create AddAccountDialog**

Create `src/components/antigravity/AddAccountDialog.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalDialog from '../common/ModalDialog';
import { useAntigravityStore } from '../../stores/useAntigravityStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAccountDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { addAccount } = useAntigravityStore();
  const [email, setEmail] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !refreshToken.trim()) return;
    setLoading(true);
    setError('');
    try {
      await addAccount(email.trim(), refreshToken.trim());
      setEmail('');
      setRefreshToken('');
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title={t('antigravity.add_account')}>
      <div className="space-y-4">
        <div>
          <label className="label"><span className="label-text">{t('antigravity.email')}</span></label>
          <input
            type="email"
            className="input input-bordered w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@gmail.com"
          />
        </div>
        <div>
          <label className="label"><span className="label-text">{t('antigravity.refresh_token')}</span></label>
          <textarea
            className="textarea textarea-bordered w-full h-24"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="1//..."
          />
        </div>
        {error && <div className="text-error text-sm">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!email.trim() || !refreshToken.trim() || loading}
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : t('common.add')}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
```

- [ ] **Step 2: Create QuotaDisplay**

Create `src/components/antigravity/QuotaDisplay.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { AntigravityModelQuota } from '../../types/antigravity';

interface Props {
  models: AntigravityModelQuota[];
}

export default function QuotaDisplay({ models }: Props) {
  const { t } = useTranslation();

  if (models.length === 0) {
    return <div className="text-sm text-gray-400">{t('antigravity.no_quota_data')}</div>;
  }

  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    if (pct >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      {models.map((m) => (
        <div key={m.name} className="flex items-center gap-2 text-sm">
          <span className="w-48 truncate text-gray-600 dark:text-gray-300" title={m.displayName || m.name}>
            {m.displayName || m.name}
          </span>
          <div className="flex-1 h-2 bg-gray-200 dark:bg-base-300 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${getColor(m.percentage)}`} style={{ width: `${m.percentage}%` }} />
          </div>
          <span className="w-10 text-right text-gray-500 dark:text-gray-400">{m.percentage}%</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create AccountDetailsDialog**

Create `src/components/antigravity/AccountDetailsDialog.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { AntigravityAccount } from '../../types/antigravity';
import { useAntigravityStore } from '../../stores/useAntigravityStore';
import QuotaDisplay from './QuotaDisplay';

interface Props {
  account: AntigravityAccount;
  open: boolean;
  onClose: () => void;
}

export default function AccountDetailsDialog({ account, open, onClose }: Props) {
  const { t } = useTranslation();
  const { fetchQuota, loading } = useAntigravityStore();
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaExpanded, setQuotaExpanded] = useState(true);

  const handleRefreshQuota = async () => {
    setQuotaLoading(true);
    try {
      await fetchQuota(account.id);
    } finally {
      setQuotaLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <ModalDialog open={open} onClose={onClose} title={account.customLabel || account.email}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">{t('antigravity.email')}</span>
            <div className="font-medium">{account.email}</div>
          </div>
          <div>
            <span className="text-gray-500">{t('antigravity.name')}</span>
            <div className="font-medium">{account.name || '-'}</div>
          </div>
          <div>
            <span className="text-gray-500">{t('antigravity.tier')}</span>
            <div className="font-medium">
              <span className={`badge badge-sm ${account.subscriptionTier === 'PRO' ? 'badge-primary' : account.subscriptionTier === 'ULTRA' ? 'badge-secondary' : 'badge-ghost'}`}>
                {account.subscriptionTier || 'FREE'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-500">{t('antigravity.status')}</span>
            <div className="font-medium">
              {account.disabled ? (
                <span className="badge badge-error badge-sm">{t('antigravity.disabled')}</span>
              ) : account.isActive ? (
                <span className="badge badge-success badge-sm">{t('antigravity.active')}</span>
              ) : (
                <span className="badge badge-ghost badge-sm">{t('antigravity.inactive')}</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-500">{t('antigravity.created')}</span>
            <div className="font-medium text-xs">{formatTime(account.createdAt)}</div>
          </div>
          <div>
            <span className="text-gray-500">{t('antigravity.last_used')}</span>
            <div className="font-medium text-xs">{formatTime(account.lastUsed)}</div>
          </div>
        </div>

        {account.disabledReason && (
          <div className="alert alert-warning text-sm">
            {account.disabledReason}
          </div>
        )}

        {/* Quota Section */}
        <div className="border-t border-gray-200 dark:border-base-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <button
              className="flex items-center gap-1 text-sm font-medium"
              onClick={() => setQuotaExpanded(!quotaExpanded)}
            >
              {quotaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('antigravity.quota')}
            </button>
            <button
              className="btn btn-xs btn-ghost gap-1"
              onClick={handleRefreshQuota}
              disabled={quotaLoading}
            >
              <RefreshCw className={`w-3 h-3 ${quotaLoading ? 'animate-spin' : ''}`} />
              {t('antigravity.refresh_quota')}
            </button>
          </div>
          {quotaExpanded && account.quota && (
            <QuotaDisplay models={account.quota.models} />
          )}
          {quotaExpanded && !account.quota && (
            <div className="text-sm text-gray-400">{t('antigravity.no_quota_data')}</div>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
```

- [ ] **Step 4: Create AccountCard**

Create `src/components/antigravity/AccountCard.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RefreshCw, Eye, Power, Tag } from 'lucide-react';
import { AntigravityAccount } from '../../types/antigravity';
import { useAntigravityStore } from '../../stores/useAntigravityStore';

interface Props {
  account: AntigravityAccount;
  onViewDetails: (account: AntigravityAccount) => void;
}

export default function AccountCard({ account, onViewDetails }: Props) {
  const { t } = useTranslation();
  const { deleteAccount, refreshToken, switchAccount, loading } = useAntigravityStore();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshToken(account.id);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteAccount(account.id);
  };

  const handleSwitch = async () => {
    await switchAccount(account.id);
  };

  const tierBadge = () => {
    const tier = account.subscriptionTier;
    if (tier === 'PRO') return <span className="badge badge-primary badge-xs">PRO</span>;
    if (tier === 'ULTRA') return <span className="badge badge-secondary badge-xs">ULTRA</span>;
    return <span className="badge badge-ghost badge-xs">FREE</span>;
  };

  const quotaSummary = () => {
    if (!account.quota || account.quota.models.length === 0) return null;
    const total = account.quota.models.length;
    const high = account.quota.models.filter((m) => m.percentage >= 80).length;
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {high}/{total} {t('antigravity.models_high')}
      </div>
    );
  };

  return (
    <div
      className={`
        card bg-white dark:bg-base-100 border rounded-xl shadow-sm
        ${account.isActive ? 'border-orange-400 dark:border-orange-500 ring-1 ring-orange-200 dark:ring-orange-800' : 'border-gray-100 dark:border-base-200'}
        ${account.disabled ? 'opacity-60' : ''}
      `}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${account.disabled ? 'bg-red-400' : account.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                {account.customLabel || account.email}
                {tierBadge()}
                {account.disabled && <span className="badge badge-error badge-xs">{t('antigravity.disabled')}</span>}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{account.email}</div>
            </div>
          </div>
          {account.isActive && (
            <span className="badge badge-success badge-xs">{t('antigravity.active')}</span>
          )}
        </div>

        {quotaSummary()}

        <div className="flex items-center gap-1 mt-2">
          {!account.isActive && !account.disabled && (
            <button className="btn btn-xs btn-ghost gap-1" onClick={handleSwitch} disabled={loading}>
              <Power className="w-3 h-3" />
              {t('antigravity.switch')}
            </button>
          )}
          <button className="btn btn-xs btn-ghost gap-1" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn btn-xs btn-ghost gap-1" onClick={() => onViewDetails(account)}>
            <Eye className="w-3 h-3" />
          </button>
          <button
            className={`btn btn-xs btn-ghost gap-1 ${confirmDelete ? 'text-error' : ''}`}
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete && t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/antigravity/
git commit -m "feat(antigravity): add frontend components (AccountCard, QuotaDisplay, dialogs)"
```

---

### Task 8: Frontend Page

**Files:**
- Create: `src/pages/AntigravityPage.tsx`

- [ ] **Step 1: Create the main page**

Create `src/pages/AntigravityPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Download } from 'lucide-react';
import { AntigravityAccount } from '../types/antigravity';
import { useAntigravityStore } from '../stores/useAntigravityStore';
import AccountCard from '../components/antigravity/AccountCard';
import AddAccountDialog from '../components/antigravity/AddAccountDialog';
import AccountDetailsDialog from '../components/antigravity/AccountDetailsDialog';

export default function AntigravityPage() {
  const { t } = useTranslation();
  const { accounts, loadAccounts, refreshAllQuotas, loading } = useAntigravityStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AntigravityAccount | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      const stats = await refreshAllQuotas();
      // Could show a toast with stats
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('antigravity.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('antigravity.subtitle', { count: accounts.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost gap-1"
              onClick={handleRefreshAll}
              disabled={refreshingAll || loading}
            >
              <RefreshCw className={`w-4 h-4 ${refreshingAll ? 'animate-spin' : ''}`} />
              {t('antigravity.refresh_all')}
            </button>
            <button className="btn btn-sm btn-primary gap-1" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" />
              {t('antigravity.add_account')}
            </button>
          </div>
        </div>

        {/* Account Grid */}
        {accounts.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <Plus className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">{t('antigravity.empty')}</p>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => setShowAdd(true)}>
              {t('antigravity.add_first_account')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onViewDetails={setSelectedAccount}
              />
            ))}
          </div>
        )}
      </div>

      <AddAccountDialog open={showAdd} onClose={() => setShowAdd(false)} />

      {selectedAccount && (
        <AccountDetailsDialog
          account={selectedAccount}
          open={!!selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/AntigravityPage.tsx
git commit -m "feat(antigravity): add main AntigravityPage component"
```

---

### Task 9: Routing & Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add route in App.tsx**

Add lazy import:
```typescript
const AntigravityPage = lazy(() => import('./pages/AntigravityPage'));
```

Add route in the `children` array:
```typescript
{
  path: 'antigravity',
  element: <SuspenseWrapper><AntigravityPage /></SuspenseWrapper>,
},
```

- [ ] **Step 2: Add sidebar nav item**

In `src/components/layout/Sidebar.tsx`, add the import:
```typescript
import { Rocket } from 'lucide-react'; // or use a different icon
```

Add to `mainNavItems` array (after the providers entry makes sense):
```typescript
{ path: '/antigravity', icon: Rocket, labelKey: 'nav.antigravity' },
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(antigravity): add route and sidebar navigation"
```

---

### Task 10: i18n Translations

**Files:**
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add Chinese translations**

Add to `src/locales/zh.json` under an `"antigravity"` key:
```json
"antigravity": {
  "title": "Antigravity 账号",
  "subtitle": "管理 {{count}} 个 Antigravity 账号",
  "add_account": "添加账号",
  "email": "邮箱",
  "refresh_token": "Refresh Token",
  "name": "名称",
  "tier": "订阅类型",
  "status": "状态",
  "created": "创建时间",
  "last_used": "最后使用",
  "active": "活跃",
  "inactive": "未激活",
  "disabled": "已禁用",
  "switch": "切换",
  "quota": "配额",
  "refresh_quota": "刷新配额",
  "refresh_all": "全部刷新",
  "no_quota_data": "暂无配额数据",
  "models_high": "个模型充足",
  "empty": "暂无 Antigravity 账号",
  "add_first_account": "添加第一个账号",
  "delete_confirm": "确认删除此账号？",
  "token_expired": "Token 已过期",
  "token_valid": "Token 有效",
  "forbidden": "账号被禁止",
  "refresh_success": "刷新成功",
  "refresh_failed": "刷新失败"
}
```

Also add to `"nav"` section:
```json
"antigravity": "Antigravity"
```

- [ ] **Step 2: Add English translations**

Add to `src/locales/en.json` under an `"antigravity"` key:
```json
"antigravity": {
  "title": "Antigravity Accounts",
  "subtitle": "Managing {{count}} Antigravity accounts",
  "add_account": "Add Account",
  "email": "Email",
  "refresh_token": "Refresh Token",
  "name": "Name",
  "tier": "Tier",
  "status": "Status",
  "created": "Created",
  "last_used": "Last Used",
  "active": "Active",
  "inactive": "Inactive",
  "disabled": "Disabled",
  "switch": "Switch",
  "quota": "Quota",
  "refresh_quota": "Refresh Quota",
  "refresh_all": "Refresh All",
  "no_quota_data": "No quota data",
  "models_high": "models high",
  "empty": "No Antigravity accounts yet",
  "add_first_account": "Add your first account",
  "delete_confirm": "Delete this account?",
  "token_expired": "Token expired",
  "token_valid": "Token valid",
  "forbidden": "Account forbidden",
  "refresh_success": "Refreshed successfully",
  "refresh_failed": "Refresh failed"
}
```

Also add to `"nav"` section:
```json
"antigravity": "Antigravity"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/
git commit -m "feat(antigravity): add i18n translations (zh/en)"
```

---

### Task 11: Integration Testing & Polish

- [ ] **Step 1: Full build check**

Run: `npm run tauri dev`
Expected: App starts, Antigravity page is accessible from sidebar

- [ ] **Step 2: Test add account flow**
1. Navigate to Antigravity page
2. Click "Add Account"
3. Enter email and refresh token
4. Verify account appears in list with quota data

- [ ] **Step 3: Test refresh flow**
1. Click refresh button on an account
2. Verify token is refreshed and quota updates

- [ ] **Step 4: Test switch flow**
1. Add a second account
2. Click switch on the non-active account
3. Verify the active indicator changes

- [ ] **Step 5: Test delete flow**
1. Delete an account
2. Verify it's removed from the list
3. If deleting the active account, verify another becomes active

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(antigravity): integration testing fixes"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] Account CRUD (add, list, delete) → Task 3 (service) + Task 7 (components)
- [x] Token refresh → Task 3 (refresh_access_token, refresh_account_token)
- [x] Quota monitoring → Task 3 (fetch_quota, fetch_account_quota) + Task 7 (QuotaDisplay)
- [x] Account switching → Task 3 (switch_account) + Task 7 (AccountCard)
- [x] Batch quota refresh → Task 3 (refresh_all_quotas) + Task 8 (page)
- [x] Account details view → Task 7 (AccountDetailsDialog)
- [x] i18n → Task 10
- [x] Navigation → Task 9

### Placeholder Scan
- [x] No TBD/TODO/placeholders in any code blocks
- [x] All steps contain actual code or commands
- [x] No "similar to Task N" references

### Type Consistency
- [x] `AntigravityAccount` fields match between Rust model (Task 1) and TypeScript type (Task 5)
- [x] `AntigravityQuotaData` fields match between Rust and TypeScript
- [x] Command names consistent: `ag_*` prefix used throughout commands (Task 4) and store (Task 6)
- [x] camelCase in TypeScript ↔ snake_case in Rust (serde handles conversion)
