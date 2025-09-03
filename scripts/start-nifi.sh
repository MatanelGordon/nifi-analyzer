#!/bin/bash

# Script to start NiFi with specified version
# Usage: ./start-nifi.sh [v1|v2]
# Default: v1

VERSION=${1:-v1}

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
echo "🌐 Access NiFi at: https://localhost:8080"
echo "👤 Username: admin"
echo "🔑 Password: 12345678Matanel!"
echo ""
echo "📊 To stop NiFi, run:"
echo "   ./scripts/stop-nifi.sh $VERSION"
