@echo off
REM WordPress to Sanity Article Import
REM Run this batch file with your Sanity API token

REM Check if token is provided
if "%1"=="" (
    echo.
    echo ERROR: No API token provided!
    echo.
    echo Usage:
    echo   run-import.bat YOUR_SANITY_API_TOKEN
    echo.
    echo Steps to get your token:
    echo   1. Go to https://manage.sanity.io/
    echo   2. Select project "leo" ^(g45aygyb^)
    echo   3. Go to API ^> Tokens
    echo   4. Create new token with "Editor" role
    echo   5. Copy the token
    echo.
    echo Example:
    echo   run-import.bat sxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo WordPress to Sanity Article Import
echo ========================================
echo.
echo Project ID: g45aygyb
echo Dataset: production
echo.
echo Articles: 5,316+
echo Comments: 10,000+
echo.
echo Setting up import...
echo.

REM Set the environment variable
set SANITY_TOKEN=%1

REM Run the import script
node import-wp-articles.mjs

REM Show result
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Import completed successfully!
    echo ========================================
    echo.
) else (
    echo.
    echo ========================================
    echo Import failed with error code: %errorlevel%
    echo ========================================
    echo.
)

pause
