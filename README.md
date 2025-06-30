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

Transform your AI assistant into a powerful monitoring and testing companion! The HelpMeTest MCP server enables natural language interaction with your infrastructure.

### What You Can Do
- **Health Monitoring**: "How is my server doing?" → Get CPU, memory, disk usage
- **Service Checks**: "Check if https://myapp.com is working" → Real-time health checks  
- **Test Management** ✨ NEW: "Run all uptime tests" → Execute test suites with AI analysis
- **Test Discovery** ✨ NEW: "What tests do I have?" → Discover and organize your tests

### Quick Setup
1. Install CLI: `curl -fsSL https://helpmetest.com/install | bash`
2. Add to your AI editor config: `["helpmetest", "mcp", "YOUR-TOKEN"]`
3. Ask your AI: "What tests do I have available?"

See [MCP Setup](docs/mcp-setup.md) for detailed instructions and [MCP Test Management](docs/mcp-test-management.md) for the new test execution capabilities.

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
helpmetest health "db" "30s" ":5432"

# File age check
helpmetest health "logs" "5m" "file-updated 2m /var/log/app.log"

# Multiple checks in one command
helpmetest health "app" "5m" "GET /health" "file-updated 1m /var/log/app.log"

# Command execution
helpmetest health "backup" "1h" "bash ./backup.sh"
```

### Test Commands
```bash
helpmetest test list                    # List all available tests
helpmetest test list --verbose          # List tests with detailed info
helpmetest test run "/docs"             # Run specific test by name
helpmetest test run "tag:uptime"        # Run all tests with tag
helpmetest test run "tag:flaky"         # Run flaky tests
```

### Keywords Commands
```bash
helpmetest keywords                     # List all available Robot Framework libraries
helpmetest keywords "click"             # Search for keywords containing "click"
helpmetest keywords --type libraries    # Show only libraries
helpmetest keywords --verbose           # Show detailed documentation
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
| `HELPMETEST_API_URL` | ❌ | API base URL (defaults to https://helpmetest.com) |
| `ENV` | ❌ | Environment (dev/staging/prod) |
| `HELPMETEST_*` | ❌ | Custom metrics |
| `DEBUG` | ❌ | Enable debug output |

### Setup Options

**Option 1: Environment Variables**
```bash
export HELPMETEST_API_TOKEN="your-token-here"
export ENV="production"  # Optional
```

**Option 2: .env File** (Recommended for development)
```bash
# Create .env file in your project directory
cp .env.example .env
# Edit .env with your actual tokens
```

### Configuration Priority
1. **Environment variables** (highest priority)
2. **`.env` file** in current directory
3. **Default values**

### 🛡️ API Isolation

**Critical Feature**: Health check exit codes are determined ONLY by your command execution, not by API connectivity.

- ✅ **Service healthy + API down** → Exit code 0 (success)
- ❌ **Service unhealthy + API down** → Exit code 1 (failure) 
- ⚠️ **API issues logged as warnings** without affecting health check results

This ensures container orchestrators (Kubernetes, Docker) get accurate health status regardless of HelpMeTest API availability.

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
