//! gRPC Client for The Brain
//! 
//! This module handles communication with the Python Brain service
//! for vision processing and memory queries with retry logic and resilience.

use std::env;
use std::time::{Duration, Instant};
use tonic::{Request, Status, Code};
use tracing::{info, error, warn, debug};
use tokio::time::sleep;

// Include generated proto code
pub mod chimera {
    tonic::include_proto!("chimera");
}

use chimera::brain_client::BrainClient;
use chimera::{ProcessVisionRequest, VisionResponse, QueryMemoryRequest, MemoryResponse};

/// Get the Brain service address from environment or use default
pub fn get_brain_address() -> String {
    // Check for Railway environment (production)
    if let Ok(railway_env) = env::var("RAILWAY_ENVIRONMENT") {
        if railway_env == "production" {
            // Railway uses service name as internal hostname
            return env::var("CHIMERA_BRAIN_ADDRESS")
                .unwrap_or_else(|_| "http://chimera-brain.railway.internal:50051".to_string());
        }
    }
    
    // Local development or explicit override
    env::var("CHIMERA_BRAIN_ADDRESS")
        .unwrap_or_else(|_| "http://localhost:50051".to_string())
}

/// Connect to The Brain with exponential backoff retry
/// 
/// # Arguments
/// * `max_retries` - Maximum number of retry attempts (default: 5)
/// 
/// # Returns
/// * Result with ChimeraClient or error
pub async fn connect_with_retry(max_retries: u32) -> Result<ChimeraClient, Box<dyn std::error::Error>> {
    let address = get_brain_address();
    let mut attempt = 0;
    let mut delay_ms = 100; // Start with 100ms delay
    
    loop {
        attempt += 1;
        info!("🔗 Connecting to The Brain (attempt {}/{}): {}", attempt, max_retries, address);
        
        match ChimeraClient::connect_to(&address).await {
            Ok(client) => {
                info!("✅ Connected to The Brain after {} attempt(s)", attempt);
                return Ok(client);
            }
            Err(e) => {
                if attempt >= max_retries {
                    error!("❌ Failed to connect to The Brain after {} attempts: {}", max_retries, e);
                    return Err(format!("Connection failed after {} attempts: {}", max_retries, e).into());
                }
                
                warn!("⚠️ Connection attempt {} failed: {}, retrying in {}ms...", attempt, e, delay_ms);
                sleep(Duration::from_millis(delay_ms)).await;
                
                // Exponential backoff: double the delay each time (max 10 seconds)
                delay_ms = (delay_ms * 2).min(10_000);
            }
        }
    }
}

/// Client for communicating with The Brain service
pub struct ChimeraClient {
    client: BrainClient<tonic::transport::Channel>,
    address: String,
}

impl ChimeraClient {
    /// Connect to The Brain service (single attempt, no retry)
    pub async fn connect() -> Result<Self, tonic::transport::Error> {
        let address = get_brain_address();
        Self::connect_to(&address).await
    }
    
    /// Connect to a specific address
    pub async fn connect_to(addr: &str) -> Result<Self, tonic::transport::Error> {
        info!("🔗 Connecting to The Brain at: {}", addr);
        
        let client = BrainClient::connect(addr.to_string()).await?;
        
        info!("✅ Connected to The Brain");
        
        Ok(Self { 
            client,
            address: addr.to_string(),
        })
    }
    
    /// Reconnect to The Brain (useful after connection loss)
    pub async fn reconnect(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        info!("🔄 Reconnecting to The Brain...");
        let address = self.address.clone();
        
        match Self::connect_to(&address).await {
            Ok(new_client) => {
                self.client = new_client.client;
                info!("✅ Reconnected to The Brain");
                Ok(())
            }
            Err(e) => {
                error!("❌ Reconnection failed: {}", e);
                Err(format!("Reconnection failed: {}", e).into())
            }
        }
    }
    
    /// Process a screenshot with the Vision Language Model (with retry logic)
    /// 
    /// # Arguments
    /// * `screenshot` - PNG image bytes
    /// * `text_command` - Natural language command (e.g., "Click the submit button")
    /// 
    /// # Returns
    /// * `VisionResponse` with coordinates or description
    pub async fn process_vision(
        &mut self, 
        screenshot: Vec<u8>, 
        text_command: Option<String>
    ) -> Result<VisionResponse, tonic::Status> {
        let start_time = Instant::now();
        let request = Request::new(ProcessVisionRequest {
            screenshot,
            context: String::new(),
            text_command: text_command.unwrap_or_default(),
        });
        
        info!("📸 Sending vision request to The Brain...");
        
        // Retry logic for gRPC calls
        let max_retries = 5;
        let mut attempt = 0;
        let mut delay_ms = 100;
        
        loop {
            attempt += 1;
            
            match self.client.process_vision(request.clone()).await {
                Ok(response) => {
                    let latency = start_time.elapsed();
                    let vision_response = response.into_inner();
                    
                    debug!("📸 Vision request completed in {:?} (attempt {})", latency, attempt);
                    
                    if vision_response.found {
                        info!(
                            "✅ Brain found coordinates: ({}, {}) with confidence: {:.2} (latency: {:?})",
                            vision_response.x,
                            vision_response.y,
                            vision_response.confidence,
                            latency
                        );
                    } else {
                        warn!("⚠️ Brain processed vision but found no specific coordinates (latency: {:?})", latency);
                    }
                    
                    return Ok(vision_response);
                }
                Err(status) => {
                    // Check if error is retryable
                    let is_retryable = matches!(
                        status.code(),
                        Code::Unavailable | Code::Internal | Code::DeadlineExceeded
                    );
                    
                    if !is_retryable || attempt >= max_retries {
                        let latency = start_time.elapsed();
                        error!(
                            "❌ Vision processing failed (latency: {:?}, attempt {}): Status={:?}, Message={}",
                            latency, attempt, status.code(), status.message()
                        );
                        return Err(status);
                    }
                    
                    warn!(
                        "⚠️ Vision request failed (attempt {}/{}): Status={:?}, retrying in {}ms...",
                        attempt, max_retries, status.code(), delay_ms
                    );
                    
                    sleep(Duration::from_millis(delay_ms)).await;
                    delay_ms = (delay_ms * 2).min(10_000); // Exponential backoff, max 10s
                }
            }
        }
    }
    
    /// Query the Hive Mind for cached experiences (with retry logic)
    /// 
    /// # Arguments
    /// * `query` - Semantic search query
    /// * `ax_tree_summary` - Optional AX tree summary for experience recall
    /// * `screenshot_hash` - Optional screenshot hash for exact match
    /// 
    /// # Returns
    /// * `MemoryResponse` with cached action plans
    /// 
    /// # Experience Replay
    /// If similarity > 0.95, the response indicates a high-confidence cached solution
    /// that can be replayed without VLM inference.
    pub async fn query_memory(
        &mut self,
        query: String,
        ax_tree_summary: Option<String>,
        screenshot_hash: Option<String>,
    ) -> Result<MemoryResponse, tonic::Status> {
        let start_time = Instant::now();
        let request = Request::new(QueryMemoryRequest {
            query,
            top_k: 5,
            ax_tree_summary: ax_tree_summary.unwrap_or_default(),
            screenshot_hash: screenshot_hash.unwrap_or_default(),
        });
        
        info!("🧠 Querying Hive Mind...");
        
        // Retry logic for gRPC calls
        let max_retries = 5;
        let mut attempt = 0;
        let mut delay_ms = 100;
        
        loop {
            attempt += 1;
            
            match self.client.query_memory(request.clone()).await {
                Ok(response) => {
                    let latency = start_time.elapsed();
                    let memory_response = response.into_inner();
                    
                    debug!("🧠 Memory query completed in {:?} (attempt {})", latency, attempt);
                    
                    if !memory_response.results.is_empty() {
                        // Check for high-confidence matches (Experience Replay candidates)
                        let high_confidence_count = memory_response.results.iter()
                            .filter(|r| r.similarity > 0.95)
                            .count();
                        
                        if high_confidence_count > 0 {
                            info!("🎯 Hive Mind returned {} high-confidence experiences (similarity > 0.95) - Experience Replay ready!", high_confidence_count);
                            info!("✅ Hive Mind returned {} cached experiences (latency: {:?})", memory_response.results.len(), latency);
                        } else {
                            info!("✅ Hive Mind returned {} cached experiences (latency: {:?})", memory_response.results.len(), latency);
                        }
                    } else {
                        info!("📝 No cached experiences found, must think for ourselves (latency: {:?})", latency);
                    }
                    
                    return Ok(memory_response);
                }
                Err(status) => {
                    // Check if error is retryable
                    let is_retryable = matches!(
                        status.code(),
                        Code::Unavailable | Code::Internal | Code::DeadlineExceeded
                    );
                    
                    if !is_retryable || attempt >= max_retries {
                        let latency = start_time.elapsed();
                        error!(
                            "❌ Memory query failed (latency: {:?}, attempt {}): Status={:?}, Message={}",
                            latency, attempt, status.code(), status.message()
                        );
                        return Err(status);
                    }
                    
                    warn!(
                        "⚠️ Memory query failed (attempt {}/{}): Status={:?}, retrying in {}ms...",
                        attempt, max_retries, status.code(), delay_ms
                    );
                    
                    sleep(Duration::from_millis(delay_ms)).await;
                    delay_ms = (delay_ms * 2).min(10_000); // Exponential backoff, max 10s
                }
            }
        }
    }
    
    /// Health check - Simple ping to verify The Brain is responsive
    /// Uses ProcessVision with minimal test data
    /// 
    /// # Returns
    /// * Result indicating if The Brain is healthy
    pub async fn health_check(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Use minimal 1x1 transparent PNG for health check
        let test_png: Vec<u8> = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0x60, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82,
        ];
        
        match self.process_vision(test_png, Some("health_check".to_string())).await {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Health check failed: {}", e).into()),
        }
    }
    
    /// Get the current connection address
    pub fn address(&self) -> &str {
        &self.address
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    #[ignore] // Requires running Brain server
    async fn test_connect_to_brain() {
        let result = ChimeraClient::connect().await;
        assert!(result.is_ok(), "Should connect to Brain");
    }
}
