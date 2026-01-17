//! Chimera Core - The Body (Digital Phantom Worker Swarm)
//! 
//! This is the main entry point for the Rust stealth worker.
//! It connects to The Brain for vision processing and executes
//! browser missions with human-like behavior.

mod client;
mod stealth;
mod workers;
mod validation;

use std::env;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, interval};
use tracing::{info, error, warn, Level};
use tracing_subscriber::FmtSubscriber;

use client::{ChimeraClient, get_brain_address, connect_with_retry};
use stealth::{DiffusionMousePath, BehavioralJitter};
use workers::PhantomWorker;
use validation::validate_creepjs;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .with_thread_ids(false)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)?;
    
    info!("🦾 Chimera Core - The Body - Starting...");
    info!("   Version: {}", env!("CARGO_PKG_VERSION"));
    
    // Get worker ID (for Railway scaling)
    let worker_id = env::var("RAILWAY_REPLICA_ID")
        .or_else(|_| env::var("WORKER_ID"))
        .unwrap_or_else(|_| "local-0".to_string());
    
    info!("   Worker ID: {}", worker_id);
    
    // 1. Initialize gRPC connection to The Brain with retry
    info!("🔗 Initializing connection to The Brain...");
    let brain_address = get_brain_address();
    info!("   Brain address: {}", brain_address);
    
    let mut brain_client = match connect_with_retry(5).await {
        Ok(client) => {
            info!("✅ Connected to The Brain at: {}", client.address());
            client
        }
        Err(e) => {
            error!("❌ Failed to connect to The Brain after retries: {}", e);
            error!("   Make sure The Brain is running on port 50051");
            error!("   Try: cd chimera_brain && python server.py");
            return Err(e);
        }
    };
    
    // Test vision processing with a valid 1x1 transparent PNG
    info!("📸 Testing vision processing...");
    
    // Valid 1x1 transparent PNG (67 bytes)
    let valid_png: Vec<u8> = vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // RGBA, compression
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk header
        0x54, 0x08, 0xD7, 0x63, 0x60, 0x00, 0x00, 0x00, // IDAT data
        0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, // IDAT CRC
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
        0xAE, 0x42, 0x60, 0x82,                         // IEND CRC
    ];
    
    match brain_client.process_vision(valid_png, Some("Test connection".to_string())).await {
        Ok(response) => {
            info!("✅ Brain responded successfully!");
            info!("   Description: {}", response.description);
            info!("   Confidence: {:.2}", response.confidence);
        }
        Err(e) => {
            error!("❌ Vision processing failed: {}", e);
        }
    }
    
    // Test stealth components
    info!("🥷 Testing stealth components...");
    
    let path_generator = DiffusionMousePath::new();
    let test_path = path_generator.generate_path((0.0, 0.0), (500.0, 300.0), 30);
    info!("   Generated diffusion path: {} points", test_path.len());
    
    let mut jitter = BehavioralJitter::new();
    let delay = jitter.human_delay(100);
    info!("   Sample human delay: {:?}", delay);
    
    let (press, hold, release) = jitter.click_timing();
    info!("   Click timing: press={:?}, hold={:?}, release={:?}", press, hold, release);
    
    info!("✅ All stealth components operational");
    info!("");
    
    // 2. Launch Phantom Worker
    info!("🦾 Launching Phantom Worker...");
    
    // Connect to WebDriver (default: http://localhost:4444)
    let webdriver_url = env::var("WEBDRIVER_URL")
        .unwrap_or_else(|_| "http://localhost:4444".to_string());
    
    info!("   WebDriver URL: {}", webdriver_url);
    
    let webdriver_client = match fantoccini::ClientBuilder::native()
        .connect(&webdriver_url)
        .await
    {
        Ok(client) => {
            info!("✅ Connected to WebDriver");
            client
        }
        Err(e) => {
            error!("❌ Failed to connect to WebDriver: {}", e);
            error!("   Make sure WebDriver (ChromeDriver/GeckoDriver) is running");
            error!("   Default URL: http://localhost:4444");
            return Err(format!("WebDriver connection failed: {}", e).into());
        }
    };
    
    // Share brain client between phantom worker and heartbeat
    let brain_client_arc = Arc::new(Mutex::new(brain_client));
    let brain_client_for_worker = Arc::clone(&brain_client_arc);
    
    // Start heartbeat monitoring in background (separate task)
    let heartbeat_failures = Arc::new(AtomicU32::new(0));
    let heartbeat_failures_clone = heartbeat_failures.clone();
    
    let heartbeat_handle = tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            
            let mut client_guard = brain_client_arc.lock().await;
            match client_guard.health_check().await {
                Ok(_) => {
                    info!("💓 Heartbeat: The Brain is healthy");
                    heartbeat_failures_clone.store(0, Ordering::Relaxed);
                }
                Err(e) => {
                    let failures = heartbeat_failures_clone.fetch_add(1, Ordering::Relaxed) + 1;
                    warn!("⚠️ Heartbeat failed (consecutive failures: {}): {}", failures, e);
                    
                    if failures >= 3 {
                        error!("🚨 CRITICAL: Heartbeat failed 3 consecutive times!");
                        error!("   Attempting full reconnection...");
                        
                        // Attempt reconnection
                        match connect_with_retry(5).await {
                            Ok(new_client) => {
                                *client_guard = new_client;
                                info!("✅ Reconnected to The Brain after heartbeat failures");
                                heartbeat_failures_clone.store(0, Ordering::Relaxed);
                            }
                            Err(e) => {
                                error!("❌ Reconnection failed: {}", e);
                                // Continue monitoring - will retry on next heartbeat
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Create phantom worker with shared brain client
    let mut phantom_worker = PhantomWorker::new(webdriver_client);
    phantom_worker.set_brain_client_arc(brain_client_for_worker);
    info!("✅ Phantom Worker launched");
    info!("");
    
    // 3. Run CreepJS validation immediately
    info!("🕵️ Running CreepJS validation...");
    
    match validate_creepjs(&mut phantom_worker).await {
        Ok(score) => {
            if score >= 100.0 {
                info!("");
                info!("✅ STEALTH VALIDATED: 100% HUMAN");
                info!("   Trust Score: {:.1}%", score);
                info!("");
            } else {
                error!("");
                error!("❌ STEALTH VALIDATION FAILED: Trust score is {:.1}%, expected 100%", score);
                error!("");
                let _ = phantom_worker.close().await;
                return Err(format!("Stealth validation failed: {:.1}% < 100%", score).into());
            }
        }
        Err(e) => {
            error!("");
            error!("❌ CreepJS validation error: {}", e);
            error!("");
            let _ = phantom_worker.close().await;
            return Err(format!("CreepJS validation failed: {}", e).into());
        }
    }
    
    info!("");
    info!("🎯 The Body is ready for missions!");
    info!("   - Vision Service: Connected");
    info!("   - Diffusion Paths: Active");
    info!("   - Behavioral Jitter: Active");
    info!("   - Browser Automation: Operational");
    info!("   - Stealth Validation: 100% Human");
    info!("   - gRPC Resilience: Active (retry + heartbeat)");
    info!("");
    info!("💓 Heartbeat monitoring active (every 60 seconds)");
    info!("   Worker will continue running for missions...");
    info!("   Press Ctrl+C to stop");
    info!("");
    
    // Keep the worker running (heartbeat continues in background)
    // In production, this would wait for mission queue or signals
    tokio::signal::ctrl_c().await?;
    
    info!("🛑 Shutting down...");
    
    // Stop heartbeat monitoring
    heartbeat_handle.abort();
    
    // Close browser session
    info!("🔒 Closing Phantom Worker");
    phantom_worker.close().await?;
    
    info!("✅ Shutdown complete");
    
    Ok(())
}
