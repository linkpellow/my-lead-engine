//! Chimera Core Library
//! 
//! This library provides the core functionality for the Digital Phantom
//! stealth worker swarm.

pub mod client;
pub mod stealth;
pub mod workers;
pub mod validation;

pub use client::ChimeraClient;
pub use stealth::{DiffusionMousePath, BehavioralJitter};
pub use workers::PhantomWorker;
pub use validation::validate_creepjs;