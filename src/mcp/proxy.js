/**
 * Proxy MCP Tool
 * Single tool for proxy tunneling to expose local servers to public URLs
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import {
  listProxies as cliListProxies,
  startProxy as cliStartProxy,
  stopProxy as cliStopProxy,
  stopAllProxies as cliStopAllProxies
} from '../commands/proxy.js'

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
      return await listProxies()
    case 'stop':
      return await stopProxy(domain)
    case 'stop_all':
      return await stopAllProxies()
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

  try {
    const target = `${domain}:${port}`
    const options = { domain, port, background: true }
    if (name) options.name = name

    const result = await cliStartProxy(target, options)

    return {
      content: [{
        type: 'text',
        text: `✅ **Proxy Started**

**Public URL:** https://${domain}
**Local Server:** localhost:${port}
**Name:** ${result.name}`
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

async function listProxies() {
  try {
    const tunnels = await cliListProxies({ returnData: true })

    if (!tunnels || tunnels.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `📋 **No Active Proxies**

Use the helpmetest_proxy tool with action "start" to create a tunnel.`
        }]
      }
    }

    const tunnelList = tunnels.map((tunnel, i) =>
      `${i + 1}. **${tunnel.domain}** → localhost:${tunnel.port}
   Name: ${tunnel.name}${tunnel.created_at ? `
   Created: ${new Date(tunnel.created_at).toLocaleString()}` : ''}`
    ).join('\n\n')

    return {
      content: [{
        type: 'text',
        text: `✅ **Active Proxies (${tunnels.length})**

${tunnelList}`
      }]
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Failed to List Proxies**\n\n${error.message}`
      }],
      isError: true
    }
  }
}

async function stopProxy(domain) {
  if (!domain) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Domain Required**\n\nProvide the domain to stop (e.g., "dev.local"). Use action "list" to see active proxies.`
      }],
      isError: true
    }
  }

  try {
    await cliStopProxy(domain)
    return {
      content: [{
        type: 'text',
        text: `✅ **Proxy Stopped:** ${domain}`
      }]
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Failed to Stop Proxy**\n\n${error.message}`
      }],
      isError: true
    }
  }
}

async function stopAllProxies() {
  try {
    await cliStopAllProxies()
    return {
      content: [{
        type: 'text',
        text: `✅ **All Proxies Stopped**`
      }]
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ **Failed to Stop Proxies**\n\n${error.message}`
      }],
      isError: true
    }
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
- **stop**: Stop a proxy by domain
- **stop_all**: Stop all proxies

**Example:** Start proxy for localhost:3000
- action: "start"
- port: 3000
- domain: "myapp.dev.local" (optional)

🚨 **INSTRUCTION FOR AI:** Use this tool when users want to test local development servers with HelpMeTest.`,
      inputSchema: {
        action: z.enum(['start', 'list', 'stop', 'stop_all']).describe('Action to perform'),
        port: z.number().optional().describe('Local port to proxy (required for start)'),
        domain: z.string().optional().default('dev.local').describe('Domain for public URL (required for stop)'),
        name: z.string().optional().describe('Proxy name (optional for start)')
      },
    },
    async (args) => {
      debug(config, `Proxy tool called: ${JSON.stringify(args)}`)
      return await handleProxy(args)
    }
  )
}
