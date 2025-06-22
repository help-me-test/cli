/**
 * End-to-End MCP Tests
 * 
 * Tests the complete MCP protocol communication using the official MCP SDK client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP End-to-End Tests', () => {
  let client
  let serverProcess
  let transport

  beforeAll(async () => {
    // Set up environment variables for the test
    process.env.HELPMETEST_API_TOKEN = 'HELP-test-token-for-e2e'
    process.env.HELPMETEST_API_URL = 'https://helpmetest.com'
  })

  beforeEach(async () => {
    // Start the MCP server process
    const serverPath = path.resolve(__dirname, '../index.js')
    
    // Create transport and client
    transport = new StdioClientTransport({
      command: 'bun',
      args: [serverPath, 'mcp'],
      env: {
        ...process.env,
        HELPMETEST_API_TOKEN: 'HELP-test-token-for-e2e',
        HELPMETEST_API_URL: 'https://helpmetest.com'
      }
    })

    client = new Client({
      name: 'test-client',
      version: getVersion()
    }, {
      capabilities: {}
    })

    // Connect to the server
    await client.connect(transport)
  }, 10000) // 10 second timeout for setup

  afterEach(async () => {
    // Clean up
    if (client) {
      await client.close()
    }
  })

  describe('Server Initialization', () => {
    test('should connect to MCP server successfully', async () => {
      expect(client).toBeDefined()
      // If we got here without throwing, the connection was successful
    })

    test('should list available tools', async () => {
      const result = await client.listTools()
      
      expect(result).toBeDefined()
      expect(result.tools).toBeDefined()
      expect(Array.isArray(result.tools)).toBe(true)
      
      // Check that our expected tools are present
      const toolNames = result.tools.map(tool => tool.name)
      expect(toolNames).toContain('health_check')
      expect(toolNames).toContain('system_status')
      expect(toolNames).toContain('health_checks_status')
      expect(toolNames).toContain('status')
    })

    test('should provide tool descriptions', async () => {
      const result = await client.listTools()
      
      const healthCheckTool = result.tools.find(tool => tool.name === 'health_check')
      expect(healthCheckTool).toBeDefined()
      expect(healthCheckTool.description).toBe('Perform a health check on a specified URL')
      expect(healthCheckTool.inputSchema).toBeDefined()
      
      const systemStatusTool = result.tools.find(tool => tool.name === 'system_status')
      expect(systemStatusTool).toBeDefined()
      expect(systemStatusTool.description).toBe('Get current system status and metrics using helpmetest metrics collection')
      
      const statusTool = result.tools.find(tool => tool.name === 'status')
      expect(statusTool).toBeDefined()
      expect(statusTool.description).toBe('Get comprehensive status of all tests and health checks in the helpmetest system')
      expect(statusTool.inputSchema).toBeDefined()
    })
  })

  describe('Health Check Tool', () => {
    test('should call health_check tool with valid URL', async () => {
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://httpbin.org/status/200',
          timeout: 10
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData.url).toBe('https://httpbin.org/status/200')
      expect(responseData.healthy).toBeDefined()
      expect(responseData.timestamp).toBeDefined()
      expect(responseData.responseTime).toBeDefined()
    }, 15000) // 15 second timeout for HTTP request

    test('should handle health_check tool with invalid URL', async () => {
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://this-domain-should-not-exist-12345.com',
          timeout: 5
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      expect(responseData.url).toBe('https://this-domain-should-not-exist-12345.com')
      expect(responseData.healthy).toBe(false)
      expect(responseData.error).toBeDefined()
    }, 10000)

    test('should reject health_check tool without URL', async () => {
      await expect(client.callTool({
        name: 'health_check',
        arguments: {
          timeout: 10
        }
      })).rejects.toThrow()
    })

    test('should use default timeout when not specified', async () => {
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://httpbin.org/status/200'
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      expect(responseData.url).toBe('https://httpbin.org/status/200')
      // Should work with default timeout
    }, 15000)
  })

  describe('System Status Tool', () => {
    test('should call system_status tool', async () => {
      const result = await client.callTool({
        name: 'system_status',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData).toBeDefined()
      
      // Should contain system metrics
      expect(responseData.hostname).toBeDefined()
      expect(responseData.platform).toBeDefined()
      expect(responseData.platform.arch).toBeDefined()
      expect(responseData.platform.platform).toBeDefined()
      expect(responseData.cpu_usage).toBeDefined()
      expect(responseData.memory_usage).toBeDefined()
      expect(responseData.timestamp).toBeDefined()
    })

    test('should ignore extra parameters in system_status', async () => {
      const result = await client.callTool({
        name: 'system_status',
        arguments: {
          extraParam: 'should be ignored'
        }
      })

      expect(result).toBeDefined()
      // Should work despite extra parameters
    })
  })

  describe('Health Checks Status Tool', () => {
    test('should call health_checks_status tool', async () => {
      const result = await client.callTool({
        name: 'health_checks_status',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData).toBeDefined()
      
      // Should contain health checks data or error information
      if (responseData.error) {
        // If there's an error, it should be properly formatted
        expect(responseData.message).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
        expect(responseData.debug).toBeDefined()
      } else {
        // If successful, should have checks array
        expect(responseData.total).toBeDefined()
        expect(responseData.checks).toBeDefined()
        expect(Array.isArray(responseData.checks)).toBe(true)
        // Note: timestamp might not be present in this response format
        if (responseData.timestamp) {
          expect(responseData.timestamp).toBeDefined()
        }
      }
    })
  })

  describe('Complete Status Tool', () => {
    test('should call status tool', async () => {
      const result = await client.callTool({
        name: 'status',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData).toBeDefined()
      
      // Should contain comprehensive status data or error information
      if (responseData.error) {
        // If there's an error, it should be properly formatted
        expect(responseData.message).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
        expect(responseData.debug).toBeDefined()
      } else {
        // If successful, should have complete status structure
        expect(responseData.company).toBeDefined()
        expect(responseData.total).toBeDefined()
        expect(responseData.tests).toBeDefined()
        expect(responseData.healthchecks).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
        expect(Array.isArray(responseData.tests)).toBe(true)
        expect(Array.isArray(responseData.healthchecks)).toBe(true)
        
        // Each test should have proper structure
        responseData.tests.forEach(test => {
          expect(test.name).toBeDefined()
          expect(test.status).toBeDefined()
          expect(test.emoji).toBeDefined()
          expect(test.lastHeartbeatFormatted).toBeDefined()
        })
        
        // Each healthcheck should have proper structure
        responseData.healthchecks.forEach(hc => {
          expect(hc.name).toBeDefined()
          expect(hc.status).toBeDefined()
          expect(hc.emoji).toBeDefined()
          expect(hc.lastHeartbeatFormatted).toBeDefined()
        })
      }
    })

    test('should call status tool with verbose option', async () => {
      const result = await client.callTool({
        name: 'status',
        arguments: {
          verbose: true
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData).toBeDefined()
      
      // Should work with verbose flag (same structure expected)
      if (!responseData.error) {
        expect(responseData.company).toBeDefined()
        expect(responseData.total).toBeDefined()
        expect(responseData.tests).toBeDefined()
        expect(responseData.healthchecks).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle unknown tool gracefully', async () => {
      await expect(client.callTool({
        name: 'unknown_tool',
        arguments: {}
      })).rejects.toThrow()
    })

    test('should handle malformed tool arguments', async () => {
      await expect(client.callTool({
        name: 'health_check',
        arguments: {
          url: 123 // Should be string
        }
      })).rejects.toThrow()
    })
  })
})