# HelpMeTest MCP Server - Quick Setup

## Install & Setup (2 minutes)

1. **Install CLI:**
   ```bash
   curl -fsSL https://helpmetest.com/install | bash
   ```

2. **Get token:** Visit [helpmetest.com](https://helpmetest.com) → get `HELP-abc123...` token

3. **Add to your AI editor:**

### Cursor
Settings → Features → Model Context Protocol → Add Server:
```json
{
  "name": "helpmetest",
  "command": "helpmetest", 
  "args": ["mcp", "HELP-your-token-here"]
}
```

### Zed  
Settings.json:
```json
{
  "context_servers": {
    "helpmetest": {
      "command": "helpmetest",
      "args": ["mcp", "HELP-your-token-here"]
    }
  }
}
```

### Claude Desktop
`~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "helpmetest": {
      "command": "helpmetest",
      "args": ["mcp", "HELP-your-token-here"]
    }
  }
}
```

## What Works

Simple prompts that actually work:

### Health & System Monitoring
### Health & System Monitoring
- **"status API"** - compreomprehensivensive system status
- **"check https://always-up.test.helpmetest.com"** - health check URL  
- **"system metrics"** - CPU/memory/disk usage
- **"health status"** - all health checks status

### Test Management ✨ NEW
- **"what tests do I have"** - list all available tests
- **"run uptime tests"** - execute tests by tag
- **"run the Google search test"** - execute specific test by name
- **"execute test abc123"** - run test by ID
- **"run all critical tests"** - execute tagged test suites

## Test It

### Basic Test
Ask your AI: **"status API"**
Should return CPU, memory, disk usage, uptime.

### Test Management ✨ NEW
Ask your AI: **"what tests do I have available?"**
Should list all your configured tests with IDs, names, and tags.

Then try: **"run uptime tests"**
Should execute all tests tagged with 'uptime' and show results.

### Test Management ✨ NEW
Ask your AI: **"what tests do I have available?"**
Should list all your configured tests with IDs, names, and tags.

Then try: **"run uptime tests"**
Should execute all tests tagged with 'uptime' and show results.

---

That's it. No elaborate prompts needed.