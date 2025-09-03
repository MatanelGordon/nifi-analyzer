# NiFi Provenance Analyzer

A TypeScript application that extracts processor information from Apache NiFi process groups and stores it in a SQLite database for analysis.

## Features

- 🔍 Recursively extracts processor information from all nested process groups
- 💾 Stores data in SQLite database with structured schema
-- 🐳 Docker Compose setup with analyzer
-- 📊 Ready-to-use SQLite integration
- 🔐 Secure authentication with NiFi API
- ⚙️ Configurable via environment variables
- 🚀 Separate NiFi v1 and v2 Docker Compose files

## Database Schema

The `processors_info` table contains the following columns:

- `id` - Processor's unique identifier (Primary Key)
- `name` - Processor's display name
- `type` - Processor type (e.g., "RouteOnAttribute", "InvokeHttp")
- `run_duration` - Scheduling run duration in milliseconds
- `concurrent_tasks` - Number of concurrent tasks
- `scheduling_strategy` - Processor's scheduling strategy
- `run_schedule` - Run schedule value as shown in UI
- `execution` - Execution node ("ALL_NODES" or "PRIMARY_NODE")
- `comments` - Processor comments
- `terminated_relationships` - Comma-separated list of terminated relationships

## Quick Start

### NiFi Setup

Start and stop your preferred NiFi version using the provided scripts:

**For Linux/macOS:**
```bash
# Start NiFi v1.28.0 (default)
./scripts/start-nifi.sh

# Start NiFi v2.2.0
./scripts/start-nifi.sh v2

# Stop all NiFi instances
./scripts/stop-nifi.sh

# Stop specific version
./scripts/stop-nifi.sh v1
./scripts/stop-nifi.sh v2
```

**For Windows:**
```cmd
# Start NiFi v1.28.0 (default)
scripts\start-nifi.bat

# Start NiFi v2.2.0
scripts\start-nifi.bat v2

# Stop all NiFi instances
scripts\stop-nifi.bat

# Stop specific version
scripts\stop-nifi.bat v1
scripts\stop-nifi.bat v2
```

### Using Docker Compose (Recommended)

1. **Start NiFi first:**
   ```bash
   ./scripts/start-nifi.sh  # or scripts\start-nifi.bat on Windows
   ```

2. **Wait for NiFi to be ready (2-3 minutes)**, then start the analyzer:
   ```bash
   docker compose up -d
   ```

3. **Access the applications:**
   - NiFi: https://localhost:8080 (admin/12345678Matanel!)

4. **The analyzer will automatically:**
   - Connect to NiFi
   - Extract processor information from all process groups
   - Store data in `/data/output.db` (SQLite format)
      - Make it available for analysis tools (e.g., SQLite viewers)

### Manual Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set environment variables:**
   ```bash
   export NIFI_URL="https://localhost:8080"
   export NIFI_USERNAME="admin"
   export NIFI_PASSWORD="12345678Matanel!"
   export PG_ID="root"  # Optional: specific process group ID
   ```

3. **Run the analyzer:**
   ```bash
   pnpm start
   ```

### Standalone Analyzer for External NiFi

To run just the analyzer against an external NiFi instance:

```bash
# Set environment variables for external NiFi
export NIFI_URL="https://your-external-nifi.com:8080"
export NIFI_USERNAME="your-username"
export NIFI_PASSWORD="your-password"
export DB_PATH="./output.db"  # Local SQLite file

# Run the analyzer
pnpm start
```

This will create a local `output.db` SQLite file that you can analyze directly with any SQLite client.

## NiFi Persistence

Both NiFi versions use persistent volumes to maintain your configurations and data:

- **Configuration**: `./.nifi/conf/`
- **Databases**: `./.nifi/database_repository/`
- **FlowFiles**: `./.nifi/flowfile_repository/`
- **Content**: `./.nifi/content_repository/`
- **Provenance**: `./.nifi/provenance_repository/`
- **State**: `./.nifi/state/`
- **Logs**: `./.nifi/logs/`

Your NiFi flows, processors, and configurations will persist between container restarts.

### NiFi Management Scripts

The project includes convenient scripts for managing NiFi instances:

**Start Scripts:**
- `./scripts/start-nifi.sh [v1|v2]` - Start specific NiFi version (default: v1)
- `scripts\start-nifi.bat [v1|v2]` - Windows version

**Stop Scripts:**
- `./scripts/stop-nifi.sh [v1|v2|all]` - Stop specific version or all instances (default: all)
- `scripts\stop-nifi.bat [v1|v2|all]` - Windows version

**Examples:**
```bash
# Start NiFi v1, then stop it
./scripts/start-nifi.sh v1
./scripts/stop-nifi.sh v1

# Start NiFi v2, then stop all instances
./scripts/start-nifi.sh v2
./scripts/stop-nifi.sh all

# Check what's running and stop everything
docker compose ps
./scripts/stop-nifi.sh all
```

## Configuration

### Environment Variables

- `NIFI_URL` - NiFi instance URL (default: https://localhost:8080)
- `NIFI_USERNAME` - NiFi username (default: admin)
- `NIFI_PASSWORD` - NiFi password (default: 12345678Matanel!)
- `PG_ID` - Process Group ID to analyze (default: prompts for selection)
- `DB_PATH` - SQLite database path (default: /data/output.db)

### External NiFi Access

The analyzer and Superset containers are configured to access external NiFi instances:

- **Network Access**: Both services can connect to external hosts
- **External Connections**: Can connect to NiFi instances on EC2, cloud services, etc.
- **HTTPS Support**: Default configuration uses HTTPS with certificate bypass
- **Environment Variables**: All NiFi connection parameters can be overridden

To connect to an external NiFi instance:

```bash
# Connect to NiFi on EC2
export NIFI_URL="https://your-nifi-ec2.com:8080"
export NIFI_USERNAME="your-username"
export NIFI_PASSWORD="your-password"
docker compose up -d
```

### Process Group Selection

If `PG_ID` is not provided, the application will:
1. Fetch all root-level process groups
2. Present an interactive menu for selection
3. Allow choosing "Root" to analyze all process groups

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Apache NiFi   │───▶│  TypeScript      │───▶│   SQLite        │
│   (v1/v2)       │    │  Analyzer        │    │  (output.db)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Analysis Tools  │
                       │  (SQLite)        │
                       └──────────────────┘
```

## File Structure

```
src/
├── index.ts              # Main application entry point
├── nifi-base.ts          # NiFi API client with authentication
├── get-process-groups.ts # Recursive process group fetcher
├── get-processors.ts     # Processor information extractor
├── database.ts           # SQLite database operations (better-sqlite3)
├── config.ts             # Configuration management
└── user-prompts.ts       # User interaction utilities

Docker Files:
├── docker-compose.yml           # Main analyzer + Superset
├── nifi.v1.docker-compose.yml  # NiFi v1.28.0
├── nifi.v2.docker-compose.yml  # NiFi v2.2.0
├── Dockerfile                   # Analyzer container
├── (no Superset files)          # Superset removed from this project

Scripts:
├── scripts/
│   ├── start-nifi.sh           # NiFi startup script (Linux/macOS)
│   ├── start-nifi.bat          # NiFi startup script (Windows)
│   ├── stop-nifi.sh            # NiFi stop script (Linux/macOS)
│   └── stop-nifi.bat           # NiFi stop script (Windows)
```

## Usage Examples

### Querying the Database

You can query the SQLite database directly:

```sql
-- Get all processors
SELECT * FROM processors_info;

-- Get processors by type
SELECT * FROM processors_info WHERE type = 'RouteOnAttribute';

-- Get execution distribution
SELECT execution, COUNT(*) as count 
FROM processors_info 
GROUP BY execution;

-- Get processor types with counts
SELECT type, COUNT(*) as count 
FROM processors_info 
GROUP BY type 
ORDER BY count DESC;
```

### Analysis / Visualization

Use any SQLite-compatible analysis or visualization tool to connect to `./data/output.db` and explore the `processors_info` table.

## Security Considerations

⚠️ **Important Security Notes:**

- Default credentials are used for development only
- Change default passwords in production environments
- Ensure NiFi instance is properly secured
- Use environment variables for sensitive configuration
- The analyzer uses `NODE_TLS_REJECT_UNAUTHORIZED=0` to bypass certificate validation

## Troubleshooting

### Common Issues

1. **NiFi Connection Issues:**
   - Verify NiFi is running and accessible
   - Check credentials (admin/12345678Matanel!)
   - Wait for NiFi to fully start (2-3 minutes)
   - Self-signed certificate warnings are bypassed automatically

2. **SQLite Errors:**
   - Ensure write permissions to data directory
   - Verify sufficient disk space
   - Check that any native SQLite libraries are available in your environment (usually preinstalled)

3. **Visualization Tool Issues:**
   - Ensure your visualization tool can access the mounted `/data/output.db` file
   - Verify data directory permissions

4. **Docker Compose Issues:**
   - Ensure all services are running: `docker compose ps`
   - Check logs: `docker compose logs [service-name]`
   - Rebuild if needed: `docker compose build`

5. **NiFi Persistence Issues:**
   - Check that `.nifi/` directories have proper permissions
   - Ensure Docker has access to bind mount directories
   - On Windows, ensure drive sharing is enabled

### Development Workflow

The analyzer uses a multi-stage Dockerfile with volume mounting:

1. **Dependencies are pre-installed** in the builder stage
2. **Edit TypeScript files** in your local `src/` directory
3. **Changes are immediately available** in the container
4. **Restart the analyzer** to pick up changes:
   ```bash
   docker compose restart nifi-analyzer
   ```

### Logs

The application provides detailed logging:
- ✅ Success operations
- ⚠️ Warnings and fallbacks
- ❌ Errors and failures
- 📊 Progress indicators

## Development

### Prerequisites

- Node.js 18+
- pnpm
- TypeScript
- Docker & Docker Compose

### Scripts

- `pnpm start` - Run the analyzer
- `pnpm build` - Compile TypeScript
- `pnpm test` - Run tests (when implemented)

### Contributing

1. Follow TypeScript best practices
2. Use functional programming patterns where possible
3. Maintain comprehensive error handling
4. Add appropriate logging
5. Follow DRY and KISS principles

## License

ISC License