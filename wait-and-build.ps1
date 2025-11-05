# Wait for Android Studio to finish SDK setup and build APK

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Waiting for Android SDK Setup     " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Android Studio is installing SDK components..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes on first setup." -ForegroundColor Yellow
Write-Host ""

$sdkPath = "C:\Users\plays\AppData\Local\Android\Sdk"
$adbPath = Join-Path $sdkPath "platform-tools\adb.exe"
$maxWait = 600 # 10 minutes
$waited = 0

while (-not (Test-Path $adbPath) -and $waited -lt $maxWait) {
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $waited += 5
}

Write-Host ""
Write-Host ""

if (Test-Path $adbPath) {
    Write-Host "✓ Android SDK is ready!" -ForegroundColor Green
    Write-Host ""
    
    # Show SDK location
    Write-Host "SDK Location: $sdkPath" -ForegroundColor Cyan
    
    # Show ADB version
    Write-Host "ADB Version:" -ForegroundColor Cyan
    & $adbPath version
    Write-Host ""
    
    # Now build the APK
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "  Building APK...                   " -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    
    cd C:\Users\plays\Code\Web\Fexo\FexoApp\android
    .\gradlew.bat assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "  BUILD SUCCESSFUL!                  " -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $fileSize = (Get-Item $apkPath).Length / 1MB
            Write-Host "APK Location: $(Get-Location)\$apkPath" -ForegroundColor Cyan
            Write-Host "APK Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "You can now install this APK on your Android device!" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "Build failed. Check errors above." -ForegroundColor Red
    }
    
} else {
    Write-Host "✗ Timeout waiting for Android SDK" -ForegroundColor Red
    Write-Host "Please complete Android Studio setup and run this script again" -ForegroundColor Yellow
}
