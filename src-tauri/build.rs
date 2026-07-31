use std::fs;
use std::path::PathBuf;

fn main() {
    load_github_client_id_from_dotenv();
    println!("cargo:rerun-if-env-changed=GITHUB_CLIENT_ID");
    println!("cargo:rerun-if-changed=../.env");
    tauri_build::build()
}

/// Loads `GITHUB_CLIENT_ID` from the repo-root `.env` so Device Flow works
/// without exporting the var in every shell. Existing env wins.
fn load_github_client_id_from_dotenv() {
    if std::env::var_os("GITHUB_CLIENT_ID").is_some() {
        return;
    }

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let env_path = manifest_dir.join("../.env");
    let Ok(contents) = fs::read_to_string(&env_path) else {
        return;
    };

    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim() != "GITHUB_CLIENT_ID" {
            continue;
        }
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
        if !value.is_empty() && value != "your_client_id_here" {
            println!("cargo:rustc-env=GITHUB_CLIENT_ID={value}");
        }
        break;
    }
}
