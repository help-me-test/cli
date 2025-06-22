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

## 🤖 MCP - AI Integration

MCP adds AI integration to the HelpMeTest CLI. It is configured with a simple setup and works out of the box. See [MCP Setup](docs/mcp-setup.md) for instructions and [MCP Real AI Examples](mcp-real-ai-examples.md) for practical usage.

## � Commands

### Health Check
```bash
helpmetest health <name> <grace_period> [check_command]
```

**Examples:**
```bash
# Basic health check
helpmetest health "my-service" "5m"

# HTTP endpoint check
helpmetest health "api" "1m" "GET localhost:3000/health"

# Port monitoring
helpmetest health "db" "30s" "PORT 5432"

# Command execution
helpmetest health "backup" "1h" "CMD ./backup.sh"
```

### Other Commands
```bash
helpmetest status    # View system status
helpmetest metrics   # View metrics
helpmetest --version # Check CLI version
```

## 🔧 Configuration

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `HELPMETEST_API_TOKEN` | ✅ | Your HelpMeTest API token |
| `ENV` | ❌ | Environment (dev/staging/prod) |
| `HELPMETEST_*` | ❌ | Custom metrics |
| `DEBUG` | ❌ | Enable debug output |

### Setup
```bash
export HELPMETEST_API_TOKEN="your-token-here"
export ENV="production"  # Optional
```

## 📚 Documentation

- **[Installation Guide](docs/installation.md)** - Detailed installation options
- **[Usage Guide](docs/usage.md)** - Commands and syntax
- **[Health Check Patterns](docs/health-checks.md)** - Best practices and troubleshooting
- **[Integration Examples](docs/integrations.md)** - Docker, Kubernetes, cron jobs
- **[MCP Setup](docs/mcp-setup.md)** - AI editor integration
- **[Development Guide](docs/DEVELOPMENT.md)** - Build and contribution guide
- **[MCP Real AI Examples](mcp-real-ai-examples.md)** - Real AI examples for MCP

## 🧪 Testing

- **[Test Suite](tests/)** - Python and JavaScript tests
- **[Examples](examples/)** - Working examples and configurations

## 🆘 Support

- **Issues**: GitHub issues for bugs and feature requests
- **Email**: contact@helpmetest.com
- **Debug**: Use `DEBUG=1 helpmetest health "test" "1m"` for troubleshooting
