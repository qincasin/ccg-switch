use std::fs;
use std::io;
use std::path::Path;
use serde::Serialize;

/// 原子写入 JSON 数据到文件（先写 .tmp 再 rename）
pub fn atomic_write_json<T: Serialize>(path: &Path, data: &T) -> io::Result<()> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    atomic_write_bytes(path, content.as_bytes())
}

/// 原子写入字节数据到文件
pub fn atomic_write_bytes(path: &Path, data: &[u8]) -> io::Result<()> {
    // 确保父目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, data)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}
