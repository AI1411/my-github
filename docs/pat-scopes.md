# PAT required scopes

Classic GitHub PATs must include **`repo`**, **`read:user`**, and **`notifications`**.

These match:

- `REQUIRED_SCOPES` in `src-tauri/src/auth/pat.rs` (`check_required_scopes`)
- The scope help text in `src/pages/components/PATTab.tsx` (Login and Settings → Add account)

Fine-grained tokens with an empty `X-OAuth-Scopes` header are accepted when GitHub omits classic scope headers.
