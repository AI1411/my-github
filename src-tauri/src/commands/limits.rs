pub const MAX_INBOX_FIRST: i64 = 100;
pub const DEFAULT_INBOX_FIRST: i64 = 50;
pub const MAX_FILTER_LABELS: usize = 20;
pub const MAX_LABEL_NAME_LEN: usize = 100;

pub fn validate_inbox_first(first: Option<i64>) -> Result<i64, String> {
    let value = first.unwrap_or(DEFAULT_INBOX_FIRST);
    if value < 1 {
        return Err(format!(
            "inbox first must be between 1 and {MAX_INBOX_FIRST}"
        ));
    }
    if value > MAX_INBOX_FIRST {
        return Err(format!(
            "inbox first must be between 1 and {MAX_INBOX_FIRST}"
        ));
    }
    Ok(value)
}

pub fn validate_label_list(labels: &[String], field_name: &str) -> Result<(), String> {
    if labels.len() > MAX_FILTER_LABELS {
        return Err(format!(
            "{field_name} supports at most {MAX_FILTER_LABELS} labels"
        ));
    }
    if labels.iter().any(|label| label.len() > MAX_LABEL_NAME_LEN) {
        return Err(format!(
            "each {field_name} label must be at most {MAX_LABEL_NAME_LEN} characters"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_inbox_first_defaults_and_caps() {
        assert_eq!(validate_inbox_first(None).unwrap(), DEFAULT_INBOX_FIRST);
        assert_eq!(validate_inbox_first(Some(25)).unwrap(), 25);
        assert!(validate_inbox_first(Some(0)).is_err());
        assert!(validate_inbox_first(Some(101)).is_err());
    }

    #[test]
    fn validate_label_list_rejects_too_many_or_long_labels() {
        assert!(validate_label_list(&[], "filter").is_ok());
        let many = vec!["bug".to_string(); MAX_FILTER_LABELS + 1];
        assert!(validate_label_list(&many, "filter").is_err());
        let long = vec!["x".repeat(MAX_LABEL_NAME_LEN + 1)];
        assert!(validate_label_list(&long, "filter").is_err());
    }
}
