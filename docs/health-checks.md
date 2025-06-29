# Health Check Guide

This guide covers health check patterns, troubleshooting, and best practices for the HelpMeTest CLI.

## Table of Contents

- [Grace Period Formats](#grace-period-formats)
- [System Metrics](#system-metrics)
- [API Isolation](#api-isolation)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)

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

## API Isolation

**Critical Feature**: Health check exit codes are determined ONLY by the command execution result, not by API connectivity.

### Why This Matters

If the HelpMeTest API is unreachable (network issues, service downtime, DNS problems), the health check will:

✅ **Still execute your command** (e.g., checking if a process is running)  
✅ **Return the correct exit code** based on your command's success/failure  
⚠️ **Log API failures as warnings** without affecting the health check result  

### Example Scenarios

```bash
# Scenario 1: Service is healthy, but API is down
helpmetest health "runner" "2m" "ps aux | grep Runner.Listener"
# ✅ Exit code 0 (service is running)
# ⚠️ Warning: "Failed to send heartbeat to API: Network error"

# Scenario 2: Service is unhealthy, API is down  
helpmetest health "runner" "2m" "ps aux | grep NonExistentProcess"
# ❌ Exit code 1 (service is not running)
# ⚠️ Warning: "Failed to send heartbeat to API: Network error"
```

### Container Orchestration Benefits

This ensures that:
- **Kubernetes** won't kill healthy pods due to API issues
- **Docker** health checks reflect actual service status
- **DevSpace** development isn't disrupted by network problems

### Container-Specific Health Checks

The CLI automatically detects container types and provides optimized health checks:

```bash
# Kubernetes liveness probe with API isolation
livenessProbe:
  exec:
    command:
      - helpmetest
      - health
      - "container-name"
      - "1m"
      - "echo 'Service is running'"
  failureThreshold: 3
  periodSeconds: 30
  timeoutSeconds: 10
```

Even if the HelpMeTest API is unreachable, the container health check will:
- Continue to execute the health check command
- Return the correct exit code based on the command's success/failure
- Maintain container stability during API outages

### Auto-Detected Container Health Checks

The CLI can automatically infer appropriate health check commands based on container content:

| Container Type | Auto-Detected Health Check |
|----------------|----------------------------|
| PostgreSQL     | `psql -h localhost -c "SELECT 1"` |
| MySQL          | `mysql -h localhost -e "SELECT 1"` |
| Redis          | `redis-cli ping` |
| MongoDB        | `mongosh --eval "db.runCommand({ping: 1})"` |
| Node.js        | `GET localhost:3000/health` |
| Python/Flask   | `GET localhost:8000/health` |
| Nginx          | `GET localhost:80/health` |
| Kafka          | `:9092` (port check) |
| RabbitMQ       | `GET localhost:15672/api/overview` |

This automatic detection makes it easier to integrate health checks into existing container configurations without manual customization.

### API Error Types

The following API issues are isolated and logged as warnings:
- Network connectivity problems
- DNS resolution failures  
- Authentication errors (invalid tokens)
- Server errors (5xx responses)
- Rate limiting (429 responses)

## Configuration

### Environment Setup

The CLI supports multiple configuration methods with the following priority:

1. **Environment variables** (highest priority)
2. **`.env` file** in current directory  
3. **Default values**

### .env File Support

Create a `.env` file in your project directory for easy configuration:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
HELPMETEST_API_TOKEN=HELP-your-token-here
HELPMETEST_API_URL=https://helpmetest.com
ENV=production
```

### Configuration Validation

The CLI validates configuration on startup but **never fails health checks due to configuration issues**:

```bash
# Missing API token - health check still runs
helpmetest health "service" "1m" "echo test"
# ⚠️ Configuration validation failed - API reporting will be disabled
# ✅ Command succeeds with exit code 0

# Invalid API URL - health check still runs  
HELPMETEST_API_URL=invalid-url helpmetest health "service" "1m" "echo test"
# ⚠️ Failed to send heartbeat to API: Network error
# ✅ Command succeeds with exit code 0
```

## Troubleshooting

### Debug Mode

```bash
# Enable debug output
DEBUG=1 helpmetest health "test" "1m"

# Check system metrics
helpmetest metrics

# Verify configuration
helpmetest --help
```

### False Positive Alerts

**Symptoms:**
- Getting alerts when service is actually healthy
- Intermittent failures for stable services
- Health checks timing out unexpectedly

**Solutions:**

1. **Increase Grace Period:**
   ```bash
   # If service normally takes 30s, use 45s-60s grace period
   helpmetest health "slow-service" "60s"
   
   # For variable execution times, add more buffer
   helpmetest health "backup-job" "6h"  # for 4-5h backup jobs
   ```

2. **Check Command Dependencies:**
   ```bash
   # Test the health check command manually
   psql -h localhost -c '\l'  # Test database connection
   curl -f http://localhost:3000/health  # Test HTTP endpoint
   ```

3. **Review System Load:**
   ```bash
   # Check system resources during health check execution
   helpmetest metrics
   top
   iostat
   ```

4. **Use More Specific Health Checks:**
   ```bash
   # Instead of generic port check
   helpmetest health "web-port" "1m" ":3000"
   
   # Use specific endpoint
   helpmetest health "web-health" "1m" "GET localhost:3000/health"
   ```

### Missing Heartbeats

**Symptoms:**
- Health checks show as 'down' but services are running
- Irregular heartbeat patterns in dashboard
- Cron jobs not reporting consistently

**Solutions:**

1. **Verify Cron Job Syntax:**
   ```bash
   # Check cron job is running
   sudo tail -f /var/log/cron
   
   # Test cron job manually
   helpmetest health "backup" "25h" "backup.sh"
   ```

2. **Review Execution Environment:**
   ```bash
   # Use absolute paths in cron jobs
   0 2 * * * /usr/local/bin/helpmetest health "backup" "25h" "backup.sh"
   
   # Set environment variables explicitly
   0 2 * * * HELPMETEST_API_TOKEN=token /usr/local/bin/helpmetest health "backup" "25h" "backup.sh"
   ```

### Command Execution Issues

**Symptoms:**
- Health check commands fail unexpectedly
- Different behavior when run manually vs. automated
- Permission denied errors

**Solutions:**

1. **Use Absolute Paths:**
   ```bash
   # Instead of relative paths
   helpmetest health "backup" "5m" "./backup.sh"
   
   # Use absolute paths
   helpmetest health "backup" "5m" "/usr/local/bin/backup.sh"
   ```

2. **Set Required Environment Variables:**
   ```bash
   # Export variables before health check
   export PATH=/usr/local/bin:/usr/bin:/bin
   export PGPASSWORD=secret
   helpmetest health "db-check" "2m" "psql -h localhost -c '\l'"
   ```

3. **Check File Permissions:**
   ```bash
   # Ensure scripts are executable
   chmod +x /usr/local/bin/backup.sh
   
   # Check file ownership
   ls -la /usr/local/bin/backup.sh
   ```

4. **Test in Same Context:**
   ```bash
   # Test as the same user that runs the health check
   sudo -u www-data helpmetest health "web-check" "1m" "GET localhost:3000/health"
   ```

## Best Practices

### Choosing Grace Periods

**Guidelines:**
- **Web APIs**: 30s - 2m (frequent checks for user-facing services)
- **Database operations**: 2m - 10m (depending on complexity)
- **Backup jobs**: 20-30% longer than expected execution time
- **Daily jobs**: 25h - 26h (account for execution time variations)
- **Weekly jobs**: 8d - 9d (buffer for maintenance windows)

**Examples:**
```bash
# Fast API endpoint
helpmetest health "api-health" "30s" "GET localhost:3000/health"

# Database backup (usually takes 2-3 hours)
helpmetest health "db-backup" "4h"

# Daily report generation (usually takes 10-15 minutes)
helpmetest health "daily-report" "25h"

# Weekly cleanup (usually takes 1-2 hours)
helpmetest health "weekly-cleanup" "8d"
```

### Cron Job Best Practices

- Use grace periods 20-30% longer than expected execution time
- Add environment context for different servers
- Include error handling in your scripts
- Use absolute paths in cron jobs
- Set environment variables explicitly

### Environment Management

```bash
# Production environment
ENV=production HELPMETEST_CLUSTER=prod-us-east-1 helpmetest health "web-app" "1m"

# Staging environment
ENV=staging HELPMETEST_CLUSTER=staging-us-west-2 helpmetest health "web-app" "5m"

# Development environment
ENV=dev HELPMETEST_CLUSTER=dev-local helpmetest health "web-app" "10m"
```

## Common Patterns

### Container Health Monitoring

```bash
# Kubernetes liveness probe
livenessProbe:
  exec:
    command:
      - helpmetest
      - health
      - "container-name"
      - "1m"
      - "echo 'Service is running'"
  failureThreshold: 3
  periodSeconds: 30
  timeoutSeconds: 10

# Kubernetes readiness probe
readinessProbe:
  exec:
    command:
      - helpmetest
      - health
      - "container-name"
      - "1m"
      - "echo 'Service is running'"
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 10
  failureThreshold: 2
```

### Container Health Check Best Practices

1. **Use Service-Specific Checks**:
   ```yaml
   # For a web service
   livenessProbe:
     exec:
       command:
         - helpmetest
         - health
         - "web-service"
         - "30s"
         - "GET /health"
   
   # For a database service
   livenessProbe:
     exec:
       command:
         - helpmetest
         - health
         - "db-service"
         - "1m"
         - "psql -h localhost -c 'SELECT 1'"
   ```

2. **Configure Appropriate Timeouts**:
   - Set `timeoutSeconds` to at least 5-10 seconds to allow for health check execution
   - For services with slower startup, increase `initialDelaySeconds` accordingly

3. **Handle API Outages**:
   - The CLI's API isolation ensures container health checks remain reliable even during API outages
   - No special configuration is needed - this behavior is built-in

4. **Debugging Container Health Checks**:
   ```bash
   # Run the health check manually inside the container
   kubectl exec -it my-pod -- helpmetest health "service-name" "1m" "GET /health"
   
   # Enable debug mode for detailed output
   kubectl exec -it my-pod -- bash -c "DEBUG=1 helpmetest health 'service-name' '1m' 'GET /health'"
   ```

5. **Graceful Degradation**:
   - Health checks will log warnings about API connectivity issues but won't fail the container
   - This prevents cascading failures when the monitoring system itself is experiencing issues

### Database Monitoring

```bash
# Primary database
helpmetest health "db-primary" "2m" "psql -h db-primary.example.com -c 'SELECT 1'"

# Read replicas
helpmetest health "db-replica-1" "2m" "psql -h db-replica-1.example.com -c 'SELECT 1'"
helpmetest health "db-replica-2" "2m" "psql -h db-replica-2.example.com -c 'SELECT 1'"

# Replication lag check
helpmetest health "db-replication-lag" "5m" "psql -h db-primary.example.com -c 'SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0 ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) END'"
```

### Load Balancer Monitoring

```bash
# Check each backend server
helpmetest health "backend-1" "1m" "GET http://backend-1.internal:8080/health"
helpmetest health "backend-2" "1m" "GET http://backend-2.internal:8080/health"
helpmetest health "backend-3" "1m" "GET http://backend-3.internal:8080/health"

# Check load balancer itself
helpmetest health "load-balancer" "1m" "GET http://lb.example.com/health"
```

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
helpmetest health "disk-space" "5m" "df -h | grep -v '^Filesystem'"

# Service status check
helpmetest health "nginx-status" "1m" "systemctl is-active nginx"
```

## Status Indicators

The command will report:
- ✓ (green) for successful health checks
- ✗ (red) for failed health checks that were successfully reported
- ⨯ (red) for errors when the health check couldn't be sent

## Need Help?

If you encounter any issues or have questions about health checks:
- **Email**: [contact@helpmetest.com](mailto:contact@helpmetest.com)
- **Main Documentation**: [README](../README.md)
- **Debug Guide**: Use `DEBUG=1` with your health check commands