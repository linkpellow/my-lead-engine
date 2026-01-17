//! Stealth Module - Diffusion-Based Mouse Paths & Behavioral Jitter
//! 
//! This module implements human-like behavior patterns to achieve
//! 100% Human trust score on CreepJS.

use rand::Rng;
use noise::{NoiseFn, Perlin};
use std::time::Duration;
use tracing::debug;

/// Mouse path generator using diffusion-based movement
pub struct DiffusionMousePath {
    perlin: Perlin,
    seed: u32,
}

impl DiffusionMousePath {
    /// Create a new mouse path generator
    pub fn new() -> Self {
        let mut rng = rand::thread_rng();
        let seed = rng.gen();
        
        Self {
            perlin: Perlin::new(seed),
            seed,
        }
    }
    
    /// Generate a human-like mouse path from start to end
    /// 
    /// Uses Perlin noise to create natural-looking curves and
    /// micro-movements that mimic real human behavior.
    /// 
    /// # Arguments
    /// * `start` - Starting coordinates (x, y)
    /// * `end` - Target coordinates (x, y)
    /// * `steps` - Number of intermediate points
    /// 
    /// # Returns
    /// * Vector of (x, y, delay_ms) tuples for each step
    pub fn generate_path(
        &self,
        start: (f64, f64),
        end: (f64, f64),
        steps: usize,
    ) -> Vec<(f64, f64, u64)> {
        let mut path = Vec::with_capacity(steps + 1);
        let mut rng = rand::thread_rng();
        
        // Calculate total distance for speed variation
        let dx = end.0 - start.0;
        let dy = end.1 - start.1;
        let distance = (dx * dx + dy * dy).sqrt();
        
        // Base delay scales with distance (humans move slower for longer distances)
        let base_delay_ms = (distance * 0.5).min(100.0).max(5.0) as u64;
        
        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            
            // Ease-in-out curve (humans accelerate then decelerate)
            let eased_t = if t < 0.5 {
                2.0 * t * t
            } else {
                1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
            };
            
            // Linear interpolation
            let mut x = start.0 + dx * eased_t;
            let mut y = start.1 + dy * eased_t;
            
            // Add Perlin noise for natural waviness
            let noise_scale = 10.0; // Controls "waviness" of path
            let noise_amplitude = distance * 0.05; // Noise proportional to distance
            
            let noise_x = self.perlin.get([t * noise_scale, 0.0]) * noise_amplitude;
            let noise_y = self.perlin.get([t * noise_scale, 1.0]) * noise_amplitude;
            
            x += noise_x;
            y += noise_y;
            
            // Add micro-jitter (tiny random movements)
            let jitter_x = rng.gen_range(-1.5..1.5);
            let jitter_y = rng.gen_range(-1.5..1.5);
            
            x += jitter_x;
            y += jitter_y;
            
            // Delay variation (humans don't move at constant speed)
            let delay_variation = rng.gen_range(0.7..1.3);
            let delay_ms = (base_delay_ms as f64 * delay_variation) as u64;
            
            // Occasionally add a tiny pause (human hesitation)
            let delay_ms = if rng.gen_bool(0.05) {
                delay_ms + rng.gen_range(20..80)
            } else {
                delay_ms
            };
            
            path.push((x, y, delay_ms));
        }
        
        debug!(
            "Generated diffusion path: {} points, {:.0}px distance",
            path.len(),
            distance
        );
        
        path
    }
}

impl Default for DiffusionMousePath {
    fn default() -> Self {
        Self::new()
    }
}

/// Behavioral jitter generator for human-like timing
pub struct BehavioralJitter {
    rng: rand::rngs::ThreadRng,
}

impl BehavioralJitter {
    /// Create a new jitter generator
    pub fn new() -> Self {
        Self {
            rng: rand::thread_rng(),
        }
    }
    
    /// Generate a human-like delay with variation
    /// 
    /// # Arguments
    /// * `base_ms` - Base delay in milliseconds
    /// 
    /// # Returns
    /// * Duration with ±30% random variation
    pub fn human_delay(&mut self, base_ms: u64) -> Duration {
        let variation = (base_ms as f64 * 0.3) as u64;
        let min = base_ms.saturating_sub(variation);
        let max = base_ms + variation;
        let delay_ms = self.rng.gen_range(min..=max);
        Duration::from_millis(delay_ms)
    }
    
    /// Generate timing for a mouse click (press + release)
    /// 
    /// # Returns
    /// * (press_delay, hold_duration, release_delay)
    pub fn click_timing(&mut self) -> (Duration, Duration, Duration) {
        let press_delay = self.human_delay(50);
        let hold_duration = Duration::from_millis(self.rng.gen_range(80..180));
        let release_delay = self.human_delay(30);
        
        (press_delay, hold_duration, release_delay)
    }
    
    /// Generate timing for typing a character
    /// 
    /// # Returns
    /// * Duration between keystrokes
    pub fn keystroke_delay(&mut self) -> Duration {
        // Average typing speed: 40-60 WPM = ~100-150ms per character
        Duration::from_millis(self.rng.gen_range(80..180))
    }
    
    /// Generate a "thinking" pause (human hesitation)
    /// 
    /// # Returns
    /// * Duration for a short pause (200-800ms)
    pub fn thinking_pause(&mut self) -> Duration {
        Duration::from_millis(self.rng.gen_range(200..800))
    }
    
    /// Generate a "reading" pause (scanning page content)
    /// 
    /// # Arguments
    /// * `content_length` - Approximate length of content to "read"
    /// 
    /// # Returns
    /// * Duration proportional to content length
    pub fn reading_pause(&mut self, content_length: usize) -> Duration {
        // Average reading speed: ~250 words/minute = ~4 words/second
        let base_ms = (content_length as f64 / 5.0 * 200.0) as u64;
        let base_ms = base_ms.min(3000).max(300); // Clamp to 0.3-3 seconds
        self.human_delay(base_ms)
    }
    
    /// Decide whether to add a random micro-action (scroll, mouse wiggle)
    /// 
    /// # Returns
    /// * `true` with 10% probability
    pub fn should_add_micro_action(&mut self) -> bool {
        self.rng.gen_bool(0.10)
    }
}

impl Default for BehavioralJitter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_diffusion_path_generation() {
        let generator = DiffusionMousePath::new();
        let path = generator.generate_path((0.0, 0.0), (100.0, 100.0), 20);
        
        assert_eq!(path.len(), 21); // 20 steps + starting point
        
        // First point should be near start
        assert!(path[0].0.abs() < 5.0);
        assert!(path[0].1.abs() < 5.0);
        
        // Last point should be near end
        let last = path.last().unwrap();
        assert!((last.0 - 100.0).abs() < 10.0);
        assert!((last.1 - 100.0).abs() < 10.0);
    }
    
    #[test]
    fn test_behavioral_jitter() {
        let mut jitter = BehavioralJitter::new();
        
        // Test human delay variation
        let delays: Vec<_> = (0..10).map(|_| jitter.human_delay(100)).collect();
        
        // Should have variation (not all same)
        let first = delays[0].as_millis();
        let has_variation = delays.iter().any(|d| d.as_millis() != first);
        assert!(has_variation, "Delays should have variation");
        
        // All delays should be within expected range (70-130ms for base 100ms)
        for delay in delays {
            let ms = delay.as_millis();
            assert!(ms >= 70 && ms <= 130, "Delay {} should be in range", ms);
        }
    }
}
