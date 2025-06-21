# HelpMeTest CLI

A command-line tool for monitoring services and sending health check heartbeats to HelpMeTest.

## 🚀 Quick Start

```bash
# Install
curl -fsSL https://helpmetest.com/install | bash

# Set your API token
export HELPMETEST_API_TOKEN="your-token-here"

# Send a health check
helpmetest health "my-service" "5m"

# Check HTTP endpoint
helpmetest health "api" "1m" "GET localhost:3000/health"

# Monitor port
helpmetest health "db" "30s" "PORT 5432"

# Run command
helpmetest health "backup" "1h" "CMD ./backup.sh"
```

## ✨ Features

- **HTTP/HTTPS monitoring** with custom headers and status codes
- **Port availability** checking
- **Command execution** monitoring
- **System metrics** collection (CPU, memory, disk)
- **Flexible timing** (seconds, minutes, hours, days)
- **Environment support** (dev/staging/prod)

## 📚 Documentation

- **[Complete Documentation](docs/README.md)** - Full guides and examples
- **[Installation Guide](docs/installation.md)** - Detailed installation options
- **[Usage Guide](docs/usage.md)** - Commands and syntax
- **[Health Check Patterns](docs/health-checks.md)** - Best practices and troubleshooting
- **[Integration Examples](docs/integrations.md)** - Docker, Kubernetes, cron jobs

## 🔧 Configuration

Set your API token:
```bash
export HELPMETEST_API_TOKEN="your-token-here"
```

## 🆘 Support

- **Documentation**: [docs/README.md](docs/README.md)
- **Issues**: GitHub issues
- **Email**: contact@helpmetest.com