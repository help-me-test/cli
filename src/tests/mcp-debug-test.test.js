/**
 * MCP Debug Test Tool Tests
 * 
 * Tests the intelligent test debugging functionality that executes
 * Robot Framework keywords step by step for debugging purposes.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP Debug Test Tool Tests', () => {
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
      name: 'debug-test-tool-test',
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

  test('should debug simple keywords without test case structure', async () => {
    const testContent = `Go To    https://example.com
Get Title
Take Screenshot`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Simple Keywords Test',
        failureDescription: 'Testing basic navigation and screenshot'
      }
    })
    
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content.length).toBeGreaterThan(0)
    
    const content = result.content[0]
    expect(content.type).toBe('text')
    
    // Parse the response to check structure
    const response = JSON.parse(content.text)
    expect(response.sessionId).toBeDefined()
    expect(response.testName).toBe('Simple Keywords Test')
    expect(response.debugResult).toBeDefined()
    expect(response.debugResult.executedCommands).toBeDefined()
    expect(response.debugResult.status).toBeDefined()
    expect(response.summary).toBeDefined()
    expect(response.nextSteps).toBeDefined()
    
    // Should have executed 3 commands
    expect(response.debugResult.executedCommands.length).toBe(3)
    
    // Check that commands were executed in order
    const commands = response.debugResult.executedCommands
    expect(commands[0].command).toContain('Go To')
    expect(commands[1].command).toContain('Get Title')
    expect(commands[2].command).toContain('Take Screenshot')
  })

  test('should debug form interaction keywords', async () => {
    const testContent = `Go To    https://httpbin.org/forms/post
Type    name=custname    John Doe
Type    name=custtel    555-1234
Type    name=custemail    john@example.com
Select From List By Label    name=size    Medium
Click    css=input[type="submit"]`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Form Interaction Test'
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    expect(response.debugResult.executedCommands.length).toBe(6)
    expect(response.debugResult.status).toBeDefined()
    
    // Check that form interaction commands are present
    const commands = response.debugResult.executedCommands.map(cmd => cmd.command)
    expect(commands.some(cmd => cmd.includes('Type') && cmd.includes('custname'))).toBe(true)
    expect(commands.some(cmd => cmd.includes('Select From List'))).toBe(true)
    expect(commands.some(cmd => cmd.includes('Click'))).toBe(true)
  })

  test('should handle keywords with variables and comments', async () => {
    const testContent = `# Navigate to test page
Go To    https://example.com
# Wait for page to load
Wait For Load State    networkidle
# Get page information
\${title}=    Get Title
Log    Page title is: \${title}
# Take a screenshot for verification
Take Screenshot    page-loaded.png`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Keywords with Variables Test',
        startFromLine: 2  // Start from the first actual command
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    // Should execute commands starting from line 2
    expect(response.debugResult.executedCommands.length).toBeGreaterThan(0)
    
    // Check that variable assignment and logging commands are handled
    const commands = response.debugResult.executedCommands.map(cmd => cmd.command)
    expect(commands.some(cmd => cmd.includes('Get Title'))).toBe(true)
    expect(commands.some(cmd => cmd.includes('Log'))).toBe(true)
  })

  test('should handle debugging with custom session ID', async () => {
    const customSessionId = 'debug-session-123'
    const testContent = `Go To    https://example.com
Get Title`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Custom Session Test',
        sessionId: customSessionId
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    expect(response.sessionId).toBe(customSessionId)
    expect(response.debugResult.executedCommands.length).toBe(2)
  })

  test('should provide meaningful summary and next steps', async () => {
    const testContent = `Go To    https://example.com
Get Title`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Summary Test'
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    // Check summary structure
    expect(response.summary).toBeDefined()
    expect(response.summary.testName).toBe('Summary Test')
    expect(response.summary.totalCommands).toBe(2)
    expect(response.summary.status).toBeDefined()
    expect(response.summary.duration).toBeDefined()
    
    // Check next steps
    expect(response.nextSteps).toBeDefined()
    expect(Array.isArray(response.nextSteps)).toBe(true)
    expect(response.nextSteps.length).toBeGreaterThan(0)
    
    // Should contain helpful suggestions
    const nextStepsText = response.nextSteps.join(' ')
    expect(nextStepsText).toContain('helpmetest_run_interactive_command')
  })

  test('should handle empty or minimal test content', async () => {
    const testContent = `Get Title`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Minimal Test'
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    expect(response.debugResult.executedCommands.length).toBe(1)
    expect(response.debugResult.executedCommands[0].command).toContain('Get Title')
    expect(response.summary.totalCommands).toBe(1)
  })

  test('should handle browser automation keywords', async () => {
    const testContent = `New Browser    chromium    headless=true
New Page    https://example.com
Get Title
Click    text=More information...
Wait For Elements State    css=h1    visible
Take Screenshot    final-state.png
Close Browser`

    const result = await client.callTool({
      name: 'helpmetest_debug_test',
      arguments: {
        testContent,
        testName: 'Browser Automation Test',
        failureDescription: 'Testing browser lifecycle management'
      }
    })
    
    expect(result).toBeDefined()
    const response = JSON.parse(result.content[0].text)
    
    expect(response.debugResult.executedCommands.length).toBe(7)
    
    // Check that browser management commands are present
    const commands = response.debugResult.executedCommands.map(cmd => cmd.command)
    expect(commands.some(cmd => cmd.includes('New Browser'))).toBe(true)
    expect(commands.some(cmd => cmd.includes('New Page'))).toBe(true)
    expect(commands.some(cmd => cmd.includes('Close Browser'))).toBe(true)
  })
})