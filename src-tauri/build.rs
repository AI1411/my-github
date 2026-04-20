fn main() {
    println!("cargo:rerun-if-env-changed=GITHUB_CLIENT_ID");
    tauri_build::build()
}
