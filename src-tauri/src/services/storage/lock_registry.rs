use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};

type LockMap = Mutex<HashMap<String, Arc<Mutex<()>>>>;

fn global_locks() -> &'static LockMap {
    static INSTANCE: OnceLock<LockMap> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 获取文件锁后执行闭包
pub fn with_file_lock<F, R>(path: &Path, f: F) -> R
where
    F: FnOnce() -> R,
{
    let key = path.to_string_lossy().to_string();
    let lock = {
        let mut map = global_locks().lock().unwrap();
        map.entry(key).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
    };
    let _guard = lock.lock().unwrap();
    f()
}
