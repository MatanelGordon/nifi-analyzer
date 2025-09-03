@echo off
REM Script to start NiFi with specified version
REM Usage: start-nifi.bat [v1|v2]
REM Default: v1

set VERSION=%1
if "%VERSION%"=="" set VERSION=v1

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
echo 🌐 Access NiFi at: https://localhost:8080
echo 👤 Username: admin
echo 🔑 Password: 12345678Matanel!
echo.
echo 📊 To stop NiFi, run:
echo    scripts\stop-nifi.bat %VERSION%
