use crate::models::usage::{
    ModelDailySummary, ProviderDailySummary, RequestLogEvent, UsageDailySummary,
};
use crate::services::storage::jsonl_store;
use std::collections::HashMap;
use std::io;
use std::path::PathBuf;

/// 获取日志目录路径：`~/.claude-switch/proxy/logs`
fn get_log_dir() -> Result<PathBuf, io::Error> {
    let home = dirs::home_dir().ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "无法获取用户主目录")
    })?;
    Ok(home.join(".claude-switch").join("proxy").join("logs"))
}

/// 读取指定日期的原始请求日志（JSONL 格式）
///
/// `date` 格式：`YYYY-MM-DD`
pub fn get_daily_logs(date: &str) -> Result<Vec<RequestLogEvent>, io::Error> {
    let log_dir = get_log_dir()?;
    let log_path = log_dir.join(format!("{}.jsonl", date));
    jsonl_store::read_lines(&log_path)
}

/// 汇总指定日期的 usage 统计
///
/// `date` 格式：`YYYY-MM-DD`
pub fn get_daily_summary(date: &str) -> Result<UsageDailySummary, io::Error> {
    let logs = get_daily_logs(date)?;
    Ok(aggregate_summary(date, &logs))
}

/// 获取最近 N 天的汇总列表（从今天向前推算）
pub fn get_recent_summaries(days: u32) -> Result<Vec<UsageDailySummary>, io::Error> {
    let today = chrono::Utc::now();
    let mut summaries = Vec::with_capacity(days as usize);

    for i in 0..days {
        let date = (today - chrono::Duration::days(i as i64))
            .format("%Y-%m-%d")
            .to_string();
        match get_daily_summary(&date) {
            Ok(summary) => summaries.push(summary),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                // 该日无日志，插入空汇总
                summaries.push(empty_summary(&date));
            }
            Err(e) => return Err(e),
        }
    }

    Ok(summaries)
}

/// 从日志列表聚合成 UsageDailySummary
fn aggregate_summary(date: &str, logs: &[RequestLogEvent]) -> UsageDailySummary {
    let mut total_requests: u64 = 0;
    let mut total_input: u64 = 0;
    let mut total_output: u64 = 0;
    let mut total_cost: f64 = 0.0;
    let mut by_provider: HashMap<String, ProviderDailySummary> = HashMap::new();
    let mut by_model: HashMap<String, ModelDailySummary> = HashMap::new();

    for event in logs {
        total_requests += 1;
        total_input += event.input_tokens;
        total_output += event.output_tokens;
        total_cost += event.cost_usd;

        // 按 provider 聚合
        let provider_entry = by_provider
            .entry(event.provider_id.clone())
            .or_insert_with(|| ProviderDailySummary {
                requests: 0,
                input_tokens: 0,
                output_tokens: 0,
                cost_usd: 0.0,
            });
        provider_entry.requests += 1;
        provider_entry.input_tokens += event.input_tokens;
        provider_entry.output_tokens += event.output_tokens;
        provider_entry.cost_usd += event.cost_usd;

        // 按 model 聚合
        let model_entry = by_model
            .entry(event.model.clone())
            .or_insert_with(|| ModelDailySummary {
                requests: 0,
                input_tokens: 0,
                output_tokens: 0,
                cost_usd: 0.0,
            });
        model_entry.requests += 1;
        model_entry.input_tokens += event.input_tokens;
        model_entry.output_tokens += event.output_tokens;
        model_entry.cost_usd += event.cost_usd;
    }

    UsageDailySummary {
        date: date.to_string(),
        total_requests,
        total_input_tokens: total_input,
        total_output_tokens: total_output,
        total_cost_usd: total_cost,
        by_provider,
        by_model,
    }
}

/// 创建指定日期的空汇总（无日志时使用）
fn empty_summary(date: &str) -> UsageDailySummary {
    UsageDailySummary {
        date: date.to_string(),
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0.0,
        by_provider: HashMap::new(),
        by_model: HashMap::new(),
    }
}
