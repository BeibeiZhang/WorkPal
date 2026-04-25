# WorkPal Agent

Menu-bar companion app for [WorkPal](https://workpal-beibei.vercel.app). Provides the local file / git / Claude Agent SDK execution that the browser UI can't do, served over `https://127.0.0.1:3001` to the web app on `workpal-beibei.vercel.app`.

## What ships (Phase 7.1 → 7.5)

- Menu-bar icon (no dock) with template image that auto-inverts in dark mode
- Settings window: `ANTHROPIC_API_KEY`, server status, Local HTTPS install card, Update card, auto-start toggle, Restart/Quit
- Local-CA + leaf cert installed into the macOS login keychain on first launch (Touch ID, no sudo)
- HTTPS API on `127.0.0.1:3001` with the local-touching routes (`claudeChat` / `project` / `session` / `reaper`)
- Config persisted to `~/.workpal-agent/config.json` (0600 perms)
- launchd auto-start via `~/Library/LaunchAgents/com.workpal.agent.plist`
- Boot-time GitHub Releases check — Settings shows an Update card when a newer version exists
- Unsigned `.dmg` build via Electron Builder, published from a tag-driven CI workflow

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

## Releasing a new version

1. Bump `agent/package.json` `version` (e.g. `0.1.0` → `0.1.1`) and commit.
2. Tag the commit with the matching `v`-prefix and push:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
3. The CI workflow at `.github/workflows/release.yml` validates `tag === "v" + package.json.version`, builds dual-arch DMGs via `npm run dist`, and attaches them to the GitHub Release for that tag. `https://github.com/BeibeiZhang/WorkPal/releases/latest` then redirects to the new release.
4. Running agents pick up the new version on their next boot via the in-app Update card. The user clicks Download → DMG → drag to `/Applications` → right-click → Open (same flow as a fresh install — see step 3 of [Install](#install-first-time-user)).

Tag must be pure `vX.Y.Z` (no prerelease suffix). The boot-time update check only parses three-segment numeric versions; tags like `v1.0.0-beta.1` are ignored on the client side until the helper grows full-semver support.

## Known limits (to address in later phases)

- Unsigned: Gatekeeper shows the right-click → Open prompt on every first install. Apple Developer signing + notarization is deferred to v2.
- macOS only.
- Update check fires once at boot. Agents kept running for many days without restart won't see new versions until the next launch (Beibei restarts daily, so this is fine for now; periodic polling can be added without a release flow change).
