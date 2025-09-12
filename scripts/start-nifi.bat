@echo off
setlocal enabledelayedexpansion

REM Script to start NiFi with specified version
REM Usage: start-nifi.bat [v1|v2]
REM Default: v1

REM Check if docker is installed
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not installed
    echo Please install Docker first: https://docs.docker.com/get-docker/
    exit /b 1
)

REM Check if docker daemon is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker daemon is not running
    echo Please start Docker daemon first
    exit /b 1
)

REM Set default version to v1
set VERSION=%1
if "%VERSION%"=="" set VERSION=v1

REM Load environment variables
if exist .local-nifi.env (
    for /f "tokens=1,2 delims==" %%G in (.local-nifi.env) do (
        set %%G=%%H
    )
) else (
    echo ⚠️ Warning: .nifi.env file not found, using default values
    set NIFI_WEB_HTTPS_PORT=8080
    set SINGLE_USER_CREDENTIALS_USERNAME=admin
    set SINGLE_USER_CREDENTIALS_PASSWORD=12345678Admin!
)

if "%VERSION%"=="v1" (
    echo 🚀 Starting NiFi v1.28.0...
    docker compose -f docker-compose.nifi.yml up nifi1 -d
    goto success
)

if "%VERSION%"=="v2" (
    echo 🚀 Starting NiFi v2.2.0...
    docker compose -f docker-compose.nifi.yml up nifi2 -d
    goto success
)

echo ❌ Error: Unknown NiFi version. Expected 'v1' or 'v2'
echo Usage: %0 [v1^|v2]
exit /b 1

:success
echo ✅ NiFi %VERSION% started successfully!
echo 🌐 Access NiFi at: https://localhost:%NIFI_WEB_HTTPS_PORT%
echo 👤 Username: %SINGLE_USER_CREDENTIALS_USERNAME%
echo 🔑 Password: %SINGLE_USER_CREDENTIALS_PASSWORD%
echo.
echo 📊 To stop NiFi, run:
echo    scripts\stop-nifi.bat %VERSION%

endlocal
