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

# Install skills (AI agent workflows)
helpmetest install skills
```

## 🆓 Free QA Skills (no signup)

Standalone QA diagnostic skills for Claude Code and 18 other AI agents — SSL certs, DNS/email auth (SPF/DKIM/DMARC), accessibility, Core Web Vitals, auth-flow hygiene, and more. No account, no API keys:

```bash
npx skills add help-me-test/free-qa-skills
```

Source: [github.com/help-me-test/free-qa-skills](https://github.com/help-me-test/free-qa-skills) · Directory: [skills.sh/help-me-test/free-qa-skills](https://www.skills.sh/help-me-test/free-qa-skills)

## 📚 Documentation

For complete documentation, commands, and features, visit:

**[📖 HelpMeTest CLI Documentation](https://helpmetest.helpmetest.com/docs#tags=features%3Acli)**

## 🆘 Support

- **Issues**: GitHub issues for bugs and feature requests
- **Email**: contact@helpmetest.com
