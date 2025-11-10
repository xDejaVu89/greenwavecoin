use dotenvy::dotenv;
use std::time::Duration;
use tokio::time::sleep;
use ethers::prelude::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

#[derive(Debug, Deserialize)]
struct Task {
    id: String,
    payload: String, // base64 or json content
}

#[derive(Debug, Serialize)]
struct TaskResult {
    id: String,
    worker: String,
    hash: String,
    signature: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    init_tracing();

    let backend = std::env::var("BACKEND_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let poll_secs: u64 = std::env::var("POLL_INTERVAL_SECONDS").ok().and_then(|s| s.parse().ok()).unwrap_or(30);
    let private_key = std::env::var("PRIVATE_KEY").expect("PRIVATE_KEY not set");

    let wallet: LocalWallet = private_key.parse::<LocalWallet>()?.with_chain_id(137u64); // default Polygon chain id
    let address = wallet.address();
    info!(%address, "Worker starting");

    let client = Client::new();

    loop {
        if let Err(e) = process_once(&client, &backend, &wallet).await {
            error!(error=?e, "processing error");
        }
        sleep(Duration::from_secs(poll_secs)).await;
    }
}

fn init_tracing() {
    let filter = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into());
    tracing_subscriber::fmt().with_env_filter(filter).init();
}

async fn process_once(client: &Client, backend: &str, wallet: &LocalWallet) -> anyhow::Result<()> {
    // Fetch a task
    let task: Option<Task> = client
        .get(format!("{}/api/tasks", backend))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await
        .ok()
        .and_then(|v| v.get("task").cloned())
        .and_then(|v| serde_json::from_value(v).ok());

    let Some(task) = task else {
        info!("no task available");
        return Ok(());
    };

    // Compute a deterministic hash of payload
    let hash_bytes = blake3::hash(task.payload.as_bytes());
    let hash_hex = format!("0x{}", hex::encode(hash_bytes.as_bytes()));

    // Sign the hash
    let signature = wallet.sign_message(hash_bytes.as_bytes()).await?;
    let sig_hex = signature.to_string();

    // Submit result
    let result = TaskResult {
        id: task.id,
        worker: format!("0x{:x}", wallet.address()),
        hash: hash_hex,
        signature: sig_hex,
    };

    let resp = client
        .post(format!("{}/api/results", backend))
        .json(&result)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        error!(status=?resp.status(), body=%text, "failed to submit result");
    } else {
        info!("result submitted");
    }

    Ok(())
}
