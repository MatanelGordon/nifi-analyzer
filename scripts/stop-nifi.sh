#!/bin/bash

# Script to stop NiFi instances
# Usage: ./stop-nifi.sh [v1|v2|all]
# Default: all (stops both v1 and v2 if running)

VERSION=${1:-all}

case $VERSION in
    v1)
        echo "🛑 Stopping NiFi v1.28.0..."
        docker compose -f docker-compose.nifi.yml down nifi1
        echo "✅ NiFi v1 stopped successfully!"
        ;;
    v2)
        echo "🛑 Stopping NiFi v2.2.0..."
        docker compose -f docker-compose.nifi.yml down nifi2
        echo "✅ NiFi v2 stopped successfully!"
        ;;
    all)
        echo "🛑 Stopping all NiFi instances..."
        
        docker compose -f docker-compose.nifi.yml down
        
        echo "✅ All NiFi instances stopped successfully!"
        ;;
    *)
        echo "❌ Error: Unknown NiFi version. Expected 'v1', 'v2', or 'all'"
        echo "Usage: $0 [v1|v2|all]"
        echo ""
        echo "Examples:"
        echo "  $0        # Stop all NiFi instances"
        echo "  $0 all    # Stop all NiFi instances"
        echo "  $0 v1     # Stop only NiFi v1"
        echo "  $0 v2     # Stop only NiFi v2"
        exit 1
        ;;
esac

echo ""
echo "📊 To start NiFi again, run:"
echo "   ./scripts/start-nifi.sh [v1|v2]"
