use std::sync::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;

mod schema;
pub mod dao;

pub struct Database {
    pub(crate) conn: Mutex<Connection>,
}

macro_rules! lock_conn {
    ($mutex:expr) => {
        $mutex.lock().map_err(|e| format!("Mutex lock failed: {}", e))?
    };
}
pub(crate) use lock_conn;

impl Database {
    /// 生产环境初始化，数据库在 ~/.claude-switch/cc-switch.db
    pub fn init() -> Result<Self, String> {
        let db_path = Self::get_db_path()?;
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create db directory: {e}"))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {e}"))?;

        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.create_tables()?;
        db.init_default_skill_repos()?;

        Ok(db)
    }

    fn get_db_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir()
            .ok_or_else(|| "Home directory not found".to_string())?;
        Ok(home.join(".claude-switch").join("cc-switch.db"))
    }

    fn create_tables(&self) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        schema::create_tables(&conn)
    }

    /// 首次启动时插入默认 skill 仓库
    fn init_default_skill_repos(&self) -> Result<(), String> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM skill_repos", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count skill_repos: {e}"))?;

        if count == 0 {
            let defaults = [
                ("anthropics", "skills", "main"),
                ("ComposioHQ", "awesome-claude-skills", "main"),
                ("cexll", "myclaude", "main"),
                ("JimLiu", "baoyu-skills", "main"),
            ];
            for (owner, name, branch) in &defaults {
                conn.execute(
                    "INSERT OR IGNORE INTO skill_repos (owner, name, branch, enabled) VALUES (?1, ?2, ?3, 1)",
                    rusqlite::params![owner, name, branch],
                )
                .map_err(|e| format!("Failed to insert default skill repo: {e}"))?;
            }
        }

        Ok(())
    }
}
