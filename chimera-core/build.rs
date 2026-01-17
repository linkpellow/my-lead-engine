fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Compile the shared proto file into Rust code
    // The proto file is at ../@proto/chimera.proto relative to chimera-core/
    tonic_build::configure()
        .build_server(false)  // We're a client, not a server
        .compile_protos(
            &["../@proto/chimera.proto"],
            &["../@proto"],
        )?;
    
    println!("cargo:rerun-if-changed=../@proto/chimera.proto");
    
    Ok(())
}
