#![allow(dead_code)]
use std::fs::{self, OpenOptions};
use std::io::{self, Write, BufRead, BufReader};
use std::path::Path;
use serde::de::DeserializeOwned;
use serde::Serialize;
use super::lock_registry::with_file_lock;

/// 追加一行 JSON 到 JSONL 文件
pub fn append_line<T: Serialize>(path: &Path, data: &T) -> io::Result<()> {
    let line = serde_json::to_string(data)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    with_file_lock(path, || {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        writeln!(file, "{}", line)
    })
}

/// 读取 JSONL 文件所有行
pub fn read_lines<T: DeserializeOwned>(path: &Path) -> io::Result<Vec<T>> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let file = fs::File::open(path)?;
    let reader = BufReader::new(file);
    let mut items = Vec::new();
    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        match serde_json::from_str(trimmed) {
            Ok(item) => items.push(item),
            Err(_) => continue, // 跳过损坏的行
        }
    }
    Ok(items)
}
