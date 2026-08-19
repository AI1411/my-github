use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPrInEditorResult {
    pub path: String,
    pub branch: String,
    pub used_worktree: bool,
    pub editor: String,
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("failed to spawn git: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "git {} failed: {}",
            args.join(" "),
            if !stderr.trim().is_empty() {
                stderr.trim()
            } else {
                stdout.trim()
            }
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn editor_bin(editor: &str) -> &'static str {
    match editor {
        "cursor" => "cursor",
        "zed" => "zed",
        "idea" => "idea",
        _ => "code",
    }
}

fn open_with_editor(editor: &str, path: &Path) -> Result<(), String> {
    let bin = editor_bin(editor);
    let status = Command::new(bin)
        .arg(path.as_os_str())
        .status()
        .map_err(|e| format!("failed to open editor `{bin}`: {e}"))?;
    if !status.success() {
        return Err(format!("editor `{bin}` exited with {status}"));
    }
    Ok(())
}

fn is_git_repo(path: &Path) -> bool {
    path.join(".git").exists()
}

fn repo_path_candidates(roots: &[String], full_name: &str) -> Vec<PathBuf> {
    let full_name = full_name.trim();
    let Some((owner, repo)) = full_name.split_once('/') else {
        return Vec::new();
    };
    let owner = owner.trim();
    let repo = repo.trim();
    if owner.is_empty() || repo.is_empty() {
        return Vec::new();
    }

    let mut candidates = Vec::new();
    for root in roots {
        let root = root.trim().trim_end_matches(['/', '\\']);
        if root.is_empty() {
            continue;
        }
        let root = PathBuf::from(root);
        candidates.push(root.join(repo));
        candidates.push(root.join(owner).join(repo));
    }
    candidates
}

/// Find a local git clone for `full_name` (owner/repo) under configured root directories.
#[tauri::command]
pub fn cmd_resolve_repo_path(roots: Vec<String>, full_name: String) -> Option<String> {
    for candidate in repo_path_candidates(&roots, &full_name) {
        if is_git_repo(&candidate) {
            return Some(candidate.display().to_string());
        }
    }
    None
}

/// Checkout (or create a worktree for) a PR head ref under a mapped local repo path,
/// then open the working tree in the configured editor.
#[tauri::command]
pub async fn cmd_open_pr_in_editor(
    local_path: String,
    head_ref: String,
    editor: String,
    use_worktree: bool,
) -> Result<OpenPrInEditorResult, String> {
    let root = PathBuf::from(local_path.trim());
    if !root.is_dir() {
        return Err(format!("local path is not a directory: {}", root.display()));
    }
    let head_ref = head_ref.trim();
    if head_ref.is_empty() {
        return Err("head_ref is required".into());
    }

    // Best-effort fetch so the tip exists locally.
    let _ = run_git(&root, &["fetch", "--all", "--prune"]);

    let mut work_path = root.clone();
    let mut used_worktree = false;

    if use_worktree {
        let safe = head_ref.replace('/', "-");
        let wt = root.join(".worktrees").join(&safe);
        if !wt.exists() {
            std::fs::create_dir_all(root.join(".worktrees"))
                .map_err(|e| format!("mkdir .worktrees failed: {e}"))?;
            // Prefer creating from remote tip when local branch is missing.
            let create = run_git(
                &root,
                &[
                    "worktree",
                    "add",
                    "--force",
                    wt.to_str().ok_or("invalid worktree path")?,
                    head_ref,
                ],
            );
            if create.is_err() {
                let remote = format!("origin/{head_ref}");
                run_git(
                    &root,
                    &[
                        "worktree",
                        "add",
                        "--force",
                        "-b",
                        head_ref,
                        wt.to_str().ok_or("invalid worktree path")?,
                        &remote,
                    ],
                )?;
            }
        }
        work_path = wt;
        used_worktree = true;
    } else {
        // Checkout local branch, or create tracking branch from origin.
        if run_git(&root, &["rev-parse", "--verify", head_ref]).is_ok() {
            run_git(&root, &["checkout", head_ref])?;
        } else {
            let remote = format!("origin/{head_ref}");
            run_git(&root, &["checkout", "-B", head_ref, &remote])?;
        }
    }

    open_with_editor(&editor, &work_path)?;

    Ok(OpenPrInEditorResult {
        path: work_path.display().to_string(),
        branch: head_ref.to_string(),
        used_worktree,
        editor,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editor_bin_defaults_to_code() {
        assert_eq!(editor_bin("vscode"), "code");
        assert_eq!(editor_bin("cursor"), "cursor");
    }

    #[test]
    fn repo_path_candidates_flat_and_nested() {
        let roots = vec!["/src".to_string()];
        let paths = repo_path_candidates(&roots, "acme/widget");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0], PathBuf::from("/src/widget"));
        assert_eq!(paths[1], PathBuf::from("/src/acme/widget"));
    }

    #[test]
    fn repo_path_candidates_rejects_invalid_full_name() {
        assert!(repo_path_candidates(&["/src".to_string()], "nope").is_empty());
        assert!(repo_path_candidates(&["/src".to_string()], "/repo").is_empty());
    }
}
