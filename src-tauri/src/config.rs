/// GitHub OAuth App Client ID (compile-time via `GITHUB_CLIENT_ID` or repo-root `.env`).
pub const CLIENT_ID: &str = match option_env!("GITHUB_CLIENT_ID") {
    Some(id) => id,
    None => "",
};

/// Whether a real Client ID was baked in at build time.
pub fn has_client_id() -> bool {
    !CLIENT_ID.is_empty() && CLIENT_ID != "your_client_id_here" && CLIENT_ID != "dev_placeholder"
}
