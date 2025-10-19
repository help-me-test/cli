/**
 * Interactive MCP Tools
 * Provides interactive development and keyword exploration tools
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, apiGet } from '../utils/api.js'

/**
 * Interactive session management
 */
const interactiveSessions = new Map()

/**
 * Get or create an interactive session ID
 * @param {string} providedSessionId - Optional session ID provided by user
 * @returns {Promise<string>} The session ID to use
 */
async function getInteractiveSessionId(providedSessionId) {
  if (providedSessionId && providedSessionId !== 'interactive') {
    return providedSessionId
  }
  
  // Check if we have an existing interactive session
  const existingSession = Array.from(interactiveSessions.keys()).find(id =>
    id === 'interactive'
  )

  if (existingSession) {
    return existingSession
  }

  // Create new interactive session ID
  // Server will construct runId as: {company}__{test}__{timestamp}
  const sessionId = 'interactive'

  // Store the session
  interactiveSessions.set(sessionId, {
    created: new Date(),
    lastUsed: new Date()
  })

  return sessionId
}

/**
 * Handle run interactive command tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.command - Robot Framework command to execute
 * @param {number} [args.line] - Line number for debugging context
 * @returns {Object} Interactive command result
 */
async function handleRunInteractiveCommand(args) {
  const { command, line = 0 } = args
  
  debug(config, `Running interactive command: ${command}`)
  
  try {
    // Get or create session ID
    const sessionId = await getInteractiveSessionId('interactive')
    
    // Update session last used time
    if (interactiveSessions.has(sessionId)) {
      interactiveSessions.get(sessionId).lastUsed = new Date()
    }
    
    // Execute the command
    const result = await runInteractiveCommand({
      sessionId,
      command,
      line
    })
    
    debug(config, `Interactive command result: ${JSON.stringify(result)}`)
    
    // Check if this is an Exit command
    if (command.toLowerCase().trim() === 'exit') {
      // Clean up the session
      interactiveSessions.delete(sessionId)
      
      return {
        content: [
          {
            type: 'text',
            text: `🏁 Interactive Session Ended

**Session:** ${sessionId}
**Status:** Successfully terminated

The interactive debugging session has been closed. All browser state and session data have been cleared.

**Next Steps:**
- Use the working sequence of commands you've tested to create or modify tests
- Start a new interactive session anytime by using this tool again

**Session Summary:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
          },
        ],
      }
    }
    
    // Format the response for better readability
    const response = {
      sessionId,
      command,
      line,
      result,
      timestamp: new Date().toISOString(),
      sessionActive: true
    }
    
    // Create user-friendly explanation
    let explanation = `🤖 Interactive Command Executed

**Session:** ${sessionId}
**Command:** \`${command}\`
${line > 0 ? `**Line:** ${line}` : ''}

**Result:**`
    
    if (result.success) {
      explanation += `
✅ **SUCCESS** - Command executed successfully`
      
      if (result.output) {
        explanation += `
**Output:** ${result.output}`
      }
      
      if (result.screenshot) {
        explanation += `
📸 **Screenshot:** Available (${result.screenshot})`
      }
    } else {
      explanation += `
❌ **FAILED** - Command execution failed`
      
      if (result.error) {
        explanation += `
**Error:** ${result.error}`
      }
      
      explanation += `

**Debugging Tips:**
1. Check if the element selector is correct
2. Ensure the page has loaded completely
3. Verify the element is visible and interactable
4. Try adding a wait command before this step
5. Use 'Get Text' or 'Get Title' to debug page state`
    }
    
    explanation += `

**Session Status:** Active - you can continue testing more commands
**Exit Session:** Use command 'Exit' when you're done

**Raw Response:**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`

🚨 **CRITICAL INSTRUCTION FOR AI:**
1. **ANALYZE THE RESULT** - Don't just say "done", actually look at success/failure
2. **DEBUG FAILURES** - If the command failed, help identify why and suggest fixes
3. **CONTINUE TESTING** - This is interactive development - keep testing more steps
4. **BUILD COMPLETE SEQUENCES** - Test your full workflow step by step
5. **ONLY EXIT** when you have a complete working sequence ready for test creation`
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
        },
      ],
      isError: !result.success,
    }
    
  } catch (error) {
    debug(config, `Error running interactive command: ${error.message}`)
    
    const errorResponse = {
      error: true,
      command,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null,
        line
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `❌ Interactive Command Failed

**Command:** \`${command}\`
**Error:** ${error.message}

**Troubleshooting:**
1. Check your API connection and credentials
2. Verify the Robot Framework command syntax
3. Ensure the browser session is active
4. Try starting a new interactive session

**Debug Information:**
\`\`\`json
${JSON.stringify(errorResponse, null, 2)}
\`\`\``,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle keywords tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.search] - Search term to filter keywords/libraries
 * @param {string} [args.type] - Type of documentation to search
 * @returns {Object} Keywords result
 */
async function handleKeywords(args) {
  const { search, type = 'all' } = args

  debug(config, `Searching keywords with: search="${search}", type="${type}"`)

  try {
    const response = await apiGet('/api/keywords', { search, type })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error searching keywords: ${error.message}`)

    const errorResponse = {
      error: true,
      search,
      type,
      message: error.message,
      timestamp: new Date().toISOString()
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Register interactive MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerInteractiveTools(server) {
  // Register run_interactive_command tool
  server.registerTool(
    'helpmetest_run_interactive_command',
    {
      title: 'Help Me Test: Interactive Command Tool',
      description: `🚨 MANDATORY TOOL FOR TEST DEVELOPMENT - REQUIRED BEFORE CREATING/MODIFYING TESTS

⚠️ WARNING: DO NOT CREATE OR MODIFY TESTS WITHOUT USING THIS TOOL FIRST

This tool is ABSOLUTELY REQUIRED before creating or modifying any tests. Execute Robot Framework commands interactively for debugging and testing. This starts an interactive session that maintains browser state between commands.

🔴 CRITICAL WORKFLOW - FOLLOW EXACTLY:
1. Start with navigation: "Go To https://example.com"
2. Test EACH step individually using this tool
3. VERIFY each step works as expected before moving to next step
4. If ANY step fails, debug it until it works
5. Build up the complete sequence step by step
6. Continue testing until you have a COMPLETE WORKING sequence
7. Use "Exit" command ONLY when completely finished debugging (session will be lost)
8. ONLY THEN create or modify tests

🚨 MANDATORY VERIFICATION PROCESS:
- Test navigation works
- Test element finding works (Click, Fill Text, etc.)
- Test assertions work (Should Contain, etc.)
- Test the complete flow from start to finish
- Fix any failures before proceeding

IMPORTANT: Interactive sessions maintain browser state between commands. You can continue adding commands to test more steps. Only use "Exit" when you are completely done debugging and ready to create/modify the test.

🚨 CRITICAL INSTRUCTION FOR AI: 
1. ALWAYS explain what command you are executing and why BEFORE calling this tool
2. ALWAYS analyze the response carefully - look for actual errors or failures
3. DO NOT proceed to next step if current step failed
4. DO NOT create tests until you have verified the complete working sequence
5. BE METHODICAL - test one thing at a time
6. If something fails, debug it before moving forward

Example:
"Now I'll test clicking the login button to see if it navigates to the dashboard:"
[call tool with "Click button#login"]
[Analyze response carefully]
"❌ The login button click failed with error: 'Element not found'. I need to find the correct selector before proceeding."`,
      inputSchema: {
        command: z.string().describe('Robot Framework command to execute (e.g., "Go To  https://example.com", "Click  button", "Exit")'),
        line: z.number().optional().default(0).describe('Line number for debugging context (optional)'),
      },
    },
    async (args) => {
      debug(config, `Interactive command tool called with args: ${JSON.stringify(args)}`)
      return await handleRunInteractiveCommand(args)
    }
  )

  // Register keywords tool
  server.registerTool(
    'helpmetest_keywords',
    {
      title: 'Help Me Test: Keywords Documentation Tool',
      description: `Search and get documentation for available Robot Framework keywords and libraries

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user what you're searching for and why. After getting results, summarize the key keywords or libraries found that are relevant to the user's needs. Don't just say "Done".`,
      inputSchema: {
        search: z.string().optional().describe('Search term to filter keywords/libraries (optional - if not provided, returns all)'),
        type: z.enum(['keywords', 'libraries', 'all']).optional().default('all').describe('Type of documentation to search: keywords, libraries, or all'),
      },
    },
    async (args) => {
      debug(config, `Keywords tool called with args: ${JSON.stringify(args)}`)
      return await handleKeywords(args)
    }
  )
}