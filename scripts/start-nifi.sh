#!/bin/bash

# Script to start NiFi with specified version
# Usage: ./start-nifi.sh [v1|v2]
# Default: v1

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker daemon is not running"
    echo "Please start Docker daemon first"
    exit 1
fi

VERSION=${1:-v1}

# Load environment variables
if [ -f ".local-nifi.env" ]; then
    source .local-nifi.env
else
    echo "⚠️ Warning: .nifi.env file not found, using default values"
    NIFI_WEB_HTTPS_PORT=8080
    SINGLE_USER_CREDENTIALS_USERNAME=admin
    SINGLE_USER_CREDENTIALS_PASSWORD=12345678Admin!
fi

case $VERSION in
    v1)
        echo "🚀 Starting NiFi v1.28.0..."
        docker compose -f docker-compose.nifi.yml up nifi1 -d
        ;;
    v2)
        echo "🚀 Starting NiFi v2.2.0..."
        docker compose -f docker-compose.nifi.yml up nifi2 -d
        ;;
    *)
        echo "❌ Error: Unknown NiFi version. Expected 'v1' or 'v2'"
        echo "Usage: $0 [v1|v2]"
        exit 1
        ;;
esac

echo "✅ NiFi $VERSION started successfully!"
echo "🌐 Access NiFi at: https://localhost:${NIFI_WEB_HTTPS_PORT}"
echo "👤 Username: ${SINGLE_USER_CREDENTIALS_USERNAME}"
echo "🔑 Password: ${SINGLE_USER_CREDENTIALS_PASSWORD}"
echo ""
echo "📊 To stop NiFi, run:"
echo "   ./scripts/stop-nifi.sh $VERSION"
