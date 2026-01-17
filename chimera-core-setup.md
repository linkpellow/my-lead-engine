# Rust Body (chimera-core) Setup Guide

## 🎯 Railway Internal Network Connection

### Service Address Format

Railway uses **service names as internal hostnames**. For The Brain service:

**Railway Internal Address:**
```
chimera-brain.railway.internal:50051
```

**Or (depending on Railway DNS):**
```
chimera-brain:50051
```

**Local Development:**
```
localhost:50051
```

---

## 📋 Rust gRPC Client Implementation

### 1. Cargo.toml Dependencies

```toml
[dependencies]
tonic = "0.10"
prost = "0.12"
tokio = { version = "1.0", features = ["full"] }

[build-dependencies]
prost-build = "0.12"
tonic-build = "0.10"
```

### 2. build.rs (Proto Generation)

Create `build.rs` in your `chimera-core/` root:

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(false)  // We're a client, not a server
        .compile(
            &["../@proto/chimera.proto"],
            &["../@proto"],
        )?;
    Ok(())
}
```

### 3. gRPC Client Code

Create `src/grpc/brain_client.rs`:

```rust
use tonic::Request;
use std::env;

// Generated proto code (from build.rs)
pub mod proto {
    tonic::include_proto!("chimera");
}

use proto::brain_client::BrainClient;
use proto::{ProcessVisionRequest, VisionResponse};

/// Get the Brain service address from environment or use default
fn get_brain_address() -> String {
    // Railway internal network (production)
    if let Ok(railway_env) = env::var("RAILWAY_ENVIRONMENT") {
        if railway_env == "production" {
            // Railway uses service name as hostname
            return "http://chimera-brain.railway.internal:50051".to_string();
        }
    }
    
    // Local development or fallback
    env::var("CHIMERA_BRAIN_ADDRESS")
        .unwrap_or_else(|_| "http://localhost:50051".to_string())
}

/// Send screenshot to The Brain for vision processing
pub async fn process_vision(
    screenshot: Vec<u8>,
    text_command: Option<String>,
) -> Result<VisionResponse, tonic::Status> {
    let address = get_brain_address();
    
    log::info!("Connecting to The Brain at: {}", address);
    
    let mut client = BrainClient::connect(address)
        .await
        .map_err(|e| {
            log::error!("Failed to connect to The Brain: {}", e);
            tonic::Status::unavailable(format!("Brain service unavailable: {}", e))
        })?;
    
    let request = Request::new(ProcessVisionRequest {
        screenshot,
        context: String::new(),
        text_command: text_command.unwrap_or_default(),
    });
    
    log::info!("Sending vision request to The Brain...");
    
    let response = client
        .process_vision(request)
        .await
        .map_err(|e| {
            log::error!("Vision processing failed: {}", e);
            e
        })?;
    
    let vision_response = response.into_inner();
    
    if vision_response.found {
        log::info!(
            "✅ Brain found coordinates: ({}, {}) with confidence: {:.2}",
            vision_response.x,
            vision_response.y,
            vision_response.confidence
        );
    } else {
        log::info!("Brain processed vision but found no specific coordinates");
    }
    
    Ok(vision_response)
}

/// Query The Brain's Hive Mind for cached experiences
pub async fn query_memory(
    query: String,
    ax_tree_summary: Option<String>,
    screenshot_hash: Option<String>,
) -> Result<proto::MemoryResponse, tonic::Status> {
    let address = get_brain_address();
    
    let mut client = BrainClient::connect(address)
        .await
        .map_err(|e| {
            log::error!("Failed to connect to The Brain: {}", e);
            tonic::Status::unavailable(format!("Brain service unavailable: {}", e))
        })?;
    
    let request = Request::new(proto::QueryMemoryRequest {
        query,
        top_k: 5,
        ax_tree_summary: ax_tree_summary.unwrap_or_default(),
        screenshot_hash: screenshot_hash.unwrap_or_default(),
    });
    
    log::info!("Querying Hive Mind...");
    
    let response = client
        .query_memory(request)
        .await
        .map_err(|e| {
            log::error!("Memory query failed: {}", e);
            e
        })?;
    
    Ok(response.into_inner())
}
```

### 4. Usage Example

In your worker code (`src/workers/phantom.rs` or similar):

```rust
use crate::grpc::brain_client::process_vision;

async fn execute_mission_with_vision(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Take screenshot
    let screenshot = browser.screenshot().await?;
    
    // 2. Send to The Brain for coordinate detection
    let vision_response = process_vision(
        screenshot,
        Some("Click the submit button".to_string()),
    ).await?;
    
    if vision_response.found {
        // 3. Use diffusion-based mouse path to click
        let target_x = vision_response.x;
        let target_y = vision_response.y;
        
        // Execute human-like click with diffusion path
        browser.click_with_diffusion_path(target_x, target_y).await?;
        
        log::info!("✅ Successfully clicked at ({}, {})", target_x, target_y);
    } else {
        log::warn!("Brain could not find target element");
    }
    
    Ok(())
}
```

---

## 🔧 Environment Variables

### Railway Production

Set in Railway dashboard for `chimera-core` service:

```bash
# Optional: Override Brain address (defaults to Railway internal)
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051

# Railway environment detection
RAILWAY_ENVIRONMENT=production
```

### Local Development

```bash
# Point to local Brain instance
CHIMERA_BRAIN_ADDRESS=http://localhost:50051
```

---

## ✅ Verification Steps

### 1. Test Connection

```rust
// In a test or main function
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    
    // Test connection to The Brain
    let test_screenshot = vec![0u8; 100]; // Dummy data
    match process_vision(test_screenshot, None).await {
        Ok(response) => {
            println!("✅ Successfully connected to The Brain!");
            println!("   Description: {}", response.description);
            println!("   Confidence: {:.2}", response.confidence);
        }
        Err(e) => {
            eprintln!("❌ Failed to connect to The Brain: {}", e);
            return Err(e.into());
        }
    }
    
    Ok(())
}
```

### 2. Run CreepJS Validation

```rust
async fn validate_stealth() -> Result<f64, Box<dyn std::error::Error>> {
    // Navigate to CreepJS
    browser.goto("https://abrahamjuliot.github.io/creepjs/").await?;
    
    // Wait for page load
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // Take screenshot
    let screenshot = browser.screenshot().await?;
    
    // Send to Brain for analysis (optional - can also validate locally)
    let vision_response = process_vision(screenshot, None).await?;
    
    // Extract trust score from page
    let trust_score = browser.extract_trust_score().await?;
    
    if trust_score >= 100.0 {
        log::info!("✅ 100% Human trust score achieved!");
    } else {
        log::warn!("⚠️  Trust score: {:.1}% (target: 100%)", trust_score);
    }
    
    Ok(trust_score)
}
```

---

## 🚨 Critical Notes

1. **Railway Internal Network**: Use `chimera-brain.railway.internal:50051` in production
2. **Service Name**: Must match Railway service name exactly
3. **Port**: Always use 50051 (The Brain's listening port)
4. **Error Handling**: Always handle connection failures gracefully
5. **Retry Logic**: Implement exponential backoff for transient failures

---

## 📊 Complete Flow

```
Rust Worker (The Body)
  ↓ Takes screenshot
  ↓ Calls process_vision(screenshot, "Click submit button")
  ↓
The Brain (Python) - Port 50051
  ↓ Processes with VisionService
  ↓ Returns coordinates (x, y, confidence)
  ↓
Rust Worker
  ↓ Uses diffusion-based mouse path
  ↓ Clicks at coordinates
  ↓ Maintains 100% Human trust score
```

---

## 🎯 Success Criteria

- ✅ Rust client can connect to The Brain at Railway internal address
- ✅ `process_vision()` successfully returns coordinates
- ✅ `query_memory()` can retrieve cached experiences
- ✅ CreepJS validation achieves 100% Human trust score
- ✅ All 5 workers can communicate with The Brain simultaneously
