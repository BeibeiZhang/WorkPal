#!/usr/bin/env bash
# WorkPal Agent — uninstall helper.
# Removes launchd registration, plist, optionally config + app bundle.
set -euo pipefail

LABEL="com.workpal.agent"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CONFIG_DIR="$HOME/.workpal-agent"
APP="/Applications/WorkPal Agent.app"

echo "→ Booting out launchd service (if loaded)…"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true

if [[ -f "$PLIST" ]]; then
  echo "→ Removing $PLIST"
  rm -f "$PLIST"
fi

read -r -p "Remove config + logs at $CONFIG_DIR? [y/N] " reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  rm -rf "$CONFIG_DIR"
  echo "  removed."
fi

if [[ -d "$APP" ]]; then
  read -r -p "Delete app bundle at $APP? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    rm -rf "$APP"
    echo "  removed."
  fi
fi

echo "Done."
