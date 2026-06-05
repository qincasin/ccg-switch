use crate::database::{lock_conn, Database};
use crate::models::antigravity::AntigravityAccount;
use rusqlite::params;
use rusqlite::OptionalExtension;

impl Database {
    pub fn list_antigravity_accounts(&self) -> Result<Vec<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT * FROM antigravity_accounts ORDER BY order_index ASC, created_at ASC",
            )
            .map_err(|e| e.to_string())?;

        let accounts = stmt
            .query_map([], |row| Ok(row_to_account(row)))
            .map_err(|e| e.to_string())?
            .filter_map(|a| a.ok())
            .collect();

        Ok(accounts)
    }

    pub fn get_antigravity_account(
        &self,
        id: &str,
    ) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let result = stmt
            .query_row(params![id], |row| Ok(row_to_account(row)))
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(result)
    }

    pub fn upsert_antigravity_account(&self, account: &AntigravityAccount) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let quota_json = account
            .quota
            .as_ref()
            .map(|q| serde_json::to_string(q).unwrap_or_default());
        let device_profile_json = account
            .device_profile
            .as_ref()
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
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_antigravity_account(&self, id: &str) -> Result<bool, String> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM antigravity_accounts WHERE id = ?1",
                params![id],
            )
            .map_err(|e| e.to_string())?;
        Ok(affected > 0)
    }

    pub fn set_active_antigravity_account(&self, id: &str) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        conn.execute("UPDATE antigravity_accounts SET is_active = 0", [])
            .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE antigravity_accounts SET is_active = 1, last_used = ?1 WHERE id = ?2",
            params![chrono::Utc::now().timestamp(), id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_active_antigravity_account(&self) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE is_active = 1")
            .map_err(|e| e.to_string())?;

        let result = stmt
            .query_row([], |row| Ok(row_to_account(row)))
            .optional()
            .map_err(|e| e.to_string())?;

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

    pub fn find_antigravity_account_by_email(
        &self,
        email: &str,
    ) -> Result<Option<AntigravityAccount>, String> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT * FROM antigravity_accounts WHERE email = ?1")
            .map_err(|e| e.to_string())?;

        let result = stmt
            .query_row(params![email], |row| Ok(row_to_account(row)))
            .optional()
            .map_err(|e| e.to_string())?;

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
