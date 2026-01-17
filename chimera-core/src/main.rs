//! Chimera Core - The Body (Digital Phantom Worker Swarm)
//! 
//! This is the main entry point for the Rust stealth worker.
//! It connects to The Brain for vision processing and executes
//! browser missions with human-like behavior.

mod client;
mod stealth;

use std::env;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

use client::ChimeraClient;
use stealth::{DiffusionMousePath, BehavioralJitter};

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
    
    // Test connection to The Brain
    match ChimeraClient::connect().await {
        Ok(mut client) => {
            info!("✅ Connected to The Brain at: {}", client.address());
            
            // Test vision processing with a valid 1x1 transparent PNG
            info!("📸 Testing vision processing...");
            
            // Valid 1x1 transparent PNG (67 bytes)
            // This allows PIL to successfully open and process the image
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
            
            match client.process_vision(valid_png, Some("Test connection".to_string())).await {
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
            info!("🎯 The Body is ready for missions!");
            info!("   - Vision Service: Connected");
            info!("   - Diffusion Paths: Active");
            info!("   - Behavioral Jitter: Active");
            info!("");
            info!("🚀 Ready to achieve 100% Human trust score on CreepJS");
        }
        Err(e) => {
            error!("❌ Failed to connect to The Brain: {}", e);
            error!("   Make sure The Brain is running on port 50051");
            error!("   Try: cd chimera_brain && python server.py");
            return Err(e.into());
        }
    }
    
    Ok(())
}
