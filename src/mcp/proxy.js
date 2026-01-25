/**
 * Proxy MCP Tool
 * Single tool for proxy tunneling to expose local servers to public URLs
 */

import { z } from 'zod'
import { spawn } from 'child_process'
import { config, debug } from '../utils/config.js'

// Store active proxy processes
const activeProxies = new Map()

/**
 * Handle proxy tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} Proxy result
 */
async function handleProxy(args) {
  const { action, port, domain = 'dev.local', name } = args

  debug(config, `MCP: Proxy action=${action} domain=${domain} port=${port}`)

  switch (action) {
    case 'start':
      return await startProxy({ port, domain, name })
    case 'list':
      return listProxies()
    case 'stop':
      return stopProxy(name)
    case 'stop_all':
      return stopAllProxies()
    default:
      return {
        content: [{
          type: 'text',
          text: `❌ Unknown action: ${action}\n\nValid actions: start, list, stop, stop_all`
        }],
        isError: true
      }
  }
}

async function startProxy({ port, domain, name }) {
  if (!port) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Port Required**\n\nPlease provide a port number to proxy.`
      }],
      isError: true
    }
  }

  const proxyKey = name || `${domain}:${port}`

  if (activeProxies.has(proxyKey)) {
    const existing = activeProxies.get(proxyKey)
    return {
      content: [{
        type: 'text',
        text: `⚠️ **Proxy Already Running**

**Name:** ${proxyKey}
**Public URL:** https://${existing.domain}
**Local Port:** ${existing.port}

Use action "stop" to stop it first.`
      }]
    }
  }

  try {
    const cmdArgs = ['proxy', 'start', `${domain}:${port}`]
    if (name) cmdArgs.push('--name', name)

    const proc = spawn('helpmetest', cmdArgs, {
      stdio: 'pipe',
      detached: true,
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
      debug(config, `[proxy] ${data.toString()}`)
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      debug(config, `[proxy] ${data.toString()}`)
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

    if (proc.exitCode !== null && proc.exitCode !== 0) {
      throw new Error(`Proxy failed: ${stderr || stdout}`)
    }

    activeProxies.set(proxyKey, {
      name: proxyKey,
      domain,
      port,
      process: proc,
      startedAt: new Date().toISOString()
    })

    proc.on('exit', () => activeProxies.delete(proxyKey))

    return {
      content: [{
        type: 'text',
        text: `✅ **Proxy Started**

**Public URL:** https://${domain}
**Local Server:** localhost:${port}
**Name:** ${proxyKey}`
      }]
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Failed to Start Proxy**\n\n${error.message}`
      }],
      isError: true
    }
  }
}

function listProxies() {
  if (activeProxies.size === 0) {
    return {
      content: [{
        type: 'text',
        text: `📋 **No Active Proxies**\n\nUse action "start" with port to create one.`
      }]
    }
  }

  const proxies = Array.from(activeProxies.values())
  const list = proxies.map(p => `- **${p.name}**: https://${p.domain} → localhost:${p.port}`).join('\n')

  return {
    content: [{
      type: 'text',
      text: `📋 **Active Proxies (${proxies.length})**\n\n${list}`
    }]
  }
}

function stopProxy(name) {
  if (!name) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Name Required**\n\nProvide the proxy name to stop. Use action "list" to see names.`
      }],
      isError: true
    }
  }

  if (!activeProxies.has(name)) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Proxy Not Found:** ${name}\n\nUse action "list" to see active proxies.`
      }],
      isError: true
    }
  }

  const proxy = activeProxies.get(name)
  if (proxy.process && !proxy.process.killed) {
    proxy.process.kill('SIGTERM')
  }
  activeProxies.delete(name)

  return {
    content: [{
      type: 'text',
      text: `✅ **Proxy Stopped:** ${name}`
    }]
  }
}

function stopAllProxies() {
  if (activeProxies.size === 0) {
    return {
      content: [{
        type: 'text',
        text: `📋 **No Active Proxies**`
      }]
    }
  }

  const count = activeProxies.size
  for (const [, proxy] of activeProxies) {
    if (proxy.process && !proxy.process.killed) {
      proxy.process.kill('SIGTERM')
    }
  }
  activeProxies.clear()

  return {
    content: [{
      type: 'text',
      text: `✅ **Stopped ${count} Proxy(s)**`
    }]
  }
}

/**
 * Register proxy MCP tool
 * @param {Object} server - MCP server instance
 */
export function registerProxyTools(server) {
  server.registerTool(
    'helpmetest_proxy',
    {
      title: 'Help Me Test: Proxy Tunnel',
      description: `Manage proxy tunnels to expose local servers to public URLs.

**Actions:**
- **start**: Start proxy (requires port, optional domain/name)
- **list**: List active proxies
- **stop**: Stop a proxy by name
- **stop_all**: Stop all proxies

**Example:** Start proxy for localhost:3000
- action: "start"
- port: 3000
- domain: "myapp.dev.local" (optional)

🚨 **INSTRUCTION FOR AI:** Use this tool when users want to test local development servers with HelpMeTest.`,
      inputSchema: {
        action: z.enum(['start', 'list', 'stop', 'stop_all']).describe('Action to perform'),
        port: z.number().optional().describe('Local port to proxy (required for start)'),
        domain: z.string().optional().default('dev.local').describe('Domain for public URL'),
        name: z.string().optional().describe('Proxy name (for start/stop)')
      },
    },
    async (args) => {
      debug(config, `Proxy tool called: ${JSON.stringify(args)}`)
      return await handleProxy(args)
    }
  )
}
