# Set Java 17 or 21 for Android builds
# Download from: https://adoptium.net/

# For Java 17 LTS (Recommended)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot"

# OR for Java 21 LTS
# $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.1.12-hotspot"

$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "Java Home set to: $env:JAVA_HOME" -ForegroundColor Green
java -version

# Now build
Write-Host "`nBuilding APK..." -ForegroundColor Cyan
cd C:\Users\plays\Code\Web\Fexo\FexoApp\android
.\gradlew.bat assembleDebug --warning-mode all
