# Simple MCP Prompts That Actually Work

These are the exact prompts you can use with your AI assistant once the MCP server is set up.

## Working Prompts

### "status API"
Returns system metrics: CPU, memory, hostname, platform info.

**What you get:**
```json
{
  "hostname": "MacBook-Pro.local",
  "platform": {"arch": "arm64", "platform": "darwin"},
  "cpu_usage": 23.5,
  "memory_usage": 45.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### "check https://always-up.test.helpmetest.com"
Health check any URL.

**What you get:**
```json
{
  "url": "https://always-up.test.helpmetest.com",
  "healthy": true,
  "responseTime": 156,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### "system metrics"
Same as "status API" - returns current system performance.

### "health status"
Shows all configured health checks.

**What you get:**
```json
{
  "total": 3,
  "checks": [
    {"name": "web-app", "status": "up", "lastCheck": "..."},
    {"name": "api", "status": "up", "lastCheck": "..."}
  ]
}
```

## That's It

No complex prompts needed. Just ask your AI these simple questions and it will use the MCP server to get real data.

## Test Your Setup

Ask your AI: **"status API"**

If it returns CPU/memory data, you're good to go!