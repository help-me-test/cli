/**
 * Proxy Command - Proxy public URLs to localhost using frp (Fast Reverse Proxy)
 *
 * Commands:
 * - helpmetest proxy start :3000 [--name mydev]
 * - helpmetest proxy start dev.local:3000 [--name mydev]
 * - helpmetest proxy start --domain dev.local --port 3000 [--name mydev]
 * - helpmetest proxy list
 */

import { hostname } from 'os'
import { output } from '../utils/colors.js'
import { spawnFrpc } from './frpc.js'
import { config } from '../utils/config.js'

/**
 * Register tunnel with proxy server via HTTP GET
 * Returns frp_token and frp_server_port for frpc connection
 */
async function registerTunnel(serverAddr, serverPort, domain, name, port) {
  const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
  if (!token) {
    throw new Error('No API token found. Run: helpmetest login')
  }

  const url = `http://${serverAddr}:${serverPort}/tunnels/register?domain=${domain}&name=${name}&port=${port}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Registration failed: ${response.status}`)
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
export async function startProxy(target, options) {
  const { domain, port } = parseProxyTarget(target, options)

  // Get user info to extract company
  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()
  const company = userInfo.activeCompany || userInfo.companyName

  // Use public helpmetest proxy endpoint (works from anywhere)
  const serverAddr = 'proxy.helpmetest.com'
  const serverPort = 30888

  output.info(`Starting tunnel: ${domain} -> localhost:${port}`)
  output.info(`Connecting to ${serverAddr}:${serverPort}...`)

  // Check if port is listening
  const portIsListening = await isPortListening(port)
  if (!portIsListening) {
    output.warning(`Warning: Nothing is listening on localhost:${port}`)
    output.warning(`Tunnel will be established, but requests will fail until you start a server on port ${port}`)
  }

  // Use company-hostname format for name
  const name = options.name || `${company}-${hostname()}`

  // Register tunnel with proxy server first
  let frpToken, frpServerPort
  try {
    const registration = await registerTunnel(serverAddr, serverPort, domain, name, port)
    frpToken = registration.frpToken
    frpServerPort = registration.frpServerPort
    output.success(`Proxying ${domain} -> localhost:${port}`)
  } catch (err) {
    output.error(`Failed to register tunnel: ${err.message}`)
    process.exit(1)
  }

  // Spawn frpc using helper with unique token
  const frpc = await spawnFrpc({
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
    stdio: 'inherit'
  })

  frpc.on('error', (err) => {
    output.error(`Failed to start frpc: ${err.message}`)
    process.exit(1)
  })

  frpc.on('exit', (code) => {
    if (code !== 0) {
      output.error(`frpc exited with code ${code}`)
      process.exit(code)
    }
  })

  // Deregister on exit
  const deregister = async () => {
    try {
      const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
      if (token) {
        await fetch(`http://${serverAddr}:${serverPort}/tunnels/deregister?domain=${domain}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      }
    } catch (err) {
      // Ignore deregistration errors
    }
  }

  let isShuttingDown = false

  // Cleanup handler that runs synchronously
  const cleanup = () => {
    if (isShuttingDown) return
    isShuttingDown = true

    output.info('Stopping tunnel...')
    frpc.kill('SIGTERM')

    // Run deregister synchronously using a blocking approach
    const { execSync } = require('child_process')
    const token = config.apiToken || process.env.HELPMETEST_API_TOKEN
    if (token) {
      try {
        execSync(`curl -s -X GET "http://${serverAddr}:${serverPort}/tunnels/deregister?domain=${domain}" -H "Authorization: Bearer ${token}"`, {
          timeout: 5000,
          stdio: 'ignore'
        })
      } catch (err) {
        // Ignore deregistration errors
      }
    }
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })

  // Handle termination
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      text-align: center;
    }
    h1 {
      color: #333;
      margin: 0 0 16px 0;
      font-size: 2.5em;
    }
    p {
      color: #666;
      font-size: 1.2em;
      margin: 0 0 32px 0;
    }
    .badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9em;
      margin-bottom: 24px;
    }
    .button {
      background: #667eea;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 1.1em;
      cursor: pointer;
      transition: background 0.2s;
    }
    .button:hover {
      background: #5568d3;
    }
    .info {
      margin-top: 32px;
      padding: 16px;
      background: #f7fafc;
      border-radius: 8px;
      font-size: 0.9em;
      color: #666;
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
export async function listProxies() {
  output.info('Listing active proxy tunnels...')
  output.warning('List command not yet implemented')
  // TODO: Call frps API to list tunnels for this token
}

// Export command object for CLI
const proxyCommand = {
  start: startProxy,
  list: listProxies,
  'run-fake-server': runFakeServer
}

export default proxyCommand
