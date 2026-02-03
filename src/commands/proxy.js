/**
 * Proxy Command - Proxy public URLs to localhost using frp (Fast Reverse Proxy)
 *
 * Commands:
 * - helpmetest proxy start :3000 [--name mydev]
 * - helpmetest proxy start dev.local:3000 [--name mydev]
 * - helpmetest proxy start --domain dev.local --port 3000 [--name mydev]
 * - helpmetest proxy list
 */

import { output } from '../utils/colors.js'
import { spawnFrpc } from './frpc.js'
import { config } from '../utils/config.js'

// Global cleanup registry
const cleanupHandlers = []
let isShuttingDown = false
let signalHandlersRegistered = false

function registerCleanup(handler) {
  cleanupHandlers.push(handler)
}

async function runCleanup() {
  if (isShuttingDown) return
  isShuttingDown = true

  console.error('[DEBUG] Running cleanup handlers...')
  await Promise.all(
    cleanupHandlers.map(handler =>
      handler().catch(err => console.error('[DEBUG] Cleanup handler error:', err.message))
    )
  )
  process.exit(0)
}

function ensureSignalHandlers() {
  if (signalHandlersRegistered) return
  signalHandlersRegistered = true

  process.on('SIGINT', () => {
    console.error('[DEBUG] SIGINT received')
    runCleanup()
  })

  process.on('SIGTERM', () => {
    console.error('[DEBUG] SIGTERM received')
    runCleanup()
  })

  console.error('[DEBUG] Signal handlers registered')
}

/**
 * Register tunnel with proxy server via HTTP GET
 * Returns frp_token and frp_server_port for frpc connection
 */
async function registerTunnel(proxyUrl, domain, name, port) {
  const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
  if (!token) {
    throw new Error('No API token found. Run: helpmetest login')
  }

  const url = `${proxyUrl}/tunnels/register?domain=${domain}&name=${name}&port=${port}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }

  const data = await response.json()
  output.success(`Tunnel registered: ${domain} -> localhost:${port}`)

  return {
    frpToken: data.frp_token,
    frpServerPort: data.frp_server_port
  }
}

/**
 * Parse proxy target from various formats
 */
function parseProxyTarget(target, options) {
  let domain = options.domain
  let port = options.port

  if (target) {
    if (target.startsWith(':')) {
      port = parseInt(target.substring(1))
      domain = domain || 'dev.local'
    } else if (target.includes(':')) {
      const parts = target.split(':')
      domain = parts[0]
      port = parseInt(parts[1])
    } else {
      domain = target
      if (!port) {
        output.error('Port is required. Use format :3000 or dev.local:3000')
        process.exit(1)
      }
    }
  }

  if (!domain) {
    domain = 'dev.local'
  }
  if (!port) {
    output.error('Port is required')
    process.exit(1)
  }

  return { domain, port }
}

/**
 * Check if a port is listening on localhost
 */
async function isPortListening(port) {
  const net = await import('net')
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(1000)

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })

    socket.on('error', () => {
      resolve(false)
    })

    socket.connect(port, '127.0.0.1')
  })
}

/**
 * Start proxy tunnel using frpc
 */
export async function startProxy(target, options = {}) {
  const { domain, port } = parseProxyTarget(target, options)
  const { background = false } = options

  // Get user info to extract company and proxy URL
  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()
  const company = userInfo.activeCompany || userInfo.companyName
  const proxyUrl = userInfo.proxyUrl
  const serverAddr = new URL(proxyUrl).hostname

  output.info(`Starting tunnel: ${domain} -> localhost:${port}`)
  output.info(`Connecting to ${proxyUrl}...`)

  // Check if port is listening
  const portIsListening = await isPortListening(port)
  if (!portIsListening) {
    output.warning(`Warning: Nothing is listening on localhost:${port}`)
    output.warning(`Tunnel will be established, but requests will fail until you start a server on port ${port}`)
  }

  // Use company-domain format for name - same domain = same proxy name
  const name = options.name || `${company}-${domain.replace(/\./g, '-')}`

  // Register tunnel with proxy server first
  let frpToken, frpServerPort
  try {
    const registration = await registerTunnel(proxyUrl, domain, name, port)
    frpToken = registration.frpToken
    frpServerPort = registration.frpServerPort
    output.success(`Proxying ${domain} -> localhost:${port}`)
  } catch (err) {
    output.error(`Failed to register tunnel: ${err?.message || err || 'Unknown error'}`)
    process.exit(1)
  }

  // If background mode, just return after registration
  if (background) {
    return { domain, port, name }
  }

  let frpc
  let localShutdown = false

  // Cleanup task: kill frpc process
  const killFrpc = async () => {
    if (!frpc || localShutdown) return
    console.error(`[DEBUG] Killing frpc for ${domain}`)
    frpc.kill('SIGTERM')
  }

  // Cleanup task: deregister tunnel from server
  const deregisterTunnel = async () => {
    if (localShutdown) return
    localShutdown = true

    const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
    if (!token) return

    console.error(`[DEBUG] Deregistering tunnel ${domain}`)
    try {
      await fetch(`${proxyUrl}/tunnels/deregister?domain=${domain}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      console.error(`[DEBUG] Deregistered ${domain}`)
    } catch (err) {
      console.error(`[DEBUG] Failed to deregister ${domain}:`, err.message)
    }
  }

  // Register cleanup tasks and ensure signal handlers are set up
  registerCleanup(killFrpc)
  registerCleanup(deregisterTunnel)
  ensureSignalHandlers()

  // Spawn frpc with retry logic for router conflicts
  let retryCount = 0
  const maxRetries = 3

  while (retryCount <= maxRetries) {
    frpc = await spawnFrpc({
      serverAddr,
      serverPort: frpServerPort,
      auth: {
        method: 'token',
        token: frpToken
      },
      proxies: [{
        name,
        type: 'http',
        localIP: '127.0.0.1',
        localPort: port,
        customDomains: [domain]
      }]
    }, {
      stdio: 'pipe'
    })

    let frpcOutput = ''

    // Pipe stdout/stderr to process and collect output
    const collectOutput = async (stream, target) => {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const str = new TextDecoder().decode(value)
          frpcOutput += str
          target.write(str)
        }
      } finally {
        reader.releaseLock()
      }
    }

    // Start collecting output in background
    collectOutput(frpc.stdout, process.stdout)
    collectOutput(frpc.stderr, process.stderr)

    // Wait for process to exit
    const exitCode = await frpc.exited

    if (exitCode === 0) {
      console.error('[DEBUG] frpc exited normally, cleaning up')
      await runCleanup()
    }

    // Check if it's a router config conflict
    if (frpcOutput.includes('router config conflict') && retryCount < maxRetries) {
      retryCount++
      output.warning(`Router conflict detected, waiting for old proxy to disconnect... (attempt ${retryCount}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 3000))
      continue
    }

    output.error(`frpc exited with code ${exitCode}`)
    await runCleanup()
  }
}

/**
 * Run a fake HTTP server for testing
 */
export async function runFakeServer(options) {
  const port = options.port || 37331
  const http = await import('http')

  const server = http.createServer((req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo App - HelpMeTest Tutorial</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
      background: #000000;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(12px);
      border: 1.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      max-width: 600px;
      text-align: center;
    }
    h1 {
      color: rgba(255, 255, 255, 0.95);
      margin: 0 0 16px 0;
      font-size: 2.5em;
      font-weight: 600;
    }
    p {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.2em;
      margin: 0 0 32px 0;
      font-weight: 400;
    }
    .badge {
      display: inline-block;
      background: rgba(90, 255, 40, 0.1);
      color: #5aff28;
      border: 1px solid rgba(90, 255, 40, 0.3);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9em;
      font-weight: 600;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .button {
      background: #5aff28;
      color: #000000;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 1.1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 20px rgba(90, 255, 40, 0.2);
    }
    .button:hover {
      background: #4ee620;
      box-shadow: 0 0 30px rgba(90, 255, 40, 0.4);
      transform: scale(1.02);
    }
    .info {
      margin-top: 32px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      font-size: 0.9em;
      color: rgba(255, 255, 255, 0.6);
    }
    .info strong {
      color: rgba(255, 255, 255, 0.9);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">HelpMeTest Tutorial</div>
    <h1>Welcome! 👋</h1>
    <p>This is a demo app running on localhost:${port}</p>
    <button class="button" onclick="alert('Button clicked! This action can be tested with Robot Framework.')">
      Click Me
    </button>
    <div class="info">
      <strong>Tutorial Step:</strong> Now run tests against this local server using HelpMeTest!
    </div>
  </div>
  <script>
    console.log('Demo app loaded on port ${port}')
  </script>
</body>
</html>`

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  })

  server.listen(port, '127.0.0.1', () => {
    output.success(`Fake server running on http://localhost:${port}`)
    output.info('Press Ctrl+C to stop')
  })

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    output.info('Stopping fake server...')
    server.close()
    process.exit(0)
  })

  // Handle termination
  process.on('SIGTERM', () => {
    server.close()
    process.exit(0)
  })

  return server
}

/**
 * List active proxy tunnels
 */
export async function listProxies(options = {}) {
  const { returnData = false } = options
  const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
  if (!token) {
    throw new Error('No API token found. Run: helpmetest login')
  }

  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()
  const proxyUrl = userInfo.proxyUrl

  if (!returnData) {
    output.info('Listing active proxy tunnels...')
  }

  try {
    const response = await fetch(`${proxyUrl}/tunnels/list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const data = await response.json()

    if (returnData) {
      return data.tunnels || []
    }

    if (!data.tunnels || data.tunnels.length === 0) {
      output.info('No active tunnels found')
      return
    }

    output.success(`Found ${data.tunnels.length} active tunnel(s):\n`)

    data.tunnels.forEach((tunnel, i) => {
      console.log(`${i + 1}. ${tunnel.domain} -> localhost:${tunnel.port}`)
      console.log(`   Name: ${tunnel.name}`)
      if (tunnel.created_at) {
        console.log(`   Created: ${new Date(tunnel.created_at).toLocaleString()}`)
      }
      console.log()
    })
  } catch (err) {
    output.error(`Failed to list tunnels: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Stop a proxy tunnel by domain
 */
export async function stopProxy(domain) {
  const fs = await import('fs')
  const os = await import('os')
  const pidFile = `${os.tmpdir()}/helpmetest-proxy-${domain.replace(/\./g, '-')}.pid`

  output.info(`Stopping tunnel for ${domain}...`)

  // Kill the parent proxy process - its cleanup handler will kill frpc and deregister
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'))
    process.kill(pid, 'SIGTERM')
    output.success(`Stopped proxy for ${domain}`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      output.error(`No proxy running for ${domain}`)
    } else if (err.code === 'ESRCH') {
      output.warning(`Proxy process not found, cleaning up PID file`)
      try { fs.unlinkSync(pidFile) } catch {}
    } else {
      output.error(`Failed to stop proxy: ${err.message}`)
    }
    process.exit(1)
  }
}

/**
 * Stop all proxy tunnels
 */
export async function stopAllProxies() {
  const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
  if (!token) {
    throw new Error('No API token found. Run: helpmetest login')
  }

  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()
  const proxyUrl = userInfo.proxyUrl

  output.info('Stopping all tunnels...')

  try {
    // First get list of active tunnels
    const listResponse = await fetch(`${proxyUrl}/tunnels/list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!listResponse.ok) {
      const error = await listResponse.json()
      throw new Error(error.error || `HTTP ${listResponse.status}`)
    }

    const data = await listResponse.json()

    if (!data.tunnels || data.tunnels.length === 0) {
      output.info('No active tunnels to stop')
      return
    }

    // Stop each tunnel
    for (const tunnel of data.tunnels) {
      const response = await fetch(`${proxyUrl}/tunnels/deregister?domain=${tunnel.domain}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        output.warning(`Failed to stop ${tunnel.domain}: ${error.error}`)
      } else {
        output.success(`Stopped ${tunnel.domain}`)
      }
    }

    output.success(`Stopped ${data.tunnels.length} tunnel(s)`)
  } catch (err) {
    output.error(`Failed to stop tunnels: ${err.message}`)
    process.exit(1)
  }
}

// Export command object for CLI
const proxyCommand = {
  start: startProxy,
  list: listProxies,
  stop: stopProxy,
  'stop-all': stopAllProxies,
  'run-fake-server': runFakeServer
}

export default proxyCommand
