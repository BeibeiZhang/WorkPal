#!/usr/bin/env bash
# WorkPal Agent — uninstall helper.
# Removes launchd registration, plist, the local CA from System Keychain,
# optionally config + cert files + app bundle.
set -euo pipefail

LABEL="com.workpal.agent"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CONFIG_DIR="$HOME/.workpal-agent"
USER_DATA_DIR="$HOME/Library/Application Support/WorkPal Agent"
APP="/Applications/WorkPal Agent.app"
CA_COMMON_NAME="WorkPal Agent CA"
SYSTEM_KEYCHAIN="/Library/Keychains/System.keychain"

echo "→ Booting out launchd service (if loaded)…"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true

if [[ -f "$PLIST" ]]; then
  echo "→ Removing $PLIST"
  rm -f "$PLIST"
fi

# 7.3: remove the local CA from the System Keychain. Loops because an orphan
# install path (userData wiped + reinstalled) can leave two CAs with the same
# CN; `security delete-certificate` removes one at a time. Cap at 8 iterations
# to bound runtime in pathological cases. Requires sudo — System.keychain is
# admin-protected. If the user declines sudo the CA stays trusted; that's
# their call and we just print a hint.
if security find-certificate -c "$CA_COMMON_NAME" "$SYSTEM_KEYCHAIN" >/dev/null 2>&1; then
  read -r -p "Remove '$CA_COMMON_NAME' from System Keychain? (sudo) [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    for i in 1 2 3 4 5 6 7 8; do
      if ! sudo security delete-certificate -c "$CA_COMMON_NAME" "$SYSTEM_KEYCHAIN" 2>/dev/null; then
        break
      fi
      echo "  deleted match #$i"
    done
    echo "  CA removed."
  else
    echo "  Skipped — CA still trusted in Keychain. Run manually with: sudo security delete-certificate -c \"$CA_COMMON_NAME\" \"$SYSTEM_KEYCHAIN\""
  fi
fi

read -r -p "Remove config + logs at $CONFIG_DIR? [y/N] " reply
if [[ "$reply" =~ ^[Yy]$ ]]; then
  rm -rf "$CONFIG_DIR"
  echo "  removed."
fi

if [[ -d "$USER_DATA_DIR" ]]; then
  read -r -p "Remove app data (cert files, Electron cache) at $USER_DATA_DIR? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    rm -rf "$USER_DATA_DIR"
    echo "  removed."
  fi
fi

if [[ -d "$APP" ]]; then
  read -r -p "Delete app bundle at $APP? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    rm -rf "$APP"
    echo "  removed."
  fi
fi

echo "Done."
