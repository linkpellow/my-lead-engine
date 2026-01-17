//! gRPC Client for The Brain
//! 
//! This module handles communication with the Python Brain service
//! for vision processing and memory queries.

use std::env;
use tonic::Request;
use tracing::{info, error, warn};

// Include generated proto code
pub mod chimera {
    tonic::include_proto!("chimera");
}

use chimera::brain_client::BrainClient;
use chimera::{ProcessVisionRequest, VisionResponse, QueryMemoryRequest, MemoryResponse};

/// Get the Brain service address from environment or use default
fn get_brain_address() -> String {
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

/// Client for communicating with The Brain service
pub struct ChimeraClient {
    client: BrainClient<tonic::transport::Channel>,
    address: String,
}

impl ChimeraClient {
    /// Connect to The Brain service
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
    
    /// Process a screenshot with the Vision Language Model
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
        let request = Request::new(ProcessVisionRequest {
            screenshot,
            context: String::new(),
            text_command: text_command.unwrap_or_default(),
        });
        
        info!("📸 Sending vision request to The Brain...");
        
        let response = self.client.process_vision(request).await?;
        let vision_response = response.into_inner();
        
        if vision_response.found {
            info!(
                "✅ Brain found coordinates: ({}, {}) with confidence: {:.2}",
                vision_response.x,
                vision_response.y,
                vision_response.confidence
            );
        } else {
            warn!("⚠️ Brain processed vision but found no specific coordinates");
        }
        
        Ok(vision_response)
    }
    
    /// Query the Hive Mind for cached experiences
    /// 
    /// # Arguments
    /// * `query` - Semantic search query
    /// * `ax_tree_summary` - Optional AX tree summary for experience recall
    /// * `screenshot_hash` - Optional screenshot hash for exact match
    /// 
    /// # Returns
    /// * `MemoryResponse` with cached action plans
    pub async fn query_memory(
        &mut self,
        query: String,
        ax_tree_summary: Option<String>,
        screenshot_hash: Option<String>,
    ) -> Result<MemoryResponse, tonic::Status> {
        let request = Request::new(QueryMemoryRequest {
            query,
            top_k: 5,
            ax_tree_summary: ax_tree_summary.unwrap_or_default(),
            screenshot_hash: screenshot_hash.unwrap_or_default(),
        });
        
        info!("🧠 Querying Hive Mind...");
        
        let response = self.client.query_memory(request).await?;
        let memory_response = response.into_inner();
        
        if !memory_response.results.is_empty() {
            info!("✅ Hive Mind returned {} cached experiences", memory_response.results.len());
        } else {
            info!("📝 No cached experiences found, must think for ourselves");
        }
        
        Ok(memory_response)
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
