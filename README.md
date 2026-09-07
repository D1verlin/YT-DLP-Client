<div align="center">

<img src="YT-DLPClient.svg" alt="YT-DLP Client Logo" width="128" height="128" />

# YT-DLP Client

**A modern, high-performance desktop GUI client for yt-dlp with an airy, minimalist interface.**

[![Release](https://img.shields.io/badge/Release-v1.0.0-white?style=flat-square)](https://github.com/D1verlin/YT-DLP-Client/releases)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-white?style=flat-square)]()
[![Electron](https://img.shields.io/badge/Electron-30.5-white?style=flat-square)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-white?style=flat-square)](https://reactjs.org/)

[Features](#-key-features) • [Downloads](#-downloads) • [Installation](#-quick-start) • [Building](#-build-from-source) • [Releases](#-github-releases--cicd)

</div>

---

## ✨ Key Features

- 🎬 **Ultra HD Video**: Up to 4K / 8K with 60 FPS, HDR, and high-bitrate video streams.
- 🎵 **High-Quality Audio Extraction**: Lossless & high-bitrate conversion to MP3, M4A, FLAC, Opus, and WAV.
- 📑 **Smart Playlist Downloader**: Visual tracklist preview, individual track multi-selection, and unified batch downloading.
- 🌌 **Airy Minimalist Aesthetic**: Frameless dark canvas (`#121212`), pure typography, fluid audio waveforms, and zero clutter.
- 🌍 **Bilingual Interface**: Seamless switching between **English (EN)** and **Russian (RU)** with zero reloads.
- ⚡ **Automated Engine Setup**: Integrated first-launch wizard that automatically detects or downloads the latest `yt-dlp` and `FFmpeg` binaries.
- 🍪 **Browser Cookie Extraction**: Download age-restricted, subscriber-only, or private media by extracting cookies from Chrome, Edge, Firefox, Brave, Opera, and Vivaldi.
- 🎛️ **Advanced Queue & Networking**: Simultaneous downloads, speed limits, proxy routing (HTTP/SOCKS5), custom User-Agents, and metadata tagging.

---

## 📦 Downloads

Pre-built binaries for **Windows** and **Linux** are available on the [**GitHub Releases**](https://github.com/D1verlin/YT-DLP-Client/releases) page:

| Platform | Type | File Name | Description |
| :--- | :--- | :--- | :--- |
| **Windows** | Installer | `YT-DLP-Client-v1.0.0-Setup-x64.exe` | Standard NSIS installer with desktop shortcuts |
| **Windows** | Portable | `YT-DLP-Client-v1.0.0-Portable-x64.exe` | Standalone executable, no installation required |
| **Linux** | AppImage | `YT-DLP-Client-v1.0.0-x64.AppImage` | Universal Linux package (run directly) |
| **Linux** | Debian / Ubuntu | `YT-DLP-Client-v1.0.0-x64.deb` | Native `.deb` package |

---

## 🚀 Quick Start (Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0 or newer)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Running Locally

```bash
# 1. Clone repository
git clone https://github.com/D1verlin/YT-DLP-Client.git
cd REPO

# 2. Install dependencies
npm install

# 3. Start in development mode
npm run dev
```

---

## 🛠️ Build from Source

You can build production binaries locally with a single command:

```bash
# Build for Windows (Installer + Portable)
npm run dist:win

# Build for Linux (AppImage + DEB)
npm run dist:linux

# Build for all platforms
npm run dist:all
```

Compiled packages will be generated in the `dist/` directory.

---

## 🚢 GitHub Releases & CI/CD

To publish a new release directly to your GitHub repository:

### 1. Single-Command Local Publish
```bash
# Set your GitHub personal access token (with 'repo' scope)
$env:GH_TOKEN="your_personal_access_token"

# Build and publish to GitHub Releases
npm run release
```

### 2. Automated via GitHub Actions
Push a version tag to trigger the automatic multi-platform build workflow:
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub Actions will automatically build Windows and Linux binaries in parallel and create the GitHub Release.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
