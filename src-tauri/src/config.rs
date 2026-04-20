pub const CLIENT_ID: &str = match option_env!("GITHUB_CLIENT_ID") {
    Some(id) => id,
    None => "dev_placeholder",
};
