# Release Signing and Notarization

my-github v0.1.0 releases are built from `v*` tags by `.github/workflows/release.yml`.

## Required GitHub Secrets

Add these repository or organization secrets before pushing a release tag:

| Secret | Purpose |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application certificate (`.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` certificate |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application signing identity name |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key for future signed update artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the Tauri signing private key |

## Local Verification

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm tauri build
```

On macOS, verify the built app after signing:

```bash
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/my-github.app
spctl --assess --type execute --verbose src-tauri/target/release/bundle/macos/my-github.app
```

The workflow keeps releases as drafts so the generated artifacts can be inspected before publishing.
