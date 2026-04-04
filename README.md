<p align="center">
  <img src="https://github.com/user-attachments/assets/50136187-bbe5-420c-aefa-797618dcd71e" width="512" height="768">
</p>

ApprenticeVR: VRSrc Edition is a modern, cross-platform desktop application built with Electron, React, and TypeScript, designed for managing and sideloading content onto Meta Quest devices. It aims to provide a user-friendly and feature-rich alternative to existing sideloading tools.

> **Fork note:** This fork contains bug fixes, performance improvements, and a major build size reduction. See [Changelog](#changelog) below.

## Downloads (v2.1.0)

| File | Platform | Size |
|------|----------|------|
| [apprenticevr-2.1.0-arm64.dmg](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-arm64.dmg) | macOS Apple Silicon (M1/M2/M3) | 123 MB |
| [apprenticevr-2.1.0-x64.dmg](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-x64.dmg) | macOS Intel | 130 MB |
| [apprenticevr-2.1.0-setup-x64.exe](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-setup-x64.exe) | Windows x64 (installer) | 88 MB |
| [apprenticevr-2.1.0-portable-x64.exe](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-portable-x64.exe) | Windows x64 (portable) | 88 MB |
| [apprenticevr-2.1.0-x86_64.AppImage](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-x86_64.AppImage) | Linux x64 (any distro) | 117 MB |
| [apprenticevr-2.1.0-arm64.AppImage](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-arm64.AppImage) | Linux arm64 (any distro) | 117 MB |
| [apprenticevr-2.1.0-amd64.deb](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-amd64.deb) | Debian/Ubuntu x64 | 92 MB |
| [apprenticevr-2.1.0-arm64.deb](https://github.com/mula-bb/apprenticeVrSrc/releases/download/v2.1.0/apprenticevr-2.1.0-arm64.deb) | Debian/Ubuntu arm64 | 87 MB |

## Server Configuration (Required on First Run)

You must provide your own `ServerInfo.json` configuration file.

On first launch, the app will show a dialog with the location of the config file. You can also create it manually:

| Platform | Config Location |
|----------|----------------|
| **Linux** | `~/.config/apprenticevr/ServerInfo.json` |
| **macOS** | `~/Library/Application Support/apprenticevr/ServerInfo.json` |
| **Windows** | `%APPDATA%\apprenticevr\ServerInfo.json` |

Create or edit the file with the following format:

```json
{"baseUri":"https://your-url-here/","password":"your-password-here"}
```

**IMPORTANT:** The `ServerInfo.json` file **must** use Linux/LF line endings (`\n`), **not** Windows/CRLF line endings (`\r\n`). This applies to **all platforms** (Windows, macOS, and Linux). Most modern text editors (VS Code, Notepad++, Sublime Text) can set line endings — make sure it is set to `LF` before saving. If the app fails to read your credentials, incorrect line endings are the most common cause.

Then restart the app. If credentials change in the future, just update this file — no rebuild needed.

## Building for Release

### Prerequisites

* [Node.js](https://nodejs.org/) (which includes npm)

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Build Commands

```bash
# Windows (NSIS installer + portable, x64 & ia32)
npm run build:win

# macOS (DMG, x64 & arm64)
npm run build:mac

# Linux (AppImage + .deb, x64 & arm64)
npm run build:linux

# All platforms at once
npm run build:all
```

**Specific architecture builds:**

```bash
# Windows
npm run build:win:x64
npm run build:win:ia32

# macOS
npm run build:mac:x64
npm run build:mac:arm64
npm run build:mac:universal

# Linux
npm run build:linux:x64
npm run build:linux:arm64
```

Build output goes to the `dist/` directory.

---

## Changelog

### 1. YouTube Trailer Embed Fix
Replaced broken `<iframe>` embeds (Error 153/152) with Electron `<webview>` tag running in an isolated process. YouTube's client-side embed detection no longer triggers because `window.top === window` inside a webview. Uses a dedicated `persist:youtube` session with spoofed headers, CSS injection to hide YouTube UI, and auto-play. Added a "Watch on YouTube" external link as a fast fallback.

### 2. Concurrent Downloads (5 Parallel Pipelines)
Replaced the serial single-download queue with a concurrent pipeline system. Up to 5 downloads run in parallel with automatic slot filling as pipelines complete.

### 3. rclone copy Download Method (No macFUSE/WinFsp Required)
Replaced `rclone mount` with `rclone copy` as the sole download method. Eliminates the macFUSE and WinFsp OS-level dependency requirements. Works out of the box on all platforms with just the bundled rclone binary. Removed ~500 lines of dead mount-based code.

### 4. Pause/Resume Download Buttons
Added Pause (⏸) and Resume (▶) buttons to the downloads sidebar. Pause kills the rclone process; resume auto-continues from partial files via `--partial-suffix .partial`.

### 5. Serialized Installation Queue
Added a promise-based mutex so only one `adb install` runs at a time, preventing ADB conflicts when multiple concurrent downloads finish simultaneously.

### 6. Renderer Performance Optimizations
- Memoized all 4 context provider `value` props to stop cascading re-renders
- Stabilized AdbProvider device tracking effect (register listeners once, not on every device selection)
- Increased download IPC debounce from 100ms to 300ms
- Stabilized GamesView column definitions via `useRef` to prevent TanStack Table recomputations
- Removed redundant resize listener (ResizeObserver already handled it)

### 7. Download Progress & Speed Display
Fixed progress stuck at 0% by adding fallback calculation from rclone's per-transfer stats. Added speed and ETA display to the download badge.

### 8. Game List Performance (2600+ Games)
- Batch filesystem I/O: single `readdirSync` + `Set` instead of 2600 individual `existsSync` calls
- O(n²) → O(n+m) enrichment via `Map` lookup
- Deferred upload candidate check
- 200ms search debounce
- Async `getNote()` to avoid blocking the main thread

### 9. Resume Pipeline Fix (Extraction Never Started)
`resumeDownload()` was fire-and-forget — the download→extract→install chain was never triggered. Created `runResumePipeline()` that properly awaits and chains all stages with `activeCount` tracking.

### 10. Download Path Doubling Fix
`startRcloneCopyDownload()` appended `releaseName` to `downloadPath` on every call, doubling the path on resume. Fixed with an idempotent `.endsWith()` check.

### 11. Resume Progress Tracking
On resume, measures already-downloaded bytes on disk as a baseline. Progress calculation accounts for baseline so it starts near the paused percentage instead of 0%.

### 12. Build Size Reduction (478MB → 110MB DMG)
Moved 5 renderer-only deps (`@fluentui/*`, `@tanstack/*`, `date-fns`) to `devDependencies` — Vite already bundles them. Removed 12 completely unused deps. Added file exclusions for non-code files. Result: 77% smaller DMG, 93% smaller asar (208MB → 15MB).

---

# Original README

## Inspiration

This project is heavily inspired by the fantastic work done on [Rookie Sideloader](https://github.com/VRPirates/rookie). ApprenticeVR: VRSrc Edition seeks to build upon that foundation by offering a contemporary interface and experience across Windows, macOS, and Linux.

## Features

*   **Cross-Platform:** Works seamlessly on Windows, macOS, and Linux.
*   **Modern User Interface:** Built with Fluent UI and React for a clean and responsive experience.
*   **Device Management:**
    *   Automatically detect and list connected Meta Quest devices.
    *   Connect to and disconnect from devices.
    *   View device details such as model, ID, battery level, and storage information.
    *   Handles unauthorized and offline device states.
*   **Game Library Management:**
    *   Browse a comprehensive list of available games and applications.
    *   View game details including thumbnails, descriptions, versions, popularity, size, and last update date.
    *   Search and filter games by name, package ID, installation status, or available updates.
*   **Installation & Sideloading:**
    *   Download game files and OBBs.
    *   Install, uninstall, and update applications on your Quest device.
    *   Reinstall existing applications.
    *   Handle updates for installed applications.
*   **Download Management:**
    *   View and manage a queue of ongoing and completed downloads.
    *   Track download progress, extraction progress, and installation status.
    *   Cancel, retry, and delete downloaded files.
*   **Automatic Dependency Handling:** Manages required tools like ADB and rclone.
*   **Light & Dark Mode:** Adapts to your system's preferred theme.

## Screenshots

Here are some glimpses of ApprenticeVR: VRSrc Edition in action:

**Device List (Dark Mode)**
![Device List - Dark Mode](screenshots/01_devices_dark.png)

**Game Library (Light Mode)**
![Game Library - Light Mode](screenshots/02_library_light.png)

**Game Details (Light Mode)**
![Game Details - Light Mode](screenshots/03_detail_light.png)

**Downloads Manager (Dark Mode)**
![Downloads Manager - Dark Mode](screenshots/04_download_dark.png)

### macOS Specifics

**Important:** Since the application is not signed by an Apple Developer ID, when you first try to open `apprenticevr.app` on macOS after building or downloading it, you might encounter an error message stating: `"ApprenticeVR: VRSrc Edition is damaged and can't be opened. You should move it to the Trash."`

This error occurs because macOS Gatekeeper flags applications downloaded from the internet or built by unidentified developers as potentially unsafe. The `com.apple.quarantine` extended attribute is added to the application bundle by the system.

To resolve this, you can remove this extended attribute by running the following command in your Terminal:

```bash
xattr -c /Applications/apprenticevr.app
```

**Note:**
*   You might need to adjust the path `/Applications/apprenticevr.app` if you have placed the application in a different location.
*   The `-c` flag in the `xattr` command stands for "clear," and it removes all extended attributes from the specified file or application bundle. By removing the quarantine attribute, you are essentially telling macOS that you trust this application.

After running this command, you should be able to open ApprenticeVR: VRSrc Edition without any issues.

## Logs

By default, it writes logs to the following locations:

 - **on Linux:** `~/.config/apprenticevr/logs/main.log`
 - **on macOS:** `~/Library/Logs/apprenticevr/main.log`
 - **on Windows:** `%USERPROFILE%\AppData\Roaming\apprenticevr\logs\main.log`

**Note:** When opening an issue, please include the latest log output from the appropriate log file above to help with debugging and troubleshooting.

You can also upload the current log file in the settings menu and share the url.

# Troubleshooting Guide

If ApprenticeVR: VRSrc Edition is unable to connect, follow the steps below to identify and resolve the issue:

---

## ✅ Use the Latest Version

Make sure you're using the latest version of ApprenticeVR: VRSrc Edition:  
➡️ [https://github.com/jimzrt/apprenticevr](https://github.com/jimzrt/apprenticevr)

---

## 🌐 Check Network Access

Ensure you can access the following URLs from your browser:

- [https://raw.githubusercontent.com/](https://raw.githubusercontent.com/)  
  (Should redirect to the GitHub homepage)

- [https://downloads.rclone.org/](https://downloads.rclone.org/)

---

## 🌍 Change DNS Settings

Some ISPs block specific domains. Switch to a public, non-censoring DNS provider:

- [Cloudflare DNS (1.1.1.1)](https://developers.cloudflare.com/1.1.1.1/setup/windows/)
- [Google Public DNS (8.8.8.8)](https://developers.google.com/speed/public-dns/docs/using)
- [OpenDNS](https://www.opendns.com/setupguide/)

---

## 🔐 Try a VPN

If DNS changes don't help, your ISP might be blocking access. Use a VPN to bypass restrictions:

- [ProtonVPN (free)](https://protonvpn.com/)
- [1.1.1.1 VPN (free)](https://one.one.one.one/)
- [Alternate VPN Example](https://gprivate.com/5yxo8)

---

## 🛡️ Router or Firewall Blocking?

If a VPN works, but a direct connection doesn't, your router or antivirus/firewall may be blocking access.  
Check out this guide for help:

➡️ [https://rentry.co/ASUSRouterBlock](https://rentry.co/ASUSRouterBlock)

You can either:

- Continue using a VPN  
- OR identify and whitelist the following domains in your router/firewall settings:
  - `raw.githubusercontent.com`
  - `downloads.rclone.org`

---

If you're still stuck, feel free to open an issue or ask for help in the community. Happy VR-ing!


## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Prerequisites

*   [Node.js](https://nodejs.org/) (which includes npm)
*   [pnpm](https://pnpm.io/installation) (Recommended package manager)

### Install Dependencies

```bash
pnpm install
```

## Development

To run the application in development mode with hot-reloading:

```bash
pnpm dev
```

This will start the Electron application and open a development server for the React frontend.

## Building the Application

You can build the application for different platforms using the following commands:

```bash
# For Windows
pnpm build:win

# For macOS
pnpm build:mac

# For Linux
pnpm build:linux
```

Builds will be located in the `dist` or a platform-specific output directory.

## Linting and Formatting

To lint the codebase:
```bash
pnpm lint
```

To format the codebase with Prettier:
```bash
pnpm format
```

To perform type checking:
```bash
pnpm typecheck
```


---
![](https://badges.pufler.dev/visits/jimzrt/apprenticeVr)
