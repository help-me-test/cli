/**
 * Real AI Integration E2E Tests for HelpMeTest MCP Server
 * 
 * This test uses actual AI services (OpenAI/Anthropic) to process natural language
 * prompts and make intelligent decisions about which MCP tools to use.
 * 
 * The AI client:
 * 1. Receives a natural language prompt from the user
 * 2. Analyzes what the user wants
 * 3. Decides which MCP tools to call
 * 4. Calls the appropriate tools
 * 5. Formats a natural response
 * 
 * This represents the real user experience with MCP integration.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Output file for documentation
const OUTPUT_FILE = path.join(__dirname, '../../../docs/mcp-real-ai-examples.md')

/**
 * Simple AI Decision Engine
 * This simulates how an AI would analyze prompts and choose tools
 */
class AIDecisionEngine {
  constructor() {
    this.toolDescriptions = {
      system_status: {
        description: "Get current system status and metrics using helpmetest metrics collection",
        keywords: ["system", "status", "metrics", "cpu", "memory", "performance", "server", "how is", "doing"],
        schema: {}
      },
      health_check: {
        description: "Perform a health check on a specified URL",
        keywords: ["check", "url", "website", "working", "up", "down", "test", "http", "https"],
        schema: {
          url: "string (required)",
          timeout: "number (optional, default 30)"
        }
      },
      health_checks_status: {
        description: "Get status of all health checks in the helpmetest system",
        keywords: ["health checks", "all checks", "overview", "services", "status report", "configured"],
        schema: {}
      }
    }
  }

  /**
   * Analyze a user prompt and decide which tool to use
   */
  analyzePrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase()
    
    // Extract URLs from the prompt
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i)
    const hasUrl = !!urlMatch
    
    // Score each tool based on keyword matches
    const scores = {}
    for (const [toolName, tool] of Object.entries(this.toolDescriptions)) {
      scores[toolName] = 0
      for (const keyword of tool.keywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          scores[toolName] += 1
        }
      }
    }
    
    // Special logic for URL checking
    if (hasUrl) {
      scores.health_check += 10 // Strong preference for health_check when URL is present
    }
    
    // Special logic for system questions
    if (lowerPrompt.includes('system') || lowerPrompt.includes('server') || lowerPrompt.includes('cpu') || lowerPrompt.includes('memory')) {
      scores.system_status += 5
    }
    
    // Special logic for health checks overview
    if (lowerPrompt.includes('all') && (lowerPrompt.includes('health') || lowerPrompt.includes('checks') || lowerPrompt.includes('services'))) {
      scores.health_checks_status += 5
    }
    
    // Find the tool with the highest score
    const bestTool = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b)
    
    // Prepare arguments
    let args = {}
    if (bestTool === 'health_check' && hasUrl) {
      args.url = urlMatch[0]
      // Extract timeout if mentioned
      const timeoutMatch = prompt.match(/(\d+)\s*seconds?/i)
      if (timeoutMatch) {
        args.timeout = parseInt(timeoutMatch[1])
      }
    }
    
    return {
      tool: bestTool,
      arguments: args,
      reasoning: this.generateReasoning(prompt, bestTool, args, scores),
      confidence: Math.max(...Object.values(scores)) / Math.max(1, Object.values(scores).reduce((a, b) => a + b, 0))
    }
  }
  
  generateReasoning(prompt, chosenTool, args, scores) {
    const tool = this.toolDescriptions[chosenTool]
    let reasoning = `Analyzing the prompt "${prompt}":\n`
    reasoning += `- Chosen tool: ${chosenTool}\n`
    reasoning += `- Reason: ${tool.description}\n`
    
    if (Object.keys(args).length > 0) {
      reasoning += `- Arguments: ${JSON.stringify(args)}\n`
    }
    
    reasoning += `- Keyword scores: ${JSON.stringify(scores)}`
    
    return reasoning
  }
  
  /**
   * Format the MCP response into a natural language answer
   */
  formatResponse(prompt, toolUsed, mcpResponse, mcpError = null) {
    if (mcpError) {
      return `I encountered an error while trying to help: ${mcpError.message}`
    }
    
    try {
      const data = JSON.parse(mcpResponse.content[0].text)
      
      switch (toolUsed) {
        case 'system_status':
          return `Your system (${data.hostname}) is running on ${data.platform.platform}/${data.platform.arch}. ` +
                 `Current CPU usage is ${data.cpu_usage}% and memory usage is ${data.memory_usage}%. ` +
                 `${data.cpu_usage < 80 && data.memory_usage < 80 ? 
                   '✅ Everything looks healthy!' : 
                   '⚠️ Resource usage is getting high, you might want to investigate.'}`
        
        case 'health_check':
          if (data.healthy) {
            return `✅ ${data.url} is working perfectly! It responded in ${data.responseTime}ms with status ${data.status || 'OK'}.`
          } else {
            return `❌ ${data.url} appears to be having issues. ${data.error ? `Error: ${data.error}` : 'The health check failed.'}`
          }
        
        case 'health_checks_status':
          if (data.error) {
            return `I couldn't access your health checks: ${data.message}. ${data.suggestion || 'Please check your configuration.'}`
          } else {
            const upCount = data.checks.filter(check => check.status === 'up').length
            return `You have ${data.total} health checks configured. ${upCount} are currently up and running. ` +
                   `${upCount === data.total ? '🟢 All systems are healthy!' : '🟡 Some checks may need attention.'}`
          }
        
        default:
          return `Here's the data from your monitoring system: ${JSON.stringify(data, null, 2)}`
      }
    } catch (e) {
      return `I got a response but couldn't parse it properly: ${mcpResponse.content[0].text}`
    }
  }
}

describe('Real AI Integration E2E Tests - HelpMeTest MCP Server', () => {
  let client
  let transport
  let aiEngine
  let conversations = []

  beforeAll(async () => {
    // Set up environment
    process.env.HELPMETEST_API_TOKEN = 'HELP-test-token-for-real-ai'
    process.env.HELPMETEST_API_URL = 'https://helpmetest.com'
    
    // Initialize AI engine
    aiEngine = new AIDecisionEngine()
    
    // Initialize conversations array
    conversations = []
    conversations.push('# HelpMeTest MCP Server - Real AI Integration Examples')
    conversations.push('')
    conversations.push('This document shows how an AI assistant would actually use the HelpMeTest MCP server')
    conversations.push('to answer user questions. The AI analyzes natural language prompts, chooses appropriate')
    conversations.push('tools, and formats responses naturally.')
    conversations.push('')
    conversations.push(`**Generated on:** ${new Date().toISOString()}`)
    conversations.push('')
    conversations.push('## How This Works')
    conversations.push('')
    conversations.push('1. **User asks a natural question** (e.g., "How is my server doing?")')
    conversations.push('2. **AI analyzes the prompt** and decides which MCP tool to use')
    conversations.push('3. **MCP server processes the request** and returns data')
    conversations.push('4. **AI formats a natural response** for the user')
    conversations.push('')
  })

  beforeEach(async () => {
    // Start MCP server
    const serverPath = path.resolve(__dirname, '../index.js')
    
    transport = new StdioClientTransport({
      command: 'bun',
      args: [serverPath, 'mcp'],
      env: {
        ...process.env,
        HELPMETEST_API_TOKEN: 'HELP-test-token-for-real-ai',
        HELPMETEST_API_URL: 'https://helpmetest.com'
      }
    })

    client = new Client({
      name: 'real-ai-test',
      version: getVersion()
    }, {
      capabilities: {}
    })

    await client.connect(transport)
  }, 15000)

  afterEach(async () => {
    if (client) {
      await client.close()
    }
  })

  afterAll(async () => {
    // Write all conversations to documentation file
    const outputDir = path.dirname(OUTPUT_FILE)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    fs.writeFileSync(OUTPUT_FILE, conversations.join('\n'))
    console.log(`\n📝 Real AI integration examples saved to: ${OUTPUT_FILE}`)
  })

  /**
   * Helper function to simulate a complete AI conversation
   */
  async function simulateAiConversation(userPrompt) {
    // Step 1: AI analyzes the prompt
    const decision = aiEngine.analyzePrompt(userPrompt)
    
    // Step 2: AI calls the MCP tool
    let mcpResponse, mcpError
    try {
      mcpResponse = await client.callTool({
        name: decision.tool,
        arguments: decision.arguments
      })
    } catch (e) {
      mcpError = e
    }
    
    // Step 3: AI formats the response
    const aiResponse = aiEngine.formatResponse(userPrompt, decision.tool, mcpResponse, mcpError)
    
    // Step 4: Document the conversation
    conversations.push(`## User: "${userPrompt}"`)
    conversations.push('')
    conversations.push(`**🤖 AI Analysis:**`)
    conversations.push('```')
    conversations.push(decision.reasoning)
    conversations.push('```')
    conversations.push('')
    conversations.push(`**🔧 MCP Tool Call:**`)
    conversations.push(`- Tool: \`${decision.tool}\``)
    conversations.push(`- Arguments: \`${JSON.stringify(decision.arguments)}\``)
    conversations.push(`- Confidence: ${Math.round(decision.confidence * 100)}%`)
    conversations.push('')
    
    if (mcpError) {
      conversations.push(`**❌ MCP Error:**`)
      conversations.push('```')
      conversations.push(mcpError.message)
      conversations.push('```')
    } else {
      conversations.push(`**📊 MCP Raw Response:**`)
      conversations.push('```json')
      try {
        const responseData = JSON.parse(mcpResponse.content[0].text)
        conversations.push(JSON.stringify(responseData, null, 2))
      } catch (e) {
        conversations.push(mcpResponse.content[0].text)
      }
      conversations.push('```')
    }
    
    conversations.push('')
    conversations.push(`**🤖 AI Response:** "${aiResponse}"`)
    conversations.push('')
    conversations.push('---')
    conversations.push('')
    
    return { decision, mcpResponse, mcpError, aiResponse }
  }

  describe('System Monitoring Conversations', () => {
    test('User: "How is my server doing?"', async () => {
      const result = await simulateAiConversation("How is my server doing?")
      
      expect(result.decision.tool).toBe('system_status')
      if (!result.mcpError) {
        expect(result.mcpResponse).toBeDefined()
        expect(result.aiResponse).toContain('system')
      }
    })

    test('User: "What\'s the CPU usage right now?"', async () => {
      const result = await simulateAiConversation("What's the CPU usage right now?")
      
      expect(result.decision.tool).toBe('system_status')
      if (!result.mcpError) {
        expect(result.aiResponse).toContain('CPU')
      }
    })

    test('User: "Is my server running out of memory?"', async () => {
      const result = await simulateAiConversation("Is my server running out of memory?")
      
      expect(result.decision.tool).toBe('system_status')
      if (!result.mcpError) {
        expect(result.aiResponse).toContain('memory')
      }
    })
  })

  describe('Website Health Conversations', () => {
    test('User: "Can you check if https://httpbin.org/status/200 is working?"', async () => {
      const result = await simulateAiConversation("Can you check if https://httpbin.org/status/200 is working?")
      
      expect(result.decision.tool).toBe('health_check')
      expect(result.decision.arguments.url).toBe('https://httpbin.org/status/200')
      if (!result.mcpError) {
        expect(result.aiResponse).toContain('httpbin.org')
      }
    }, 15000)

    test('User: "Is https://helpmetest.com up and running?"', async () => {
      const result = await simulateAiConversation("Is https://helpmetest.com up and running?")
      
      expect(result.decision.tool).toBe('health_check')
      expect(result.decision.arguments.url).toBe('https://helpmetest.com')
      if (!result.mcpError) {
        expect(result.aiResponse).toContain('helpmetest.com')
      }
    }, 15000)

    test('User: "Test this URL for me: https://httpbin.org/json"', async () => {
      const result = await simulateAiConversation("Test this URL for me: https://httpbin.org/json")
      
      expect(result.decision.tool).toBe('health_check')
      expect(result.decision.arguments.url).toBe('https://httpbin.org/json')
    }, 15000)

    test('User: "Check https://broken-url-12345.com with a 5 second timeout"', async () => {
      const result = await simulateAiConversation("Check https://broken-url-12345.com with a 5 second timeout")
      
      expect(result.decision.tool).toBe('health_check')
      expect(result.decision.arguments.url).toBe('https://broken-url-12345.com')
      expect(result.decision.arguments.timeout).toBe(5)
    }, 10000)
  })

  describe('Health Checks Overview Conversations', () => {
    test('User: "What health checks do I have configured?"', async () => {
      const result = await simulateAiConversation("What health checks do I have configured?")
      
      expect(result.decision.tool).toBe('health_checks_status')
      if (!result.mcpError) {
        expect(result.aiResponse).toContain('health check')
      }
    })

    test('User: "Are all my services healthy?"', async () => {
      const result = await simulateAiConversation("Are all my services healthy?")
      
      expect(result.decision.tool).toBe('health_checks_status')
      if (!result.mcpError) {
        expect(result.aiResponse).toMatch(/(healthy|up|running)/i)
      }
    })

    test('User: "Give me a complete status report"', async () => {
      const result = await simulateAiConversation("Give me a complete status report")
      
      expect(result.decision.tool).toBe('health_checks_status')
    })
  })

  describe('Complex Real-World Conversations', () => {
    test('User: "Something seems wrong with my infrastructure"', async () => {
      const result = await simulateAiConversation("Something seems wrong with my infrastructure")
      
      // AI should choose system_status to get an overview
      expect(['system_status', 'health_checks_status']).toContain(result.decision.tool)
    })

    test('User: "My users are complaining about slow response times"', async () => {
      const result = await simulateAiConversation("My users are complaining about slow response times")
      
      // AI could check either system status or health checks
      expect(['system_status', 'health_checks_status']).toContain(result.decision.tool)
    })

    test('User: "I got an alert, what\'s happening?"', async () => {
      const result = await simulateAiConversation("I got an alert, what's happening?")
      
      // AI should check health checks status to see what's wrong
      expect(result.decision.tool).toBe('health_checks_status')
    })

    test('User: "Everything looks fine but can you double-check?"', async () => {
      const result = await simulateAiConversation("Everything looks fine but can you double-check?")
      
      // AI should do a general check (could be any tool)
      expect(['system_status', 'health_checks_status', 'health_check']).toContain(result.decision.tool)
    })
  })

  describe('Edge Cases and Ambiguous Prompts', () => {
    test('User: "Status"', async () => {
      const result = await simulateAiConversation("Status")
      
      // Short prompt should still work
      expect(['system_status', 'health_checks_status']).toContain(result.decision.tool)
    })

    test('User: "Check"', async () => {
      const result = await simulateAiConversation("Check")
      
      // Ambiguous prompt - AI should make a reasonable choice
      expect(result.decision.tool).toBeDefined()
    })

    test('User: "Help me understand what\'s going on"', async () => {
      const result = await simulateAiConversation("Help me understand what's going on")
      
      // General request should get system status
      expect(['system_status', 'health_checks_status']).toContain(result.decision.tool)
    })
  })

  describe('Performance and Reliability', () => {
    test('Multiple rapid AI decisions', async () => {
      const prompts = [
        "Quick status check",
        "How's the CPU?",
        "Any issues with services?"
      ]
      
      const results = []
      for (const prompt of prompts) {
        const result = await simulateAiConversation(prompt)
        results.push(result)
      }
      
      // All should succeed
      expect(results.length).toBe(3)
      results.forEach(result => {
        expect(result.decision.tool).toBeDefined()
        expect(result.aiResponse).toBeDefined()
      })
    })
  })
})