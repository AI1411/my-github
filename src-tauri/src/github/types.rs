use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct User {
    pub id: u64,
    pub login: String,
    pub avatar_url: String,
    pub html_url: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Label {
    pub id: u64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Repository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub owner: User,
    pub html_url: String,
    #[serde(default)]
    pub description: Option<String>,
    pub fork: bool,
    pub default_branch: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_user_from_json() {
        let json = r#"{
            "id": 1,
            "login": "octocat",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
            "html_url": "https://github.com/octocat"
        }"#;
        let user: User = serde_json::from_str(json).unwrap();
        assert_eq!(user.id, 1);
        assert_eq!(user.login, "octocat");
        assert_eq!(user.name, None);
    }

    #[test]
    fn deserialize_user_with_name() {
        let json = r#"{
            "id": 2,
            "login": "monalisa",
            "avatar_url": "https://avatars.githubusercontent.com/u/2",
            "html_url": "https://github.com/monalisa",
            "name": "Mona Lisa"
        }"#;
        let user: User = serde_json::from_str(json).unwrap();
        assert_eq!(user.name, Some("Mona Lisa".to_string()));
    }

    #[test]
    fn deserialize_label_from_json() {
        let json = r#"{"id": 100, "name": "bug", "color": "d73a4a"}"#;
        let label: Label = serde_json::from_str(json).unwrap();
        assert_eq!(label.id, 100);
        assert_eq!(label.name, "bug");
        assert_eq!(label.color, "d73a4a");
    }

    #[test]
    fn deserialize_repository_from_json() {
        let json = r#"{
            "id": 1296269,
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "private": false,
            "owner": {
                "id": 1,
                "login": "octocat",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/octocat"
            },
            "html_url": "https://github.com/octocat/Hello-World",
            "description": "My first repo",
            "fork": false,
            "default_branch": "main"
        }"#;
        let repo: Repository = serde_json::from_str(json).unwrap();
        assert_eq!(repo.id, 1296269);
        assert_eq!(repo.full_name, "octocat/Hello-World");
        assert!(!repo.private);
        assert_eq!(repo.default_branch, "main");
        assert_eq!(repo.description, Some("My first repo".to_string()));
    }

    #[test]
    fn deserialize_repository_without_description() {
        let json = r#"{
            "id": 2,
            "name": "repo2",
            "full_name": "user/repo2",
            "private": true,
            "owner": {
                "id": 1,
                "login": "user",
                "avatar_url": "https://avatars.githubusercontent.com/u/1",
                "html_url": "https://github.com/user"
            },
            "html_url": "https://github.com/user/repo2",
            "fork": false,
            "default_branch": "master"
        }"#;
        let repo: Repository = serde_json::from_str(json).unwrap();
        assert_eq!(repo.description, None);
        assert!(repo.private);
    }
}
