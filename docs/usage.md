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
helpmetest status <subcommand> [options]
```

View the current status of all tests and health checks:
```bash
# View status of all tests and health checks
helpmetest status

# View status for specific environment
ENV=production helpmetest status

# View status with detailed information
helpmetest status --verbose

# Output in JSON format
helpmetest status --json
```

The status command displays:
- Test/health check name
- Current status (up/down/unknown or pass/fail/unknown)
- Last run/heartbeat time
- Duration/grace period
- Tags and other metadata

#### Status Subcommands

**View Tests Only:**
```bash
helpmetest status test [--verbose] [--json]
```

**View Health Checks Only:**
```bash
helpmetest status health [--verbose] [--json]
```

Example output:
```
Tests
Status  Name                    Last Run      Duration  Tags           
✅      netdata.helpmetest.com  2 hours ago   0.19s     uptime         
✅      login.helpmetest.com    2 hours ago   0.16s     uptime         
❌      Landing -> /docs        1 day ago     3.05s     landing, flaky 
❔      Login                   Unknown       N/A       cuj, flaky     

Healthchecks
Status  Name           Last Heartbeat  Grace  Env        Host           Tags
✅      api-server     2 minutes ago   30s    production  srv-01        api
❌      backup-service 2 days ago      1h     staging     backup-01     backup
```

### Test Command

```bash
helpmetest test <identifier> [options]
```

Runs tests by name, tag, or ID with real-time progress tracking:

**Test Identifiers:**
- **By name**: `helpmetest test "/docs"`
- **By tag**: `helpmetest test "tag:flaky"`
- **By ID**: `helpmetest test "test-id-123"`

**Single Test Example:**
```bash
helpmetest test /docs
ℹ 🚀 Running test: /docs
ℹ 🚀 Starting: /docs
✓   ✓ As  Test User (0.130711s)
✓   ✓ Go To  https://helpmetest.slava.helpmetest.com/docs (0.656305s)
✓   ✓ Get Text  .doc-card h3 (0.145528s)
✓   ✓ Click  .doc-card:first-child (0.174929s)
✓   ✓ Wait Until Network Is Idle (1.749152s)
✓ ✅ /docs completed (3.053986s)
```

**Multiple Tests Example (Tag-based):**
```bash
helpmetest test tag:uptime
ℹ 🚀 Running tests with tag: uptime
Test Execution Progress
Status  Test Name               Duration   Current Step 
✅      netdata.helpmetest.com  0.196777s  Completed    
✅      login.helpmetest.com    0.166981s  Completed    
✅      ntfy.helpmetest.com     0.039632s  Completed    
✅      helpmetest.com          0.027147s  Completed    
✓ ✅ All 4 tests passed
```

**Note:** To list available tests, use `helpmetest status test`

**Features:**
- **Dynamic Progress Table**: For multiple tests, shows real-time execution status with live duration updates
- **Streaming Output**: For single tests, displays detailed step-by-step execution
- **Status Indicators**: 
  - ✅ Passed tests
  - ❌ Failed tests  
  - 🔄 Currently running
  - ⏳ Pending/waiting
- **Real-time Updates**: Table refreshes every 200ms during execution
- **Error Handling**: Network connectivity issues and test failures are clearly reported

### Keywords Command

```bash
helpmetest keywords [search_term] [options]
```

Search and explore available Robot Framework libraries and keywords:

**Examples:**
```bash
# List all available libraries
helpmetest keywords

# Search for keywords containing "click"
helpmetest keywords "click"

# Show only libraries (not individual keywords)
helpmetest keywords --type libraries

# Show only keywords
helpmetest keywords --type keywords

# Show detailed documentation
helpmetest keywords --verbose

# Output in JSON format
helpmetest keywords --json
```

**Features:**
- **Library Exploration**: Browse available Robot Framework libraries
- **Keyword Search**: Find specific keywords across all libraries
- **Documentation**: View detailed documentation for libraries and keywords
- **Filtering**: Filter by library or keyword name
- **Verbose Mode**: Show full documentation with examples and arguments

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