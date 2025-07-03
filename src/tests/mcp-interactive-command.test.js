/**
 * MCP Interactive Robot Framework Command Tests
 * 
 * Tests the interactive Robot Framework command functionality that allows
 * executing single commands for debugging and test development.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP Interactive Robot Framework Command Tests', () => {
  // Skip integration tests in CI environment
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    test.skip('Skipping integration tests in CI environment', () => {})
    return
  }

  let client
  let transport

  beforeEach(async () => {
    // Start MCP server
    const serverPath = path.resolve(__dirname, '../index.js')
    
    transport = new StdioClientTransport({
      command: 'bun',
      args: [serverPath, 'mcp'],
      env: {
        ...process.env,
      }
    })

    client = new Client({
      name: 'interactive-command-test',
      version: getVersion()
    }, {
      capabilities: {}
    })

    await client.connect(transport)
  }, 30000)

  afterEach(async () => {
    if (client && transport) {
      await client.close()
    }
  })

  test('should register interactive command tool', async () => {
    const tools = await client.listTools()
    
    const interactiveTool = tools.tools.find(tool => 
      tool.name === 'helpmetest_run_interactive_command'
    )
    
    expect(interactiveTool).toBeDefined()
    expect(interactiveTool.description).toContain('Execute a single Robot Framework command interactively')
    // Note: inputSchema is a Zod schema object, not a plain object with properties
    expect(interactiveTool.inputSchema).toBeDefined()
  })

  test('should register interactive debugging prompt', async () => {
    const prompts = await client.listPrompts()
    
    const debugPrompt = prompts.prompts.find(prompt => 
      prompt.name === 'helpmetest_interactive_debugging'
    )
    
    expect(debugPrompt).toBeDefined()
    expect(debugPrompt.description).toContain('Guide for using interactive Robot Framework commands')
  })

  test('should handle interactive command tool call with basic parameters', async () => {
    const result = await client.callTool({
      name: 'helpmetest_run_interactive_command',
      arguments: {
        command: 'Get Title',
        line: 1
      }
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content.length).toBeGreaterThan(0)
    
    const content = result.content[0]
    expect(content.type).toBe('text')
    
    // The response should contain information about the command execution
    expect(content.text).toContain('Get Title')
  })

  test('should handle interactive command with custom session ID', async () => {
    const customSessionId = 'test-session-123'
    
    const result = await client.callTool({
      name: 'helpmetest_run_interactive_command',
      arguments: {
        command: 'Go To    https://example.com',
        line: 0,
        sessionId: customSessionId
      }
    })
    
    expect(result).toBeDefined()
    expect(result.content[0].text).toContain('Go To')
    expect(result.content[0].text).toContain('https://example.com')
  })

  test('should handle Exit command', async () => {
    const sessionId = 'exit-test-session'
    
    const result = await client.callTool({
      name: 'helpmetest_run_interactive_command',
      arguments: {
        command: 'Exit',
        sessionId: sessionId
      }
    })
    
    expect(result).toBeDefined()
    expect(result.content[0].text).toContain('Exit')
  })

  test('should generate interactive debugging prompt', async () => {
    const result = await client.getPrompt('helpmetest_interactive_debugging', {
      debug_scenario: 'browser_automation',
      target_url: 'https://test.example.com'
    })
    
    expect(result).toBeDefined()
    expect(result.messages).toBeDefined()
    expect(Array.isArray(result.messages)).toBe(true)
    expect(result.messages.length).toBeGreaterThan(0)
    
    const message = result.messages[0]
    expect(message.role).toBe('user')
    expect(message.content.type).toBe('text')
    expect(message.content.text).toContain('Interactive Robot Framework Debugging Guide')
    expect(message.content.text).toContain('browser_automation')
    expect(message.content.text).toContain('https://test.example.com')
  })

  test('should generate prompt with different scenarios', async () => {
    const scenarios = ['browser_automation', 'api_testing', 'element_interaction']
    
    for (const scenario of scenarios) {
      const result = await client.getPrompt('helpmetest_interactive_debugging', {
        debug_scenario: scenario
      })
      
      expect(result.messages[0].content.text).toContain(scenario.toUpperCase())
    }
  })

  test('should handle missing optional parameters gracefully', async () => {
    // Test with minimal parameters
    const result = await client.callTool({
      name: 'helpmetest_run_interactive_command',
      arguments: {
        command: 'Get Title'
      }
    })
    
    expect(result).toBeDefined()
    expect(result.content[0].text).toContain('Get Title')
  })
})