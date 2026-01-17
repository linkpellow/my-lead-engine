fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Compile the shared proto file into Rust code
    // Try local proto file first (Railway build), then fallback to ../@proto/ (local dev)
    let (proto_path, include_dir) = if std::path::Path::new("./proto/chimera.proto").exists() {
        ("./proto/chimera.proto", "./proto")
    } else if std::path::Path::new("../@proto/chimera.proto").exists() {
        ("../@proto/chimera.proto", "../@proto")
    } else {
        return Err("chimera.proto not found in ./proto/ or ../@proto/".into());
    };
    
    tonic_build::configure()
        .build_server(false)  // We're a client, not a server
        .compile_protos(
            &[proto_path],
            &[include_dir],
        )?;
    
    println!("cargo:rerun-if-changed={}", proto_path);
    
    Ok(())
}
