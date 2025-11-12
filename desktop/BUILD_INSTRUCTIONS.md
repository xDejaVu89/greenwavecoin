# GreenWaveCoin Desktop - Build & Distribution Guide

## 📦 Building the App

### Prerequisites
- Node.js 18+ installed
- npm installed
- Backend running on `localhost:3000`

### Build Commands

#### 1. Build for Windows
```bash
cd desktop
npm run package
```

This creates:
- **Windows Installer (NSIS)**: `release/GreenWaveCoin Setup 0.1.0.exe` - Full installer with start menu shortcuts
- **Portable .exe**: `release/GreenWaveCoin 0.1.0.exe` - Single executable, no installation needed

#### 2. Build for macOS
```bash
cd desktop
npm run package
```
Creates: `release/GreenWaveCoin-0.1.0.dmg`

#### 3. Build for Linux
```bash
cd desktop
npm run package
```
Creates:
- `release/GreenWaveCoin-0.1.0.AppImage` - Universal Linux app
- `release/greenwavecoin-desktop_0.1.0_amd64.deb` - Debian/Ubuntu package

## 🎨 Adding Custom Icons

### Windows (.ico)
1. Create a 256x256 PNG image of your logo
2. Convert to .ico using [icoconvert.com](https://icoconvert.com/)
3. Save as `desktop/assets/icon.ico`

### macOS (.icns)
1. Create 1024x1024 PNG
2. Use [cloudconvert.com](https://cloudconvert.com/png-to-icns) to convert
3. Save as `desktop/assets/icon.icns`

### Linux (.png)
1. Save 512x512 PNG as `desktop/assets/icon.png`

## 📤 Distribution Options

### Option 1: Direct Download
1. Upload built installers to your website
2. Users download and install directly

### Option 2: GitHub Releases
1. Create GitHub release
2. Upload installers as release assets
3. Users download from GitHub Releases page

### Option 3: Auto-Updates (Advanced)
Add to `package.json`:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "greenwavecoin"
    }
  }
}
```

Then run:
```bash
npm run package -- --publish always
```

### Option 4: Microsoft Store / Mac App Store
Requires developer accounts and code signing certificates.

## 🔐 Code Signing (Optional but Recommended)

### Windows
1. Get code signing certificate from providers like Sectigo, DigiCert
2. Add to `package.json`:
```json
{
  "win": {
    "certificateFile": "path/to/cert.pfx",
    "certificatePassword": "password"
  }
}
```

### macOS
1. Join Apple Developer Program ($99/year)
2. Get Developer ID certificate
3. Configure in electron-builder

## 🚀 Quick Start for Users

### Windows
1. Download `GreenWaveCoin Setup 0.1.0.exe`
2. Run installer
3. App appears in Start Menu

### macOS
1. Download `GreenWaveCoin-0.1.0.dmg`
2. Open DMG
3. Drag to Applications folder

### Linux
1. Download `GreenWaveCoin-0.1.0.AppImage`
2. Make executable: `chmod +x GreenWaveCoin-0.1.0.AppImage`
3. Run: `./GreenWaveCoin-0.1.0.AppImage`

## 📝 Release Checklist

- [ ] Update version in `package.json`
- [ ] Test app in dev mode: `npm run dev`
- [ ] Build app: `npm run package`
- [ ] Test built installer
- [ ] Create GitHub release with changelog
- [ ] Upload installers
- [ ] Update download links on website
- [ ] Announce release on social media

## 🔧 Troubleshooting

### Build fails
- Ensure all dependencies installed: `npm install`
- Delete `node_modules` and reinstall
- Check Node.js version: `node -v` (should be 18+)

### App won't start
- Backend must be running on `localhost:3000`
- Check firewall settings
- Check antivirus (may flag unsigned apps)

### Icon not showing
- Ensure icon files exist in `assets/` folder
- Icons must be exact format (.ico for Windows, .icns for macOS, .png for Linux)
- Rebuild app after adding icons

## 📊 Build Output Sizes
- Windows NSIS Installer: ~150MB
- Windows Portable: ~150MB
- macOS DMG: ~160MB
- Linux AppImage: ~150MB

## 🌐 Backend Requirements
Users need:
1. Backend running locally OR
2. Connect to hosted backend by changing `BACKEND_URL` in app settings

For production, consider:
- Hosting backend on cloud (AWS, DigitalOcean, Heroku)
- Distributing backend installer with desktop app
- Using electron-builder to bundle backend in app
