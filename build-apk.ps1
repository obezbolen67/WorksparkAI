# Fexo Android APK Build Script
# This script builds a production-ready release APK

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Fexo Android APK Build Script     " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[Prerequisites Check]" -ForegroundColor Yellow
Write-Host ""

# Check if local.properties exists
if (-not (Test-Path "android\local.properties")) {
    Write-Host "✗ Android SDK not configured!" -ForegroundColor Red
    Write-Host "  Please install Android SDK and configure android\local.properties" -ForegroundColor Yellow
    Write-Host "  See SETUP_ANDROID_SDK.txt for instructions" -ForegroundColor Yellow
    exit 1
}

# Check if Android SDK exists
$localProps = Get-Content "android\local.properties" | Where-Object { $_ -match "sdk.dir" }
if ($localProps) {
    $sdkPath = ($localProps -split "=")[1].Trim().Replace("\\", "\")
    if (Test-Path $sdkPath) {
        Write-Host "  ✓ Android SDK found at: $sdkPath" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Android SDK not found at: $sdkPath" -ForegroundColor Red
        Write-Host "  Please install Android SDK - see SETUP_ANDROID_SDK.txt" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "  ✓ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Step 1: Clean previous builds
Write-Host "[1/6] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build"
}
Write-Host "  ✓ Clean complete" -ForegroundColor Green
Write-Host ""

# Step 2: Build React app with production env
Write-Host "[2/6] Building React application for production..." -ForegroundColor Yellow
npm run build:prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ React build complete (production mode)" -ForegroundColor Green
Write-Host ""

# Step 3: Sync to Capacitor
Write-Host "[3/6] Syncing to Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Sync failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Capacitor sync complete" -ForegroundColor Green
Write-Host ""

# Step 4: Check for signing configuration
Write-Host "[4/6] Checking signing configuration..." -ForegroundColor Yellow
if (Test-Path "android\key.properties") {
    Write-Host "  ✓ Signing configuration found" -ForegroundColor Green
    $buildType = "release"
} else {
    Write-Host "  ! No signing configuration found" -ForegroundColor Yellow
    Write-Host "  Building unsigned debug APK..." -ForegroundColor Yellow
    $buildType = "debug"
}
Write-Host ""

# Step 5: Build APK
Write-Host "[5/6] Building Android APK..." -ForegroundColor Yellow
Set-Location android
if ($buildType -eq "release") {
    .\gradlew assembleRelease --warning-mode all
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
    $outputName = "fexo-release.apk"
} else {
    .\gradlew assembleDebug --warning-mode all
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    $outputName = "fexo-debug.apk"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ APK build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "  ✓ APK build complete" -ForegroundColor Green
Write-Host ""

# Step 6: Copy APK to root
Write-Host "[6/6] Copying APK..." -ForegroundColor Yellow
if (Test-Path "android\$apkPath") {
    Copy-Item "android\$apkPath" ".\$outputName" -Force
    $fileSize = (Get-Item ".\$outputName").Length / 1MB
    Write-Host "  ✓ APK copied to: $outputName" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "  ✗ APK not found!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Success summary
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!                  " -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "APK Location: $(Get-Location)\$outputName" -ForegroundColor Cyan
Write-Host "Build Type: $buildType" -ForegroundColor Cyan
Write-Host ""

if ($buildType -eq "debug") {
    Write-Host "Note: This is a DEBUG build. For production:" -ForegroundColor Yellow
    Write-Host "  1. Create a keystore (see BUILD_INSTRUCTIONS.txt)" -ForegroundColor Yellow
    Write-Host "  2. Configure android\key.properties" -ForegroundColor Yellow
    Write-Host "  3. Run this script again" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "You can now install this APK on your Android device!" -ForegroundColor Green
