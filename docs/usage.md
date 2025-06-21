# Usage Guide

## Basic Commands

### Health Check Command

```bash
helpmetest health <name> <grace_period> [command]
```

**Examples:**
```bash
# Basic health check
helpmetest health "database-backup" "5m"

# With environment
ENV=production helpmetest health "web-app" "1m"

# Conditional execution
psql postgres://user:pass@localhost/db -c "SELECT 1;" && helpmetest health "db-connection" "2m"

# Command execution with monitoring
helpmetest health "db-connection" "2m" 'psql postgres://user:pass@localhost/db -c "SELECT 1;"'
```

### Status Command

```bash
helpmetest status [options]
```

View the current status of all health checks:
```bash
# View status of all health checks
helpmetest status

# View status for specific environment
ENV=production helpmetest status
```

The status command displays:
- Health check name
- Current status (up/down/unknown)
- Last heartbeat time
- Grace period
- Environment

## Special Command Syntax

### HTTP Health Checks
```bash
# Check HTTP endpoint (automatically adds http://localhost)
helpmetest health "api-health" "1m" "GET /health"

# Check specific host:port
helpmetest health "api-check" "1m" "GET 127.0.0.1:3000/health"

# Check full URL
helpmetest health "auth-service" "30s" "GET https://api.example.com/health"
```

### Port Availability Checks
```bash
# Check if port 3000 is available
helpmetest health "port-3000" "1m" ":3000"
```

### Shell Command Execution
```bash
# Database connection check
helpmetest health "postgres-check" "5m" "psql -h localhost -c '\l'"

# File system check
helpmetest health "disk-space" "5m" "df -h"

# Service status check
helpmetest health "nginx-status" "1m" "systemctl is-active nginx"
```

## Grace Period Formats

Supported time formats:
- `30s` - 30 seconds
- `5m` - 5 minutes  
- `2h` - 2 hours
- `1d` - 1 day
- `15min` - 15 minutes
- `2.5h` - 2.5 hours

## Environment Variables

### Required
- `HELPMETEST_API_TOKEN` - Your HelpMeTest API token

### Optional
- `ENV` - Environment identifier (dev, staging, prod)
- `HELPMETEST_*` - Custom data (any env var starting with HELPMETEST_)

### Debug
- `DEBUG=1` - Enable debug output

## Status Indicators

The command will report:
- ✓ (green) for successful health checks
- ✗ (red) for failed health checks that were successfully reported
- ⨯ (red) for errors when the health check couldn't be sent

## System Metrics

The CLI automatically collects and sends:
- Hostname
- IP Address
- CPU usage
- Memory usage
- Disk usage
- Environment
- Custom HELPMETEST_* variables