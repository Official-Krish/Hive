#!/usr/bin/env bash
# Hive collector one-line installer.
#
# Downloads the platform binary from a CDN, installs it to ~/.local/bin/hive,
# and prints the next steps. Run with:
#
#   curl -fsSL <CDN>/install.sh | bash
#
# Config:
#   HIVE_DOWNLOAD_BASE   Base URL for binaries (default: https://cdn.krishlabs.tech/hive/collector).
#                        The binary is fetched as <BASE>/<VERSION>/collector.
#   HIVE_INSTALL_DIR     Install directory (default: ~/.local/bin)
#   HIVE_VERSION         Version tag; default: 0.1.0
set -euo pipefail

BASE="${HIVE_DOWNLOAD_BASE:-https://cdn.krishlabs.tech/hive/collector}"
VERSION="${HIVE_VERSION:-v0.1.0}"
DEST_DIR="${HIVE_INSTALL_DIR:-$HOME/.local/bin}"

URL="${BASE}/${VERSION}/collector"

echo "Downloading ${URL} ..."
mkdir -p "$DEST_DIR"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP"
else
  wget -qO "$TMP" "$URL"
fi

install -m 0755 "$TMP" "$DEST_DIR/hive"
rm -f "$TMP"

echo
echo "✓ hive ${VERSION} installed to ${DEST_DIR}/hive"

case ":$PATH:" in
  *":$DEST_DIR:"*) ;;
  *) echo "  ⚠ $DEST_DIR is not on your PATH — add it:"
     echo "    export PATH=\"$DEST_DIR:\$PATH\"" ;;
esac

echo
echo "Next steps:"
echo "  1. hive login      # once, with your Hive account"
echo "  2. hive start      # registers this machine as a device, then starts"
echo "     (the first start walks you through device registration and workspace
       selection automatically)"
