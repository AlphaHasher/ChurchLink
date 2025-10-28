@echo off

REM This is to set the Android SDK environment variables for Patrol CLI
set "ANDROID_HOME=%LOCALAPPDATA%\Android\sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

echo Bible Reader Test Suites
echo.

echo 1/2
call flutter test test/widgets/reader_top_bar_test.dart
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo tests failed!
    exit /b %ERRORLEVEL%
)

echo.

echo 2/2
call "%USERPROFILE%\AppData\Local\Pub\Cache\bin\patrol.bat" test --target integration_test/bible_reader_test.dart --dart-define=TEST_MODE=true
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo tests failed!
    exit /b %ERRORLEVEL%
)

echo.