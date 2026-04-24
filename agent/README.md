# WorkPal Agent

Menu-bar companion app for [WorkPal](https://workpal-beibei.vercel.app). Phase 7.1 is an empty shell — no HTTPS, no `/api/*`, no auto-update yet (those land in 7.2–7.5).

## What 7.1 ships

- Menu-bar icon (no dock) with template image that auto-inverts in dark mode
- Settings window: `ANTHROPIC_API_KEY` input, agent status, auto-start toggle, recent log, Restart/Quit buttons
- Config persisted to `~/.workpal-agent/config.json` (0600 perms)
- launchd auto-start via `~/Library/LaunchAgents/com.workpal.agent.plist`
- Unsigned `.dmg` build via Electron Builder

## Install (first-time user)

1. Download `WorkPal Agent-<version>.dmg` from GitHub Releases.
2. Open the DMG, drag **WorkPal Agent** to `/Applications`.
3. First launch: **right-click the app → Open** (required to bypass Gatekeeper for unsigned apps). After that, normal double-click works. If you just double-click the first time, macOS will block it; the right-click → Open path is the only option for v0.1 until we sign in a later phase.
4. The agent appears as a small chat-bubble icon in the menu bar. Click it to open Settings and paste your `ANTHROPIC_API_KEY`.

The app will register itself to auto-start at next login. Toggle **Auto-start at login** off in Settings to disable.

## Uninstall

```bash
# Kill running agent + remove auto-start
launchctl bootout gui/$(id -u)/com.workpal.agent 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.workpal.agent.plist

# Remove config + logs (optional — keep if you'll reinstall and want to preserve the API key)
rm -rf ~/.workpal-agent

# Remove the app bundle
rm -rf "/Applications/WorkPal Agent.app"
```

Or run `agent/scripts/uninstall.sh` from a checkout of the repo.

## Development

```bash
cd agent
npm install
npm run dev          # compile TS + launch Electron
npm run pack         # build unpacked .app for smoke-testing
npm run dist         # build the .dmg into dist/
npm run build:icons  # regenerate both icon sets: tray template PNGs + app .icns
```

To update the branded Finder / Dock icon, replace `agent/build/AppIcon.svg` with a new square SVG and rerun `npm run build:icons`. The script rasterizes 7 sizes via `sips`, arranges them into the `.iconset` layout macOS requires, and packs them with `iconutil`.

Dev mode skips launchd registration (we don't want every `npm run dev` to rewrite the user's LaunchAgents). Packaged builds handle it on first launch.

## Repo layout

```
agent/
├── package.json
├── electron-builder.yml
├── tsconfig.main.json          # main-process TS → dist-main/
├── tsconfig.renderer.json      # renderer TS → dist-renderer/
├── src/
│   ├── main/
│   │   ├── main.ts             # entry: tray, window mgmt, single-instance, quit
│   │   ├── config.ts           # ~/.workpal-agent/config.json read/write
│   │   ├── launchd.ts          # plist render + bootstrap/bootout + path self-heal
│   │   ├── logger.ts           # ring buffer + file tail
│   │   ├── ipc.ts              # ipcMain handlers for renderer
│   │   └── preload.ts          # contextBridge
│   └── renderer/
│       ├── index.html
│       ├── styles.css          # vanilla CSS, WorkPal design tokens
│       └── renderer.ts         # form wiring + status polling
├── assets/
│   ├── menuIconTemplate.png    # 16×16 black-alpha chat bubble
│   └── menuIconTemplate@2x.png # 32×32 Retina version
├── build/
│   ├── AppIcon.svg             # brand logo source (edit to rebrand)
│   └── icon.icns               # generated: packed iconset for app bundle
└── scripts/
    ├── build-icons.py          # regenerates tray PNGs from parametric shape
    ├── build-app-icon.sh       # rasterizes AppIcon.svg → .icns
    ├── build-icons.sh          # chains both icon builds
    └── uninstall.sh
```

## Design decisions

Full context lives in [`docs/phase-7-requirements.md`](../docs/phase-7-requirements.md). Highlights for 7.1:

- **Electron, not Tauri** — Tauri would cut ~60 MB off the DMG but we need the bundled Node runtime for Claude Agent SDK in 7.2.
- **Vanilla CSS, not React** — 1 input + 1 toggle + 2 buttons doesn't justify a bundler. We'll migrate to React (+ a bundler) if Settings ever grows to need shared component state.
- **Template image, not gradient logo** — macOS menu-bar icons must be pure-black-with-alpha to auto-invert in dark mode. The colored WorkPal W only appears in the Dock / Finder / Applications via `build/icon.icns` (packed from `build/AppIcon.svg`).
- **`process.execPath` self-heal** — on each boot, we compare the current exec path against what the plist has; mismatch → silent rewrite + rebootstrap. Covers the "user dragged app from Downloads to Applications after first launch" case.
- **Menu-bar only** — `LSUIElement=true` in Info.plist hides dock from the start (no flash); `app.dock.hide()` as dev-mode backstop.

## Known limits (to address in later steps)

- Unsigned: Gatekeeper shows the right-click-Open prompt every first install. 7.5 may add Apple Developer signing.
- No auto-update (7.5).
- No HTTPS / `/api/*` yet (7.2 + 7.3).
- Logs only show agent process events, not API traffic (nothing yet to log).
