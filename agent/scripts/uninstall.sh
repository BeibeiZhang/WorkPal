#!/usr/bin/env bash
# WorkPal Agent — uninstall helper.
# Removes launchd registration, plist, the local CA from System Keychain,
# optionally config + cert files + app bundle.
set -euo pipefail

LABEL="com.workpal.agent"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CONFIG_DIR="$HOME/.workpal-agent"
# Bug A: Electron's app.getName() reads package.json "name" (workpal-agent),
# not electron-builder.yml productName ("WorkPal Agent"). Bundle name in
# Info.plist is the latter; userData dir uses the former. Same in dev + packaged.
USER_DATA_DIR="$HOME/Library/Application Support/workpal-agent"
APP="/Applications/WorkPal Agent.app"
CA_COMMON_NAME="WorkPal Agent CA"
# Bug B: cert went into the user's login keychain (not System). User-domain
# trust → no sudo to add or remove.
LOGIN_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

echo "→ Booting out launchd service (if loaded)…"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true

if [[ -f "$PLIST" ]]; then
  echo "→ Removing $PLIST"
  rm -f "$PLIST"
fi

# 7.3: remove the local CA from the login keychain. Loops because an orphan
# install path (userData wiped + reinstalled) can leave two CAs with the same
# CN; `security delete-certificate` removes one at a time. Cap at 8 iterations
# to bound runtime in pathological cases. No sudo — the login keychain is
# owned by the running user.
if security find-certificate -c "$CA_COMMON_NAME" "$LOGIN_KEYCHAIN" >/dev/null 2>&1; then
  read -r -p "Remove '$CA_COMMON_NAME' from login keychain? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    for i in 1 2 3 4 5 6 7 8; do
      if ! security delete-certificate -c "$CA_COMMON_NAME" "$LOGIN_KEYCHAIN" 2>/dev/null; then
        break
      fi
      echo "  deleted match #$i"
    done
    echo "  CA removed."
  else
    echo "  Skipped — CA still trusted in login keychain. Run manually with: security delete-certificate -c \"$CA_COMMON_NAME\" \"$LOGIN_KEYCHAIN\""
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
