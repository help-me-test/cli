/**
 * Simple HTTP Transport Tests for MCP Server
 * 
 * Tests just the HTTP endpoints without MCP client connection
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP HTTP Simple Tests', () => {
  let serverProcess
  const testPort = 31339 // Use different port

  beforeAll(async () => {
    // Set up environment variables for the test
    process.env.HELPMETEST_API_TOKEN = 'HELP-test-token-for-simple-http'
    process.env.HELPMETEST_API_URL = 'https://helpmetest.com'
  })

  beforeEach(async () => {
    // Start the MCP server process with HTTP transport
    const serverPath = path.resolve(__dirname, '../index.js')
    
    serverProcess = spawn('bun', [serverPath, 'mcp', 'HELP-test-token-for-simple-http', '--sse', '--port', testPort.toString()], {
      env: {
        ...process.env,
        HELPMETEST_API_TOKEN: 'HELP-test-token-for-simple-http',
        HELPMETEST_API_URL: 'https://helpmetest.com'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'))
      }, 10000)

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString()
        if (output.includes(`server started on http://localhost:${testPort}`) || 
            output.includes(`SSE endpoint: http://localhost:${testPort}/sse`)) {
          clearTimeout(timeout)
          resolve()
        }
      })

      serverProcess.stderr.on('data', (data) => {
        console.error('Server stderr:', data.toString())
      })

      serverProcess.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    // Give server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000))
  }, 15000)

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      
      // Wait for process to exit
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve)
        setTimeout(() => {
          serverProcess.kill('SIGKILL')
          resolve()
        }, 5000)
      })
    }
  })

  describe('HTTP Endpoints', () => {
    test('should respond to health check endpoint', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('status', 'ok')
      expect(data).toHaveProperty('timestamp')
      expect(new Date(data.timestamp)).toBeInstanceOf(Date)
    })

    test('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`http://localhost:${testPort}/unknown`)
      expect(response.status).toBe(404)
      
      const text = await response.text()
      expect(text).toBe('Not Found')
    })

    test('should have SSE endpoint available', async () => {
      // SSE endpoint should accept GET requests but might close connection immediately
      // We just test that it doesn't return 404
      try {
        const response = await fetch(`http://localhost:${testPort}/sse`, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        })
        // SSE endpoint should not return 404
        expect(response.status).not.toBe(404)
      } catch (error) {
        // Connection might be closed, but that's expected for SSE without proper handshake
        expect(error.code).toBe('ConnectionClosed')
      }
    })
  })
})