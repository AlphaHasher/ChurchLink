@echo off
REM ========================================
REM ChurchLink - Run Tests
REM ========================================
REM This script runs all Cypress tests for sermons and events
REM Make sure run_all_dev.bat is running before executing tests

echo.
echo Running ChurchLink Tests...
echo.

cd /d frontend\web\churchlink

call npm run test:smoke

echo.
if errorlevel 1 (
    echo TESTS FAILED - Check output above
) else (
    echo ALL TESTS PASSED
)
echo.
pause
