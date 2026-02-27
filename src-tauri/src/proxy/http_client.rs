use bytes::Bytes;
use reqwest::Client;
use std::sync::OnceLock;

fn global_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .expect("Failed to create HTTP client")
    })
}

pub async fn forward_request(
    method: reqwest::Method,
    url: &str,
    headers: reqwest::header::HeaderMap,
    body: Bytes,
) -> Result<reqwest::Response, reqwest::Error> {
    global_client()
        .request(method, url)
        .headers(headers)
        .body(body)
        .send()
        .await
}
