#!/usr/bin/env bash
# Report release bundle sizes for macOS/Windows artifacts (when present) and the
# Linux release binary. Run after `pnpm tauri build`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${ROOT}/src-tauri/target/release/bundle"

echo "my-github size report"
echo "====================="

linux_bin="${ROOT}/src-tauri/target/release/my-github"
if [[ -f "$linux_bin" ]]; then
  du -h "$linux_bin" | awk '{print "Linux binary: " $1}'
else
  echo "Linux binary: (not built — run pnpm tauri build)"
fi

if [[ -d "$TARGET_DIR" ]]; then
  echo ""
  echo "Bundle artifacts:"
  find "$TARGET_DIR" -type f \( -name "*.dmg" -o -name "*.msi" -o -name "*.exe" -o -name "*.AppImage" \) \
    -exec du -h {} \; | sort -k2
else
  echo "Bundle dir: (missing — run pnpm tauri build)"
fi
