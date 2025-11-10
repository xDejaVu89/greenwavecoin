# Build script for complete GreenWaveCoin desktop application

Write-Host "Building GreenWaveCoin Desktop..." -ForegroundColor Green

# Build Rust compute worker
Write-Host "`n[1/3] Building Rust compute worker..." -ForegroundColor Cyan
Set-Location "..\compute-worker"
if (Test-Path "Cargo.toml") {
    cargo build --release
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Worker build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Worker built successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: compute-worker not found, skipping..." -ForegroundColor Yellow
}

# Build Electron main & preload
Write-Host "`n[2/3] Building Electron main process..." -ForegroundColor Cyan
Set-Location "..\desktop"
npm run build:electron
if ($LASTEXITCODE -ne 0) {
    Write-Host "Electron build failed!" -ForegroundColor Red
    exit 1
}

# Build renderer (React + Vite)
Write-Host "`n[3/3] Building renderer..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Renderer build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Build complete! Run 'npm start' to launch." -ForegroundColor Green
