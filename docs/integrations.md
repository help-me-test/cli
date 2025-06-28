# Integration Examples

This guide covers integration patterns for various platforms and orchestration tools.

## Table of Contents

- [Cron Job Monitoring](#cron-job-monitoring)
- [Docker Integration](#docker-integration)
- [Kubernetes Integration](#kubernetes-integration)
- [Advanced Scenarios](#advanced-scenarios)

## Cron Job Monitoring

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

## Docker Integration

### Basic Docker Health Check

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

### Docker Compose with Health Checks

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

## Kubernetes Integration

### Add API Secret

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

### Pod with Health Check

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

### Deployment with Health Checks

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

### CronJob with Health Check

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

### Service Monitor with Health Check

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

## Advanced Scenarios

### Multi-Environment Setup

```bash
# Production environment
ENV=production HELPMETEST_CLUSTER=prod-us-east-1 helpmetest health "web-app" "1m"

# Staging environment
ENV=staging HELPMETEST_CLUSTER=staging-us-west-2 helpmetest health "web-app" "5m"

# Development environment
ENV=dev HELPMETEST_CLUSTER=dev-local helpmetest health "web-app" "10m"
```

### Database Cluster Monitoring

```bash
# Primary database
helpmetest health "db-primary" "2m" "psql -h db-primary.example.com -c 'SELECT 1'"

# Read replicas
helpmetest health "db-replica-1" "2m" "psql -h db-replica-1.example.com -c 'SELECT 1'"
helpmetest health "db-replica-2" "2m" "psql -h db-replica-2.example.com -c 'SELECT 1'"

# Replication lag check
helpmetest health "db-replication-lag" "5m" "psql -h db-primary.example.com -c 'SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0 ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()) END'"
```

### Load Balancer Health Checks

```bash
# Check each backend server
helpmetest health "backend-1" "1m" "GET http://backend-1.internal:8080/health"
helpmetest health "backend-2" "1m" "GET http://backend-2.internal:8080/health"
helpmetest health "backend-3" "1m" "GET http://backend-3.internal:8080/health"

# Check load balancer itself
helpmetest health "load-balancer" "1m" "GET http://lb.example.com/health"
```