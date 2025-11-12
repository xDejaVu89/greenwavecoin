# Quick Build Guide

## To create a downloadable Windows installer:

1. **Stop all running processes**:
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like '*node*'} | Stop-Process -Force
   ```

2. **Build the app**:
   ```powershell
   cd desktop
   npm run package
   ```

3. **Find your installer**:
   - Installer: `desktop/release/GreenWaveCoin Setup 0.1.0.exe` (full installer)
   - Portable: `desktop/release/GreenWaveCoin 0.1.0.exe` (no install needed)

## What users need:

### Option A: All-in-One (Recommended)
Bundle backend with the app so users just install and run.

### Option B: Separate Backend
Users need to:
1. Install Node.js
2. Download backend folder
3. Run `npm install` and `npm start` in backend folder
4. Then run your desktop app

## To distribute:

1. **Upload to your website** - Users download .exe directly
2. **GitHub Releases** - Create release, attach .exe files
3. **Google Drive / Dropbox** - Share download link

## Note on icons:
The app currently uses a placeholder icon. To add a real icon:
1. Create 256x256 PNG logo
2. Convert to .ico at https://icoconvert.com/
3. Save as `desktop/assets/icon.ico`
4. Rebuild with `npm run package`

## For auto-updates:
See `BUILD_INSTRUCTIONS.md` for advanced setup with GitHub releases.
