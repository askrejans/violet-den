#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VioletDen — Uninstall systemd service
#
# Stops the service, removes containers, and deletes the systemd unit.
# Does NOT remove Docker images or data volumes (preserves your data).
#
# Usage:  sudo ./uninstall.sh
#         sudo ./uninstall.sh --purge   # Also remove data volumes and images
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="violetden"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PURGE=false

for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
    --help|-h)
      echo "Usage: sudo ./uninstall.sh [--purge]"
      echo ""
      echo "  --purge  Also remove Docker volumes (database) and images"
      exit 0
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)."
  exit 1
fi

# ── Stop and disable service ─────────────────────────────────────────────────
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "Stopping $SERVICE_NAME..."
  systemctl stop "$SERVICE_NAME"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "Disabling $SERVICE_NAME..."
  systemctl disable "$SERVICE_NAME"
fi

# ── Tear down containers ────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
for f in docker-compose.yml docker-compose.ha.yml; do
  if [ -f "$f" ]; then
    echo "Removing containers ($f)..."
    if [ "$PURGE" = true ]; then
      docker compose -f "$f" down --volumes --rmi local 2>/dev/null || true
    else
      docker compose -f "$f" down --remove-orphans 2>/dev/null || true
    fi
  fi
done

# ── Remove service file ─────────────────────────────────────────────────────
if [ -f "$SERVICE_FILE" ]; then
  echo "Removing $SERVICE_FILE"
  rm -f "$SERVICE_FILE"
  systemctl daemon-reload
fi

echo ""
echo "VioletDen service removed."
if [ "$PURGE" = true ]; then
  echo "Docker volumes and images have been removed."
else
  echo "Docker volumes (data) were preserved. Run with --purge to remove them."
fi
