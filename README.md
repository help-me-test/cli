# HelpMeTest CLI

A command-line tool for sending health check heartbeats to HelpMeTest monitoring system.

✨ **Features:**
- **HTTP Health Checks** - Monitor web endpoints with automatic status code validation
- **Port Monitoring** - Check if specific ports are available or in use
- **Command Execution** - Run and monitor any shell command as a health check
- **Flexible Timing** - Support for seconds, minutes, hours, or days in grace periods
- **System Metrics** - Automatically collect and report CPU, memory, and disk usage
- **Environment Support** - Run checks across different environments (dev/staging/prod)
- **Custom Data** - Attach custom metrics via environment variables


## Installation

### Quick Install (Recommended)
```bash
curl -fsSL https://helpmetest.com/install | bash

# Verify installation
helpmetest --version
```

The installer will automatically:
- Detect your OS and architecture
- Download the appropriate binary
- Install it to `/usr/local/bin` (or appropriate location for your OS)
- Make it executable
- Verify the installation

```bash
# Basic health check
helpmetest health "database-backup" "5m"

# With environment
ENV=production helpmetest health "web-app" "1m"

# Conditional execution
psql postgres://user:pass@localhost/db -c "SELECT 1;" && \
  helpmetest health "db-connection" "2m"

# View status of all health checks
helpmetest status

# View status for specific environment
ENV=production helpmetest status
```


## Environment Variables

- `HELPMETEST_API_TOKEN` - Required. Your HelpMeTest API token
- `ENV` - Optional. Environment identifier (dev, staging, prod)
- `HELPMETEST_*` - Optional. Custom data (any env var starting with HELPMETEST_)
## Usage

### Health Check Command

```bash
helpmetest health <name> <grace_period>
```

### Status Command

```bash
helpmetest status [options]
```

View the current status of all health checks in your environment. The command displays:
- Health check name
- Current status (up/down/unknown)
- Last heartbeat time
- Grace period
- Environment

### Special Command Syntax

The health check command supports several special command formats for common monitoring scenarios:

1. **HTTP Health Check**
   ```bash
   # Check HTTP endpoint (automatically adds http://localhost)
   helpmetest health "api-health" "1m" "GET /health"
   
   # Check specific host:port
   helpmetest health "api-check" "1m" "GET 127.0.0.1:3000/health"
   
   # Check full URL
   helpmetest health "auth-service" "30s" "GET https://api.example.com/health"
   ```

2. **Port Availability Check**
   ```bash
   # Check if port 3000 is available
   helpmetest health "port-3000" "1m" ":3000"
   ```

3. **Shell Command Execution**
   ```bash
   # Database connection check
   helpmetest health "postgres-check" "5m" "psql -h localhost -c '\l'"
   ```

The command will report:
- ✓ (green) for successful health checks
- ✗ (red) for failed health checks that were successfully reported
- ⨯ (red) for errors when the health check couldn't be sent

### Examples

```bash
# Basic health check
helpmetest health "database-backup" "5m"

# With environment
ENV=production helpmetest health "web-app" "1m"

# View status of all health checks
helpmetest status

# View status for specific environment
ENV=production helpmetest status
```

## Grace Period Formats

Supported time formats (via timespan-parser):
- `30s` - 30 seconds
- `5m` - 5 minutes  
- `2h` - 2 hours
- `1d` - 1 day
- `15min` - 15 minutes
- `2.5h` - 2.5 hours

## System Metrics

The CLI automatically collects and sends:
- Hostname
- IP Address
- CPU usage
- Memory usage
- Disk usage
- Environment
- Custom HELPMETEST_* variables

## Need Help?

For development documentation, build instructions, and contribution guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).

The compiled binary (`dist/helpmetest`) is a self-contained executable that includes:
- All Node.js dependencies
- System metrics collection
- Colorized output support
- Complete CLI functionality

Binary size: ~55MB (includes Bun runtime)