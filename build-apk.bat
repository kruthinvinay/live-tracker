@echo off
echo ========================================
echo SpyGlass APK Builder
echo ========================================
echo.

REM Check if Android folder exists
if not exist "android" (
    echo [ERROR] Android project not found!
    echo Run: npx expo prebuild --platform android
    pause
    exit /b 1
)

echo [1/3] Navigating to Android directory...
cd android

echo [2/3] Building Release APK...
echo This may take 5-10 minutes...
echo.

call gradlew assembleRelease

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] APK Built Successfully!
    echo ========================================
    echo.
    echo APK Location:
    echo %CD%\app\build\outputs\apk\release\app-release.apk
    echo.
    echo [3/3] Opening APK folder...
    start "" "%CD%\app\build\outputs\apk\release"
) else (
    echo.
    echo ========================================
    echo [ERROR] Build Failed!
    echo ========================================
    echo.
    echo Make sure you have:
    echo 1. Android Studio installed
    echo 2. ANDROID_HOME environment variable set
    echo 3. Java JDK 17 installed
)

echo.
pause
