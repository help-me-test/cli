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
# Binary size: ~55MB (includes Bun runtime), huge one, we know

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

# Conditional execution, will send only success heartbeat if command succeeds, fail hearbeat be created after 2 minutes of grace time
psql postgres://user:pass@localhost/db -c "SELECT 1;" && helpmetest health "db-connection" "2m"

# Or with command syntax, will send fail heartbeat if command fails, and success heartbeat if command succeeds
helpmetest health "db-connection" "2m" 'psql postgres://user:pass@localhost/db -c "SELECT 1;"'

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

#### Cron Job Monitoring

Monitor scheduled tasks and ensure they complete successfully:

```bash
# Daily database backup (runs at 2 AM, grace period of 25 hours)
0 2 * * * /usr/local/bin/helpmetest health "daily-db-backup" "25h" "backup-database.sh"

# Hourly log processing (grace period of 75 minutes)
0 * * * * /usr/local/bin/helpmetest health "log-processing" "75m" "process-logs.sh"

# Data synchronization every 15 minutes
*/15 * * * * /usr/local/bin/helpmetest health "data-sync" "20m" "sync-data.sh"
```

**Cron Best Practices:**
- Use grace periods 20-30% longer than expected execution time
- Add environment context for different servers
- Include error handling in your scripts

#### Docker Integration

##### Basic Docker Health Check

```dockerfile
FROM node:18-alpine

# Install HelpMeTest CLI
RUN curl -fsSL https://helpmetest.com/install | bash
ENV HELPMETEST_API_TOKEN=${HELPMETEST_API_TOKEN}
# Copy application
COPY . /app
WORKDIR /app

# Install dependencies
RUN npm install

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD helpmetest health "docker-app" "1m" "GET localhost:3000/health"

CMD ["npm", "start"]
```

##### Docker Compose with Health Checks

```yaml
version: '3.8'
services:
  web:
    build: .
    environment:
      - HELPMETEST_API_TOKEN=${HELPMETEST_API_TOKEN}
      - ENV=production
      - HELPMETEST_SERVICE=web-frontend
    healthcheck:
      test: ["CMD", "helpmetest", "health", "web-service", "1m", "GET", "localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  api:
    build: ./api
    environment:
      - HELPMETEST_API_TOKEN=${HELPMETEST_API_TOKEN}
      - ENV=production
      - HELPMETEST_SERVICE=api-backend
    healthcheck:
      test: ["CMD", "helpmetest", "health", "api-service", "1m", "GET", "localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    healthcheck:
      test: ["CMD", "helpmetest", "health", "postgres-db", "2m", "psql -U user -d myapp -c 'SELECT 1'"]
      interval: 60s
      timeout: 30s
      retries: 3
```

#### Kubernetes Integration

##### Add API Secret

It's highly advised to use Secret manager, like [Infisical](https://infisical.com/), to store your API token.

```yaml
# Secret for API token
apiVersion: v1
kind: Secret
metadata:
  name: helpmetest-secret
type: Opaque
data:
  api-token: <base64-encoded-token>
```

##### Pod with Health Check

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  containers:
  - name: app
    image: myapp:latest
    env:
    - name: HELPMETEST_API_TOKEN
      valueFrom:
        secretKeyRef:
          name: helpmetest-secret
          key: api-token
    - name: ENV
      value: "production"
    - name: HELPMETEST_POD_NAME
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    - name: HELPMETEST_NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
    livenessProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - helpmetest health "k8s-pod-${HELPMETEST_POD_NAME}" "2m" "GET localhost:8080/health"
      initialDelaySeconds: 30
      periodSeconds: 30
      timeoutSeconds: 10
      failureThreshold: 3
    readinessProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - helpmetest health "k8s-ready-${HELPMETEST_POD_NAME}" "1m" "GET localhost:8080/ready"
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
```

##### Deployment with Health Checks

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: myapi:v1.2.3
        env:
        - name: HELPMETEST_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: helpmetest-secret
              key: api-token
        - name: ENV
          value: "production"
        - name: HELPMETEST_DEPLOYMENT
          value: "api-deployment"
        - name: HELPMETEST_VERSION
          value: "v1.2.3"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - helpmetest health "api-live-$(hostname)" "2m" "GET localhost:3000/api/health"
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 15
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - helpmetest health "api-ready-$(hostname)" "1m" "GET localhost:3000/api/ready"
          initialDelaySeconds: 10
          periodSeconds: 15
          timeoutSeconds: 10
          failureThreshold: 2
```

##### CronJob with Health Check

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: data-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: backup-tool:latest
            env:
            - name: HELPMETEST_API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: helpmetest-secret
                  key: api-token
            - name: ENV
              value: "production"
            - name: HELPMETEST_JOB_TYPE
              value: "backup"
            command:
            - /bin/sh
            - -c
            - |
              # Run backup
              /usr/local/bin/backup-data.sh
              
              # Report success
              helpmetest health "k8s-backup-job" "25h"
          restartPolicy: OnFailure
          backoffLimit: 3
```

##### Service Monitor with Health Check

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 3000
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: service-monitor
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: monitor
            image: alpine/curl:latest
            env:
            - name: HELPMETEST_API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: helpmetest-secret
                  key: api-token
            - name: ENV
              value: "production"
            command:
            - /bin/sh
            - -c
            - |
              # Install HelpMeTest CLI
              curl -fsSL https://helpmetest.com/install | sh
              
              # Check service health
              helpmetest health "k8s-service-monitor" "10m" "GET api-service/api/health"
          restartPolicy: OnFailure

```

#### Advanced Scenarios

##### Multi-Environment Setup

Of course, you shouldn't set ENV before command, it should be inside environment variables.

```bash
# Production environment
ENV=production HELPMETEST_CLUSTER=prod-us-east-1 helpmetest health "web-app" "1m"

# Staging environment
ENV=staging HELPMETEST_CLUSTER=staging-us-west-2 helpmetest health "web-app" "5m"

# Development environment
ENV=dev HELPMETEST_CLUSTER=dev-local helpmetest health "web-app" "10m"
```

##### Database Cluster Monitoring

```bash
# Primary database
helpmetest health "db-primary" "2m" "psql -h db-primary.example.com -c 'SELECT 1'"

# Read replicas
helpmetest health "db-replica-1" "2m" "psql -h db-replica-1.example.com -c 'SELECT 1'"
helpmetest health "db-replica-2" "2m" "psql -h db-replica-2.example.com -c 'SELECT 1'"

# Replication lag check
helpmetest health "db-replication-lag" "5m" "psql -h db-primary.example.com -c 'SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0 ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) END'"
```

##### Load Balancer Health Checks

```bash
# Check each backend server
helpmetest health "backend-1" "1m" "GET http://backend-1.internal:8080/health"
helpmetest health "backend-2" "1m" "GET http://backend-2.internal:8080/health"
helpmetest health "backend-3" "1m" "GET http://backend-3.internal:8080/health"

# Check load balancer itself
helpmetest health "load-balancer" "1m" "GET http://lb.example.com/health"
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

## Troubleshooting

#### Debug Mode

```bash
# Enable debug output
DEBUG=1 helpmetest health "test" "1m"

# Check system metrics
helpmetest metrics

# Verify configuration
helpmetest --help
```

#### False Positive Alerts

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

#### Missing Heartbeats

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

#### Command Execution Issues

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
### Best Practices

#### Choosing Grace Periods

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


## Need Help?

If you encounter any issues or have questions about using HelpMeTest, please reach out to us via email at 
[contact@helpmetest.com](mailto:contact@helpmetest.com)

For development documentation, build instructions, and contribution guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).
