<p align="center">
  <img src="https://github.com/user-attachments/assets/50136187-bbe5-420c-aefa-797618dcd71e" width="512" height="768">
</p>

**ApprenticeVR: VRSrc Edition** is a modern, cross-platform desktop app built with Electron, React, and TypeScript for managing and sideloading content onto Meta Quest devices. It connects to a community game library, handles downloads and installs automatically, and lets you contribute games back to the library.

> **Fork note:** This fork contains bug fixes, performance improvements, and new features. See [What's New](#whats-new-in-vrsrc-edition) below.

---

## Step 1: Download the Right File for Your OS

| File | Platform | Notes |
|------|----------|-------|
| `apprenticevr-x.x.x-arm64.dmg` | **macOS — Apple Silicon** (M1 through M5) | Use this if your Mac has an M-series chip |
| `apprenticevr-x.x.x-x64.dmg` | **macOS — Intel** (macOS 11+) | Use this for Intel Macs running Big Sur or newer |
| `apprenticevr-macOS10.15-x64.dmg` | **macOS — Intel** (macOS 10.15 Catalina) | Use this only if the standard Intel DMG won't open |
| `apprenticevr-x.x.x-setup-x64.exe` | **Windows — Installer** | Recommended for most Windows users; installs to Program Files with an uninstaller |
| `apprenticevr-x.x.x-portable-x64.exe` | **Windows — Portable** | No install needed; run from any folder or USB drive. Use this if you don't have admin rights |
| `apprenticevr-x.x.x-x86_64.AppImage` | **Linux — x64** | Works on any 64-bit distro (Ubuntu, Fedora, Arch, etc.); make executable and run |
| `apprenticevr-x.x.x-arm64.AppImage` | **Linux — ARM64** | For ARM-based Linux boards/devices (e.g. Raspberry Pi 5) |
| `apprenticevr-x.x.x-amd64.deb` | **Debian/Ubuntu — x64** | Installs via `dpkg -i` or double-click; integrates with your package manager |
| `apprenticevr-x.x.x-arm64.deb` | **Debian/Ubuntu — ARM64** | Same as above but for ARM64 Debian/Ubuntu systems |

> Downloads are on the [Releases page](../../releases/latest). Always grab the latest release.

### macOS: "App is damaged" error

Because the app is not signed with an Apple Developer certificate, macOS Gatekeeper will block it. Run this once after installation:

```bash
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Linux AppImage

```bash
chmod +x apprenticevr-x.x.x-x86_64.AppImage
./apprenticevr-x.x.x-x86_64.AppImage
```

---

## Step 2: Get Your Server Credentials

ApprenticeVR connects to community-run VR game servers. Access requires a **Base URL** and a **Password**. Here's where to find them:

- **Telegram (fastest):** Join [t.me/the_vrSrc](https://t.me/the_vrSrc) — pinned messages contain the current credentials. No Telegram account? Use the web preview at [t.me/s/the_vrSrc](https://t.me/s/the_vrSrc).
- **r/QuestPiracy Megathread:** The Public Server JSON page at [qpmegathread.top/pages/public-json.html](https://qpmegathread.top/pages/public-json.html) lists available public servers with their credentials.

Credentials look like this:
- `baseUri` — a URL ending in `/`, for example: `https://community-server.example.com/`
- `password` — a base64-encoded string used to decrypt the game metadata archive

Keep these private. Do not share them publicly.

---

## Step 3: Enter Your Credentials in the App

On first launch the app will show a prompt if no credentials are found. You have two ways to enter them:

### Option A: In-app (Recommended)

1. Open ApprenticeVR and go to the **Settings** tab (or the Mirror Management section)
2. Click **Set Public Server JSON**
3. Paste the full JSON blob into the text area and click **Apply JSON to fields**, or type the Base URI and Password directly
4. Click **Save** — no restart needed

### Option B: ServerInfo.json file

Create the file at the location for your platform:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\apprenticevr\ServerInfo.json` |
| macOS | `~/Library/Application Support/apprenticevr/ServerInfo.json` |
| Linux | `~/.config/apprenticevr/ServerInfo.json` |

File contents:

```json
{"baseUri":"https://your-url-here/","password":"your-password-here"}
```

> **Important:** The file must use **LF line endings** (`\n`), not Windows CRLF (`\r\n`). This applies on all platforms. In VS Code, check the bottom-right status bar and set it to LF. If the app can't read your credentials, wrong line endings are the most likely cause.

Restart the app after creating or editing this file.

---

## Step 4: Connect Your Quest and Start Sideloading

1. Plug your Quest into your PC/Mac/Linux machine with a USB cable
2. Put on the headset and **Allow USB Debugging** when prompted
3. ApprenticeVR will detect your device in the **Devices** tab
4. Browse the **Games** library, click a title, and hit **Download**

The app handles downloading, extracting, and installing automatically. Up to 5 games download in parallel.

---

## What's New in VRSrc Edition

### 1. YouTube Trailer Embed Fix
Replaced broken `<iframe>` embeds (Error 153/152) with an Electron `<webview>` running in an isolated process. YouTube's embed detection no longer triggers. Uses a dedicated `persist:youtube` session with CSS injection and auto-play. Includes a "Watch on YouTube" fallback link.

### 2. Concurrent Downloads (5 Parallel Pipelines)
Replaced the old single-download queue with a concurrent pipeline system. Up to 5 downloads run in parallel, with automatic slot filling as pipelines complete.

### 3. rclone copy — No macFUSE or WinFsp Required
Replaced `rclone mount` with `rclone copy` as the download method. Eliminates the macFUSE (macOS) and WinFsp (Windows) kernel-driver dependencies. Works out of the box on all platforms with the bundled rclone binary. ~500 lines of dead mount code removed.

### 4. Pause and Resume Downloads
Added Pause (⏸) and Resume (▶) buttons in the downloads panel. Pause kills the rclone process; resume continues from partial files via `--partial-suffix .partial`.

### 5. Serialized Installation Queue
A promise-based mutex ensures only one `adb install` runs at a time, preventing ADB conflicts when multiple concurrent downloads finish at the same moment.

### 6. Renderer Performance Optimizations
- Memoized all 4 context provider `value` props to stop cascading re-renders
- Stabilized the ADB device tracking effect (registers listeners once, not on every device selection)
- Increased download IPC debounce from 100ms to 300ms
- Stabilized GamesView column definitions via `useRef` to prevent TanStack Table recomputations
- Removed a redundant resize listener (ResizeObserver already handled it)

### 7. Download Progress and Speed Display
Fixed progress stuck at 0% by adding fallback calculation from rclone's per-transfer stats. Added real-time speed and ETA display to the download badge.

### 8. Game List Performance (2600+ Games)
- Batch filesystem I/O: single `readdirSync` + `Set` lookup instead of 2600 individual `existsSync` calls
- O(n²) → O(n+m) enrichment via `Map` lookup
- Deferred upload candidate checks
- 200ms search debounce
- Async `getNote()` to avoid blocking the main thread

### 9. Resume Pipeline Fix
`resumeDownload()` was fire-and-forget — the download → extract → install chain was never triggered on resume. A new `runResumePipeline()` properly awaits and chains all stages with `activeCount` tracking.

### 10. Download Path Doubling Fix
`startRcloneCopyDownload()` was appending `releaseName` to `downloadPath` on every call, doubling the path on resume. Fixed with an idempotent `.endsWith()` check.

### 11. Resume Progress Tracking
On resume, the already-downloaded bytes on disk are measured as a baseline. Progress starts near the paused percentage instead of resetting to 0%.

### 12. Build Size Reduction (478MB → 110MB)
Moved 5 renderer-only packages (`@fluentui/*`, `@tanstack/*`, `date-fns`) to `devDependencies` — Vite bundles them at build time anyway. Removed 12 unused dependencies. Added file exclusions. Result: 77% smaller DMG, 93% smaller asar (208MB → 15MB).

### 13. Game List File Resolution by Suffix Match
Replaced the hardcoded `VRP-GameList.txt` path with dynamic suffix-match resolution (`*amelist.txt`). The server naming convention changed; `loadGameList()` now scans the data directory and matches any file ending in `amelist.txt`.

### 14. Mirror Management UI Redesign
Reorganized the server configuration page to make the two download methods distinct and clear:
- **"Set Public Server JSON"** (previously "Server Config") opens a dialog to enter your `baseUri` and `password`. Supports paste-to-parse for the full JSON blob.
- **"Set Rclone Config"** is a collapsible toggle that reveals the rclone mirror controls — Test All, Import from File, and Add Mirror — only when expanded. These were previously scattered alongside the Server Config button regardless of which method you use.
- The status card below the buttons now shows which method is currently active: **Public Server JSON**, **Rclone Config (mirror name)**, or a prompt to configure one if neither is set.

---

## Uploading Games (Contributing to the Library)

ApprenticeVR can pull apps from your Quest and upload them to the community library. This uses the same pipeline as Rookie Sideloader.

### How the Upload Works

When you click **Upload** on an installed game:

1. **Setup** — Creates a staging folder and generates a device hardware ID (SHA-256 of the device serial)
2. **Pull APK** — Runs `adb shell pm path <package>` to locate the APK, then `adb pull` to copy it
3. **Analyze OBB** — Checks `/sdcard/Android/obb/<package>` on the headset for expansion files
4. **Pull OBB** — If an OBB folder exists, pulls every file with its directory structure intact
5. **Create metadata** — Writes `HWID.txt` so the library can track the source device
6. **Compress** — Packages everything into a `.zip` archive using the bundled 7-Zip
7. **Upload** — Uses rclone with an automatically fetched upload config to send the archive to the community server
8. **Blacklist** — Once uploaded, the package+version is added to your local blacklist so you're not prompted to upload the same version again

The upload config is fetched automatically from the VRP community endpoint on app start. No manual configuration required.

### Scanning Your Headset for Unreleased or Newer Versions

> **Planned feature** based on the scan engine from Rookie Sideloader.

ApprenticeVR can compare everything installed on your Quest against the community game list and flag:

- Apps where your **installed version code is higher** than the version on the game list (you have a newer build)
- Apps that **don't appear in the game list at all** (unreleased or sideloaded-only titles)

**How it works (from the Rookie Sideloader reference implementation):**

1. ADB lists all installed packages on the connected headset with their version codes (`adb shell pm list packages -3 --show-versioncode`)
2. The game list loaded from `meta.7z` is indexed by package name
3. For each installed package, the app checks:
   - Is the package in the game list? If not → candidate for upload
   - Is the installed version code greater than the game list version? If yes → newer build, candidate for upload
4. Candidates are shown in a dialog asking whether to zip and upload the APK and OBB to the community server
5. Confirmed items are added to the upload queue, which handles the rest automatically (pull → compress → upload)

The scan skips apps already in your local blacklist (previously uploaded versions) and system/Oculus packages.

This feature feeds directly into the existing upload pipeline described above — no extra configuration needed.

---

## Logs

Logs are written to:

| Platform | Location |
|----------|----------|
| Windows | `%USERPROFILE%\AppData\Roaming\apprenticevr\logs\main.log` |
| macOS | `~/Library/Logs/apprenticevr/main.log` |
| Linux | `~/.config/apprenticevr/logs/main.log` |

Include the log file when opening a bug report.

---

## Troubleshooting

### Can't connect / game list won't load

1. Verify your `baseUri` ends with a `/` and the password is copied exactly as given
2. Check that `ServerInfo.json` uses LF line endings, not CRLF
3. Make sure you can reach `https://downloads.rclone.org/` from your browser (rclone downloads on first run)
4. Try a different DNS server — some ISPs block community domains:
   - [Cloudflare 1.1.1.1](https://developers.cloudflare.com/1.1.1.1/setup/windows/)
   - [Google 8.8.8.8](https://developers.google.com/speed/public-dns/docs/using)
5. If DNS changes don't help, try a VPN such as [ProtonVPN (free)](https://protonvpn.com/)

### Quest not detected

1. Use a USB data cable (not a charge-only cable)
2. Put on the headset and tap **Allow** on the USB Debugging prompt
3. Check that ADB is not blocked by antivirus software
4. Try a different USB port or cable

### macOS: "App is damaged"

```bash
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Linux: AppImage won't open

```bash
chmod +x apprenticevr-*.AppImage && ./apprenticevr-*.AppImage
```

---

## Screenshots

**Device List (Dark Mode)**
![Device List - Dark Mode](screenshots/01_devices_dark.png)

**Game Library (Light Mode)**
![Game Library - Light Mode](screenshots/02_library_light.png)

**Game Details (Light Mode)**
![Game Details - Light Mode](screenshots/03_detail_light.png)

**Downloads Manager (Dark Mode)**
![Downloads Manager - Dark Mode](screenshots/04_download_dark.png)

---

## Inspiration

This project is heavily inspired by [Rookie Sideloader](https://github.com/VRPirates/rookie). ApprenticeVR: VRSrc Edition builds on that foundation with a modern cross-platform interface and the upload pipeline ported from Rookie's C# implementation.

## License

GNU Affero General Public License v3 — see [LICENSE](LICENSE)

---

![](https://badges.pufler.dev/visits/jimzrt/apprenticeVr)
