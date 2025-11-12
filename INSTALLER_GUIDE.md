# 🚀 GreenWaveCoin - One-Click Windows Installer

## ✅ YES! You can create a single .exe installer that users can download and install like any Windows program.

### How to Build the Installer:

1. **Stop all running processes:**
   ```powershell
   taskkill /F /IM electron.exe /T
   taskkill /F /IM node.exe /T
   ```

2. **Clean and build:**
   ```powershell
   cd desktop
   Remove-Item release -Recurse -Force -ErrorAction SilentlyContinue
   npm run package
   ```

3. **Find your installers in `desktop/release/`:**
   - `GreenWaveCoin Setup 0.1.0.exe` - **Full Windows installer** (recommended)
   - `GreenWaveCoin 0.1.0.exe` - Portable version (no install needed)

### What the Installer Does:

✅ Installs GreenWaveCoin to `C:\Program Files\GreenWaveCoin`  
✅ Creates Desktop shortcut  
✅ Creates Start Menu entry  
✅ Adds to Add/Remove Programs  
✅ Users just double-click and follow the wizard  

### Distributing to Users:

**Option 1: Direct Download**
- Upload `GreenWaveCoin Setup 0.1.0.exe` to your website
- Users download and run it
- That's it!

**Option 2: GitHub Releases**
1. Go to https://github.com/xDejaVu89/greenwavecoin/releases
2. Click "Create a new release"
3. Tag: `v0.1.0`
4. Upload `GreenWaveCoin Setup 0.1.0.exe`
5. Publish release
6. Share the release link!

### User Experience:

1. User downloads `GreenWaveCoin Setup 0.1.0.exe`
2. Double-clicks the installer
3. Clicks "Next" a few times
4. App installs and creates shortcuts
5. Click "GreenWaveCoin" from Start Menu to launch
6. Done!

### Important Notes:

⚠️ **Backend Required:** The desktop app needs the backend running. You have 2 options:

**Option A: Bundle Backend (Recommended for end users)**
- Package the backend with the installer
- App starts backend automatically
- See `BUILD_INSTRUCTIONS.md` for details

**Option B: Separate Backend (Current setup)**
- Users need Node.js installed
- Users run backend separately: `cd backend && npm run dev`
- Then launch desktop app

### File is Locked Error?

If you get "file is being used by another process":

```powershell
# Close all Node/Electron processes
Get-Process | Where-Object {$_.ProcessName -like '*node*' -or $_.ProcessName -like '*electron*'} | Stop-Process -Force

# Wait a moment
Start-Sleep -Seconds 3

# Try build again
cd desktop
npm run package
```

### Success! 🎉

Once built, you have a professional Windows installer that works just like any other program!

**No Node.js needed for users (if you bundle the backend)**  
**No command line needed for users**  
**Just download, install, and run!**
