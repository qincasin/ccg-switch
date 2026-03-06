#![allow(dead_code)]
use std::fs;
use std::io;
use std::path::Path;
use serde::de::DeserializeOwned;
use serde::Serialize;
use super::atomic_io::atomic_write_json;
use super::lock_registry::with_file_lock;

/// 读取 JSON 文件并反序列化
pub fn read_json<T: DeserializeOwned>(path: &Path) -> io::Result<T> {
    let content = fs::read_to_string(path)?;
    serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// 读取 JSON 文件，不存在或解析失败时返回默认值
pub fn read_json_or_default<T: DeserializeOwned + Default>(path: &Path) -> T {
    read_json(path).unwrap_or_default()
}

/// 原子写入 JSON 文件（带文件锁）
pub fn write_json<T: Serialize>(path: &Path, data: &T) -> io::Result<()> {
    with_file_lock(path, || atomic_write_json(path, data))
}
