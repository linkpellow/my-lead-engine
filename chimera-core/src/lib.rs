//! Chimera Core Library
//! 
//! This library provides the core functionality for the Digital Phantom
//! stealth worker swarm.

pub mod client;
pub mod stealth;

pub use client::ChimeraClient;
pub use stealth::{DiffusionMousePath, BehavioralJitter};
