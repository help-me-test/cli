# Health Check Guide

This guide covers health check patterns, troubleshooting, and best practices for the HelpMeTest CLI.

## Table of Contents

- [Grace Period Formats](#grace-period-formats)
- [System Metrics](#system-metrics)
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