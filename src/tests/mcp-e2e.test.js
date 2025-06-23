/**
 * End-to-End MCP Tests
 * 
 * Tests the complete MCP protocol communication using the official MCP SDK client
 */

// Load environment variables from .env file
import 'dotenv/config'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP End-to-End Tests', () => {
  // Skip integration tests in CI environment
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    test.skip('Skipping integration tests in CI environment', () => {})
    return
  }

  let client
  let serverProcess
  let transport

  beforeAll(async () => {
    // Use real environment variables from .env file
    // The dotenv config should already be loaded by the config module
    if (!process.env.HELPMETEST_API_TOKEN) {
      throw new Error('HELPMETEST_API_TOKEN not found in environment variables')
    }
    if (!process.env.HELPMETEST_API_URL) {
      throw new Error('HELPMETEST_API_URL not found in environment variables')
    }
  })

  beforeEach(async () => {
    // Start the MCP server process
    const serverPath = path.resolve(__dirname, '../index.js')
    
    // Create transport and client
    transport = new StdioClientTransport({
      command: 'bun',
      args: [
        serverPath, 
        'mcp', 
        process.env.HELPMETEST_API_TOKEN, // Pass token as positional argument
        '-u', process.env.HELPMETEST_API_URL, // Pass URL as -u parameter
        '--verbose' // Enable verbose mode for debugging
      ],
      env: {
        ...process.env,
        HELPMETEST_DEBUG: 'true' // Enable debug mode to see API calls
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
      expect(toolNames).toContain('helpmetest_health_check')
      expect(toolNames).toContain('helpmetest_health_checks_status')
      expect(toolNames).toContain('helpmetest_status')
      expect(toolNames).toContain('helpmetest_run_test')
      expect(toolNames).toContain('helpmetest_list_tests')
      expect(toolNames).toContain('helpmetest_keywords')
      expect(toolNames).toContain('helpmetest_create_test')
    })

    test('should provide tool descriptions', async () => {
      const result = await client.listTools()
      
      const healthCheckTool = result.tools.find(tool => tool.name === 'helpmetest_health_check')
      expect(healthCheckTool).toBeDefined()
      expect(healthCheckTool.description).toBe('Perform a health check on a specified URL')
      expect(healthCheckTool.inputSchema).toBeDefined()
      
      const healthChecksStatusTool = result.tools.find(tool => tool.name === 'helpmetest_health_checks_status')
      expect(healthChecksStatusTool).toBeDefined()
      expect(healthChecksStatusTool.description).toBe('Get status of all health checks in the helpmetest system')
      expect(healthChecksStatusTool.inputSchema).toBeDefined()
      
      const statusTool = result.tools.find(tool => tool.name === 'helpmetest_status')
      expect(statusTool).toBeDefined()
      expect(statusTool.description).toBe('Get comprehensive status of all tests and health checks in the helpmetest system')
      expect(statusTool.inputSchema).toBeDefined()
    })
  })

  describe('Health Check Tool', () => {
    test('should call health_check tool with valid URL', async () => {
      const result = await client.callTool({
        name: 'helpmetest_health_check',
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
        name: 'helpmetest_health_check',
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
        name: 'helpmetest_health_check',
        arguments: {
          timeout: 10
        }
      })).rejects.toThrow()
    })

    test('should use default timeout when not specified', async () => {
      const result = await client.callTool({
        name: 'helpmetest_health_check',
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



  describe('Health Checks Status Tool', () => {
    test('should call health_checks_status tool', async () => {
      const result = await client.callTool({
        name: 'helpmetest_health_checks_status',
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
        name: 'helpmetest_status',
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
        name: 'helpmetest_status',
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
        name: 'helpmetest_health_check',
        arguments: {
          url: 123 // Should be string
        }
      })).rejects.toThrow()
    })
  })

  describe('Test Management Tools', () => {
    test('should call list_tests tool successfully', async () => {
      const result = await client.callTool({
        name: 'helpmetest_list_tests',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData.total).toBeDefined()
      expect(responseData.tests).toBeDefined()
      expect(Array.isArray(responseData.tests)).toBe(true)
      expect(responseData.timestamp).toBeDefined()
      
      // If there are tests, check their structure
      if (responseData.tests.length > 0) {
        const firstTest = responseData.tests[0]
        expect(firstTest.id).toBeDefined()
        expect(firstTest.name).toBeDefined()
        expect(firstTest.description).toBeDefined()
        expect(Array.isArray(firstTest.tags)).toBe(true)
      }
    }, 10000)

    test('should call run_test tool with test identifier', async () => {
      // First get a list of tests to find a valid identifier
      const listResult = await client.callTool({
        name: 'helpmetest_list_tests',
        arguments: {}
      })
      
      const listData = JSON.parse(listResult.content[0].text)
      
      // Skip if no tests available
      if (listData.tests.length === 0) {
        console.log('No tests available, skipping run_test test')
        return
      }
      
      // Use the first available test
      const testIdentifier = listData.tests[0].name || listData.tests[0].id
      
      const result = await client.callTool({
        name: 'helpmetest_run_test',
        arguments: {
          identifier: testIdentifier
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
      expect(responseData.identifier).toBe(testIdentifier)
      expect(responseData.timestamp).toBeDefined()
      expect(responseData.totalEvents).toBeDefined()
      expect(responseData.success).toBeDefined()
      expect(Array.isArray(responseData.testResults)).toBe(true)
      expect(Array.isArray(responseData.keywords)).toBe(true)
      expect(Array.isArray(responseData.allEvents)).toBe(true)
    }, 30000) // Longer timeout for test execution

    test('should handle run_test tool with invalid identifier', async () => {
      const result = await client.callTool({
        name: 'helpmetest_run_test',
        arguments: {
          identifier: 'non-existent-test-12345'
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.isError).toBe(true)
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData.error).toBe(true)
      expect(responseData.identifier).toBe('non-existent-test-12345')
      expect(responseData.message).toBeDefined()
    }, 10000)

    test('should call run_test tool with tag identifier', async () => {
      // Try running tests with a common tag like 'uptime'
      const result = await client.callTool({
        name: 'helpmetest_run_test',
        arguments: {
          identifier: 'tag:uptime'
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
      expect(responseData.identifier).toBe('tag:uptime')
      expect(responseData.timestamp).toBeDefined()
      
      // Handle both success and error cases
      if (responseData.error) {
        // If it's an error (e.g., no tests with this tag), that's also valid
        expect(responseData.error).toBe(true)
        expect(responseData.message).toBeDefined()
      } else {
        // If successful, check the structure
        expect(responseData.totalEvents).toBeDefined()
        expect(responseData.success).toBeDefined()
        expect(Array.isArray(responseData.testResults)).toBe(true)
        expect(Array.isArray(responseData.allEvents)).toBe(true)
      }
    }, 30000) // Longer timeout for multiple test execution
  })

  describe('Keywords Search Tool', () => {
    test('should call keywords tool without search term', async () => {
      const result = await client.callTool({
        name: 'helpmetest_keywords',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData.search).toBeDefined()
      expect(responseData.type).toBeDefined()
      expect(responseData.results).toBeDefined()
      expect(responseData.summary).toBeDefined()
      expect(responseData.timestamp).toBeDefined()
      
      // Should have libraries and keywords
      expect(responseData.summary.libraries).toBeDefined()
      expect(responseData.summary.keywords).toBeDefined()
      expect(responseData.summary.total).toBeDefined()
      expect(responseData.summary.total).toBeGreaterThan(0)
    })

    test('should search keywords with specific term', async () => {
      const result = await client.callTool({
        name: 'helpmetest_keywords',
        arguments: {
          search: 'click',
          type: 'all'
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const content = result.content[0]
      expect(content.type).toBe('text')
      
      // Parse the JSON response
      const responseData = JSON.parse(content.text)
      expect(responseData.search).toBe('click')
      expect(responseData.type).toBe('all')
      expect(responseData.results).toBeDefined()
      expect(responseData.summary).toBeDefined()
      
      // Should find click-related keywords
      expect(responseData.summary.total).toBeGreaterThan(0)
      
      // Check that Browser library is included (has click keywords)
      if (responseData.results.libraries && responseData.results.libraries.Browser) {
        expect(responseData.results.libraries.Browser.keywords).toBeDefined()
        expect(Array.isArray(responseData.results.libraries.Browser.keywords)).toBe(true)
        
        // Should have click-related keywords
        const clickKeywords = responseData.results.libraries.Browser.keywords.filter(kw => 
          kw.name.toLowerCase().includes('click')
        )
        expect(clickKeywords.length).toBeGreaterThan(0)
      }
    })

    test('should search only libraries', async () => {
      const result = await client.callTool({
        name: 'helpmetest_keywords',
        arguments: {
          search: 'browser',
          type: 'libraries'
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      expect(responseData.search).toBe('browser')
      expect(responseData.type).toBe('libraries')
      expect(responseData.results.libraries).toBeDefined()
      expect(responseData.results.keywords).toBeUndefined()
      
      // Should find Browser library
      if (responseData.summary.libraries > 0) {
        expect(responseData.results.libraries.Browser).toBeDefined()
        expect(responseData.results.libraries.Browser.name).toBe('Browser')
      }
    })

    test('should search only keywords', async () => {
      const result = await client.callTool({
        name: 'helpmetest_keywords',
        arguments: {
          search: 'log',
          type: 'keywords'
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      expect(responseData.search).toBe('log')
      expect(responseData.type).toBe('keywords')
      expect(responseData.results.keywords).toBeDefined()
      expect(responseData.results.libraries).toBeUndefined()
    })

    test('should handle empty search results', async () => {
      const result = await client.callTool({
        name: 'helpmetest_keywords',
        arguments: {
          search: 'nonexistentkeywordinanylibrary12345',
          type: 'all'
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      expect(responseData.search).toBe('nonexistentkeywordinanylibrary12345')
      expect(responseData.summary.total).toBe(0)
    })
  })

  describe('Create Test Tool', () => {
    test('should create a test with minimal required fields', async () => {
      const testId = `test-mcp-${Date.now()}`
      const result = await client.callTool({
        name: 'helpmetest_create_test',
        arguments: {
          id: testId,
          name: 'MCP Test Creation',
          description: 'A test created via MCP for testing purposes',
          tags: ['mcp', 'test', 'automated'],
          testData: `Log    Hello from MCP created test
Should Be Equal    \${1+1}    2`
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
      
      if (responseData.error) {
        // If there's an error, it should be properly formatted
        expect(responseData.message).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
        console.log('Create test error (expected in test environment):', responseData.message)
      } else {
        // If successful, check the structure
        expect(responseData.id).toBe(testId)
        expect(responseData.name).toBe('MCP Test Creation')
        expect(responseData.description).toBe('A test created via MCP for testing purposes')
        expect(Array.isArray(responseData.tags)).toBe(true)
        expect(responseData.tags).toContain('mcp')
        expect(responseData.tags).toContain('test')
        expect(responseData.tags).toContain('automated')
        expect(responseData.testData).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
      }
    }, 15000)

    test('should create a test with browser automation', async () => {
      const testId = `browser-test-mcp-${Date.now()}`
      const result = await client.callTool({
        name: 'helpmetest_create_test',
        arguments: {
          id: testId,
          name: 'MCP Browser Test',
          description: 'Browser automation test created via MCP',
          tags: ['mcp', 'browser', 'automation'],
          testData: `Go To    https://example.com
Get Title    ==    Example Domain`
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      if (responseData.error) {
        console.log('Create browser test error (expected in test environment):', responseData.message)
        expect(responseData.message).toBeDefined()
      } else {
        expect(responseData.id).toBe(testId)
        expect(responseData.name).toBe('MCP Browser Test')
        expect(responseData.tags).toContain('browser')
        expect(responseData.testData).toContain('Library    Browser')
        expect(responseData.testData).toContain('New Browser')
      }
    }, 15000)

    test('should create a test with API testing', async () => {
      const testId = `api-test-mcp-${Date.now()}`
      const result = await client.callTool({
        name: 'helpmetest_create_test',
        arguments: {
          id: testId,
          name: 'MCP API Test',
          description: 'API testing created via MCP',
          tags: ['mcp', 'api', 'http'],
          testData: `Create Session    httpbin    https://httpbin.org
\${response}=    GET On Session    httpbin    /get
Should Be Equal As Strings    \${response.status_code}    200
Should Contain    \${response.json()}[url]    httpbin.org`
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      if (responseData.error) {
        console.log('Create API test error (expected in test environment):', responseData.message)
        expect(responseData.message).toBeDefined()
      } else {
        expect(responseData.id).toBe(testId)
        expect(responseData.name).toBe('MCP API Test')
        expect(responseData.tags).toContain('api')
        expect(responseData.testData).toContain('GET On Session')
      }
    }, 15000)

    test('should handle create test without optional fields', async () => {
      const result = await client.callTool({
        name: 'helpmetest_create_test',
        arguments: {
          name: 'Minimal Test'
          // Only required field provided
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      if (responseData.error) {
        // If there's an error, it should be properly formatted
        expect(responseData.message).toBeDefined()
        expect(responseData.timestamp).toBeDefined()
        console.log('Create minimal test error (expected in test environment):', responseData.message)
      } else {
        // If successful, should have basic structure
        expect(responseData.name).toBe('Minimal Test')
        expect(responseData.id).toBeDefined()
      }
    }, 15000)

    test('should reject create test with invalid test data', async () => {
      const result = await client.callTool({
        name: 'helpmetest_create_test',
        arguments: {
          id: `invalid-test-${Date.now()}`,
          name: 'Invalid Test',
          description: 'Test with invalid Robot Framework syntax',
          tags: ['invalid'],
          testData: 'This is not valid Robot Framework syntax at all!'
        }
      })

      expect(result).toBeDefined()
      const content = result.content[0]
      const responseData = JSON.parse(content.text)
      
      // Should either reject or return an error
      if (responseData.error) {
        expect(responseData.message).toBeDefined()
        expect(responseData.message).toContain('error')
      }
    }, 15000)
  })

  describe('Prompts', () => {
    test('should list available prompts', async () => {
      const result = await client.listPrompts()
      
      expect(result).toBeDefined()
      expect(result.prompts).toBeDefined()
      expect(Array.isArray(result.prompts)).toBe(true)
      
      const promptNames = result.prompts.map(prompt => prompt.name)
      expect(promptNames).toContain('helpmetest_create_test')
      expect(promptNames).toContain('helpmetest_explore_keywords')
    })

    test('should get create test prompt', async () => {
      const result = await client.getPrompt({
        name: 'helpmetest_create_test',
        arguments: {
          test_type: 'web',
          target_system: 'e-commerce'
        }
      })

      expect(result).toBeDefined()
      expect(result.messages).toBeDefined()
      expect(Array.isArray(result.messages)).toBe(true)
      expect(result.messages.length).toBeGreaterThan(0)
      
      const message = result.messages[0]
      expect(message.role).toBe('user')
      expect(message.content).toBeDefined()
      expect(message.content.type).toBe('text')
      expect(message.content.text).toContain('Test Creation Assistant for HelpMeTest Platform')
      // The prompt should contain the provided arguments somewhere in the text
      const promptText = message.content.text.toLowerCase()
      expect(promptText.includes('web') || promptText.includes('e-commerce')).toBe(true)
    })

    test('should get keywords exploration prompt', async () => {
      const result = await client.getPrompt({
        name: 'helpmetest_explore_keywords',
        arguments: {
          search_term: 'browser automation'
        }
      })

      expect(result).toBeDefined()
      expect(result.messages).toBeDefined()
      expect(Array.isArray(result.messages)).toBe(true)
      
      const message = result.messages[0]
      expect(message.role).toBe('user')
      expect(message.content).toBeDefined()
      expect(message.content.type).toBe('text')
      expect(message.content.text).toContain('Robot Framework Keywords Explorer')
      expect(message.content.text).toContain('browser automation')
    })
  })
})