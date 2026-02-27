use std::path::PathBuf;
use std::sync::OnceLock;
use tokio::sync::mpsc;
use crate::models::usage::RequestLogEvent;
use crate::services::storage::jsonl_store;

/// 全局发送端，持有后台 worker 的 channel sender
static SENDER: OnceLock<mpsc::Sender<RequestLogEvent>> = OnceLock::new();

/// 初始化日志 worker（应在代理服务启动时调用一次）
///
/// 日志文件路径：`{log_dir}/YYYY-MM-DD.jsonl`
/// 后台 tokio task 接收事件并追加写入对应日期的 JSONL 文件
pub fn init_logger(log_dir: PathBuf) {
    // 若已初始化则跳过（OnceLock 保证只初始化一次）
    if SENDER.get().is_some() {
        return;
    }

    let (tx, mut rx) = mpsc::channel::<RequestLogEvent>(1024);

    // 尝试设置全局 sender；若已被其他线程抢先初始化则丢弃本次 sender
    if SENDER.set(tx).is_err() {
        return;
    }

    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let date_str = event.timestamp.format("%Y-%m-%d").to_string();
            let log_path = log_dir.join(format!("{}.jsonl", date_str));
            // 追加写入，忽略错误（日志失败不能影响主流程）
            let _ = jsonl_store::append_line(&log_path, &event);
        }
    });
}

/// 记录请求日志（非阻塞）
///
/// 内部使用 `try_send`：channel 满时直接丢弃，不阻塞调用方
pub fn log_event(event: RequestLogEvent) {
    if let Some(sender) = SENDER.get() {
        // try_send 非阻塞：满则丢弃，不返回错误给调用方
        let _ = sender.try_send(event);
    }
}

/// 获取今日日志文件路径
pub fn today_log_path(log_dir: &PathBuf) -> PathBuf {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    log_dir.join(format!("{}.jsonl", today))
}
