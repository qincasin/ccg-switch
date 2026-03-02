use rusqlite::Connection;

pub fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            server_config TEXT NOT NULL,
            description TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            enabled_claude BOOLEAN NOT NULL DEFAULT 0,
            enabled_codex BOOLEAN NOT NULL DEFAULT 0,
            enabled_gemini BOOLEAN NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            directory TEXT NOT NULL,
            repo_owner TEXT,
            repo_name TEXT,
            repo_branch TEXT DEFAULT 'main',
            readme_url TEXT,
            enabled_claude BOOLEAN NOT NULL DEFAULT 0,
            enabled_codex BOOLEAN NOT NULL DEFAULT 0,
            enabled_gemini BOOLEAN NOT NULL DEFAULT 0,
            installed_at INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS skill_repos (
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            branch TEXT NOT NULL DEFAULT 'main',
            enabled BOOLEAN NOT NULL DEFAULT 1,
            PRIMARY KEY (owner, name)
        );

        CREATE TABLE IF NOT EXISTS prompts (
            id TEXT NOT NULL,
            app_type TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (id, app_type)
        );
        ",
    )
    .map_err(|e| format!("Failed to create tables: {e}"))
}
