/**
 * E2E Tests for Simple MCP Prompts
 * 
 * Tests the actual simple prompts that users would type to their AI assistants
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Simple MCP Prompts E2E Tests', () => {
  let client
  let transport

  beforeEach(async () => {
    // Set up environment
    process.env.HELPMETEST_API_TOKEN = 'HELP-test-token-for-simple-prompts'
    process.env.HELPMETEST_API_URL = 'https://helpmetest.com'
    
    // Start MCP server
    const serverPath = path.resolve(__dirname, '../index.js')
    
    transport = new StdioClientTransport({
      command: 'bun',
      args: [serverPath, 'mcp'],
      env: {
        ...process.env,
        HELPMETEST_API_TOKEN: 'HELP-test-token-for-simple-prompts',
        HELPMETEST_API_URL: 'https://helpmetest.com'
      }
    })

    client = new Client({
      name: 'simple-prompts-test',
      version: getVersion()
    }, {
      capabilities: {}
    })

    await client.connect(transport)
  }, 10000)

  afterEach(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('Simple Prompt: "status API"', () => {
    test('should return system status when asked for "status API"', async () => {
      // This simulates what happens when user says "status API" to their AI
      const result = await client.callTool({
        name: 'system_status',
        arguments: {}
      })
      
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.content[0]).toBeDefined()
      expect(result.content[0].text).toBeDefined()
      
      const status = JSON.parse(result.content[0].text)
      
      // Should contain system metrics (actual format from API)
      expect(status).toHaveProperty('hostname')
      expect(status).toHaveProperty('platform')
      expect(status).toHaveProperty('cpu_usage')
      expect(status).toHaveProperty('memory_usage')
      expect(status).toHaveProperty('timestamp')
      
      // Platform should have arch and platform
      expect(status.platform).toHaveProperty('arch')
      expect(status.platform).toHaveProperty('platform')
      
      // CPU and memory usage should be numbers
      expect(typeof status.cpu_usage).toBe('number')
      expect(typeof status.memory_usage).toBe('number')
    })
  })

  describe('Simple Prompt: "check https://always-up.test.helpmetest.com"', () => {
    test('should check URL health when asked to check test endpoint', async () => {
      // This simulates what happens when user says "check https://always-up.test.helpmetest.com"
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://always-up.test.helpmetest.com'
        }
      })
      
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.content[0]).toBeDefined()
      expect(result.content[0].text).toBeDefined()
      
      const healthCheck = JSON.parse(result.content[0].text)
      
      // Should contain health check results (actual format from API)
      expect(healthCheck).toHaveProperty('url')
      expect(healthCheck).toHaveProperty('healthy')
      expect(healthCheck).toHaveProperty('timestamp')
      expect(healthCheck).toHaveProperty('responseTime')
      
      expect(healthCheck.url).toBe('https://always-up.test.helpmetest.com')
      expect(healthCheck.healthy).toBe(true)
      expect(typeof healthCheck.responseTime).toBe('number')
    })
  })

  describe('Simple Prompt: "system metrics"', () => {
    test('should return system metrics when asked for "system metrics"', async () => {
      // This simulates what happens when user says "system metrics"
      const result = await client.callTool({
        name: 'system_status',
        arguments: {}
      })
      
      expect(result).toBeDefined()
      const status = JSON.parse(result.content[0].text)
      
      // Should have all the metrics a user would expect (actual format)
      expect(status).toHaveProperty('hostname')
      expect(status).toHaveProperty('cpu_usage')
      expect(status).toHaveProperty('memory_usage')
      expect(status).toHaveProperty('timestamp')
      
      // Values should be reasonable
      expect(status.cpu_usage).toBeGreaterThanOrEqual(0)
      expect(status.cpu_usage).toBeLessThanOrEqual(100)
      expect(status.memory_usage).toBeGreaterThanOrEqual(0)
      expect(status.memory_usage).toBeLessThanOrEqual(100)
    })
  })

  describe('Simple Prompt: "health status"', () => {
    test('should return health checks status when asked for "health status"', async () => {
      // This simulates what happens when user says "health status"
      const result = await client.callTool({
        name: 'health_checks_status',
        arguments: {}
      })
      
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.content[0]).toBeDefined()
      expect(result.content[0].text).toBeDefined()
      
      const healthStatus = JSON.parse(result.content[0].text)
      
      // Should contain health checks overview (actual format from API)
      if (healthStatus.error) {
        // If there's an error, it should be properly formatted
        expect(healthStatus.message).toBeDefined()
        expect(healthStatus.timestamp).toBeDefined()
      } else {
        // If successful, should have checks data
        expect(healthStatus.total).toBeDefined()
        expect(healthStatus.checks).toBeDefined()
        expect(Array.isArray(healthStatus.checks)).toBe(true)
        expect(typeof healthStatus.total).toBe('number')
      }
    })
  })

  describe('Error Handling for Simple Prompts', () => {
    test('should handle invalid URL gracefully', async () => {
      // User says "check invalid-url" 
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'not-a-url'
        }
      })
      
      const healthCheck = JSON.parse(result.content[0].text)
      // Should return error response, not throw
      expect(healthCheck.healthy).toBe(false)
      expect(healthCheck.error).toBeDefined()
    })

    test('should handle missing URL parameter', async () => {
      // User says "check" without URL
      await expect(client.callTool({
        name: 'health_check',
        arguments: {}
      })).rejects.toThrow()
    })
  })

  describe('Real-world URL Tests', () => {
    test('should check always-up test endpoint successfully', async () => {
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://always-up.test.helpmetest.com'
        }
      })
      
      const healthCheck = JSON.parse(result.content[0].text)
      expect(healthCheck.healthy).toBe(true)
      expect(healthCheck.url).toBe('https://always-up.test.helpmetest.com')
    })

    test('should handle non-existent endpoint', async () => {
      const result = await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://does-not-exist.test.helpmetest.com'
        }
      })
      
      const healthCheck = JSON.parse(result.content[0].text)
      // Should detect the failure
      expect(healthCheck.healthy).toBe(false)
    })
  })

  describe('Performance Tests', () => {
    test('should complete system status check quickly', async () => {
      const startTime = Date.now()
      
      await client.callTool({
        name: 'system_status',
        arguments: {}
      })
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should complete health check within reasonable time', async () => {
      const startTime = Date.now()
      
      await client.callTool({
        name: 'health_check',
        arguments: {
          url: 'https://always-up.test.helpmetest.com',
          timeout: 10
        }
      })
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(15000) // Should complete within 15 seconds
    })
  })
})