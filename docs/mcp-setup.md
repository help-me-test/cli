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

- **"status API"** - checks system status
- **"check https://always-up.test.helpmetest.com"** - health check URL  
- **"system metrics"** - CPU/memory/disk usage
- **"health status"** - all health checks status

## Test It

Ask your AI: **"status API"**

Should return CPU, memory, disk usage, uptime.

---

That's it. No elaborate prompts needed.