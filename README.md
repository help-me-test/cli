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

# Set up AI integration
helpmetest install mcp YOUR-API-TOKEN
```

## 📚 Documentation

For complete documentation, commands, and features, visit:

**[📖 HelpMeTest CLI Documentation](https://helpmetest.helpmetest.com/docs#tags=features%3Acli)**

## 🆘 Support

- **Issues**: GitHub issues for bugs and feature requests
- **Email**: contact@helpmetest.com
