# HelpMeTest CLI Documentation

Welcome to the HelpMeTest CLI documentation. This page provides links to all available documentation and guides.

## 📖 Documentation Index

### Getting Started
- **[Installation Guide](installation.md)** - Installation methods, setup, and verification
- **[Usage Guide](usage.md)** - Commands, syntax, and basic examples
- **[Quick Start](../README.md#quick-start)** - Get up and running in minutes

### Health Checks
- **[Health Check Guide](health-checks.md)** - Comprehensive guide to health check patterns, troubleshooting, and best practices
- **[Grace Period Formats](health-checks.md#grace-period-formats)** - Supported time formats for health check intervals
- **[System Metrics](health-checks.md#system-metrics)** - Automatic system metrics collection
- **[Troubleshooting](health-checks.md#troubleshooting)** - Debug mode, common issues, and solutions

### Integration Guides
- **[Integration Examples](integrations.md)** - Docker, Kubernetes, and orchestration examples
- **[Cron Job Monitoring](integrations.md#cron-job-monitoring)** - Scheduled task monitoring
- **[Docker Integration](integrations.md#docker-integration)** - Container health checks
- **[Kubernetes Integration](integrations.md#kubernetes-integration)** - K8s deployments, CronJobs, and service monitoring
- **[MCP Setup](mcp-setup.md)** - Model Context Protocol integration with AI editors

### Development & Deployment
- **[Development Guide](DEVELOPMENT.md)** - Development setup, build process, and local testing

## 🔍 Quick Reference

### Common Commands
```bash
# Basic health check
helpmetest health "service-name" "grace-period"

# HTTP endpoint check
helpmetest health "api" "1m" "GET localhost:3000/health"

# Command execution
helpmetest health "backup" "2h" "backup-script.sh"

# View status
helpmetest status

# Debug mode
DEBUG=1 helpmetest health "test" "1m"
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `HELPMETEST_API_TOKEN` | ✅ | Your HelpMeTest API token |
| `ENV` | ❌ | Environment (dev/staging/prod) |
| `HELPMETEST_*` | ❌ | Custom metrics |
| `DEBUG` | ❌ | Enable debug output |

## 🧪 Testing

- **[Test Suite](../tests/)** - Unit tests and integration tests
- **[Examples](../examples/)** - Working examples and sample configurations
- **[Test Documentation](../tests/README.md)** - How to run and add tests

## 🆘 Support & Help

### Getting Help
- **Email**: [contact@helpmetest.com](mailto:contact@helpmetest.com)
- **Issues**: Report bugs and feature requests via GitHub issues
- **Documentation Issues**: Please report any documentation problems or suggestions

### Troubleshooting
1. Check the [Health Check Guide](health-checks.md#troubleshooting)
2. Enable debug mode: `DEBUG=1 helpmetest health "test" "1m"`
3. Verify your API token and environment variables
4. Test commands manually before automating

---

*Last updated: December 2024*