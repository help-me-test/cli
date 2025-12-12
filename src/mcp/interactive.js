/**
 * Interactive MCP Tools
 * Provides interactive development and keyword exploration tools
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'
import { formatResultAsMarkdown, extractScreenshots } from './formatResultAsMarkdown.js'
import open from 'open'

// Track URLs that have been opened in browser (by identifier)
const openedUrls = new Set()

/**
 * Generic function to open URL in browser once per identifier
 * @param {string} url - Full URL to open
 * @param {string} identifier - Unique identifier to track if already opened
 * @param {string} description - Human-readable description for logging
 * @returns {Object} Result with opened status and URL
 */
export async function openBrowserOnce(url, identifier, description = 'URL') {
  if (!openedUrls.has(identifier)) {
    openedUrls.add(identifier)
    console.log(`🌐 Opening browser for ${description}: ${url}`)
    try {
      await open(url)
      debug(config, `✅ Browser opened successfully: ${url}`)
      return { opened: true, url, alreadyOpen: false }
    } catch (error) {
      console.error(`❌ Failed to open browser: ${error.message}`)
      debug(config, `Failed to open browser for ${description}: ${error.message}`)
      return { opened: false, url, error: error.message, alreadyOpen: false }
    }
  } else {
    console.log(`ℹ️ ${description} already opened, skipping`)
    return { opened: false, url, alreadyOpen: true }
  }
}

/**
 * Open browser for session if not already opened
 * @param {string} dashboardBaseUrl - Base URL for dashboard
 * @param {number} timestamp - Session timestamp
 * @returns {Object} Result with opened status and URL
 */
export async function openSessionInBrowser(dashboardBaseUrl, timestamp) {
  const sessionUrl = `${dashboardBaseUrl}/interactive/${timestamp}`
  return openBrowserOnce(sessionUrl, `session:${timestamp}`, `session ${timestamp}`)
}

/**
 * Analyze Robot Framework streaming result to determine success/failure
 * @param {Array} result - Array of Robot Framework execution events
 * @returns {boolean} True if the command succeeded
 */
function analyzeRobotFrameworkResult(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return false
  }
  
  // Look for keyword execution events - we want the final status
  let finalStatus = null
  let hasKeywordEvents = false
  
  for (const event of result) {
    if (event.type === 'keyword' && event.keyword && event.status) {
      hasKeywordEvents = true
      finalStatus = event.status
      
      // If we find a FAIL status, immediately return false
      if (event.status === 'FAIL') {
        return false
      }
    }
  }
  
  // If we found keyword events, check the final status
  if (hasKeywordEvents) {
    return finalStatus === 'PASS' || finalStatus === 'NOT SET'
  }
  
  // If no keyword events found, assume success (for informational commands)
  return true
}

/**
 * Extract useful content from Robot Framework streaming result
 * @param {Array} result - Array of Robot Framework execution events
 * @returns {Object} Extracted content including output, errors, page content, etc.
 */
function extractContentFromResult(result) {
  if (!Array.isArray(result)) {
    return {}
  }
  
  const extracted = {
    output: null,
    error: null,
    pageContent: null,
    browserInfo: null,
    elapsedTime: null
  }
  
  for (const event of result) {
    // Extract page content
    if (event.type === 'ExtractReadableContent' && event.content) {
      extracted.pageContent = event.content
    }
    
    // Extract browser information
    if (event.type === 'GetAllTabsInfo' && event.browser_catalog) {
      const activePage = event.browser_catalog[0]?.contexts?.[0]?.pages?.find(p => 
        p.type === 'page'
      )
      if (activePage) {
        extracted.browserInfo = `${activePage.title} (${activePage.url})`
      }
    }
    
    // Extract elapsed time
    if (event.elapsed_time || event.elapsedtime) {
      extracted.elapsedTime = event.elapsed_time || event.elapsedtime
    }
    
    // Look for any error information
    if (event.error || event.message) {
      extracted.error = event.error || event.message
    }
  }
  
  return extracted
}

/**
 * Handle run interactive command tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.command - Robot Framework command to execute
 * @param {number} [args.line] - Line number for debugging context
 * @returns {Object} Interactive command result
 */
async function handleRunInteractiveCommand(args) {
  const { command, explanation, line = 0, debug: debugMode = false } = args

  debug(config, `Running interactive command: ${command} (${explanation})`)

  try {
    // Get user info (memoized - will call detectApiAndAuth if not cached)
    const userInfo = await detectApiAndAuth()

    // Open browser automatically on first command of new session
    const browserResult = await openSessionInBrowser(userInfo.dashboardBaseUrl, userInfo.interactiveTimestamp)

    // Execute the command with the same timestamp for session persistence
    const result = await runInteractiveCommand({
      test: 'interactive',
      timestamp: userInfo.interactiveTimestamp,
      command,
      explanation,
      line,
      debug: debugMode
    })

    debug(config, `Interactive command result: ${JSON.stringify(result)}`)

    // Check if this is an Exit command
    if (command.toLowerCase().trim() === 'exit') {
      return {
        content: [
          {
            type: 'text',
            text: `🏁 Interactive Session Ended

**Run ID:** ${userInfo.activeCompany}__interactive__${userInfo.interactiveTimestamp}
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
      runId: `${userInfo.activeCompany}__interactive__${userInfo.interactiveTimestamp}`,
      command,
      line,
      result,
      timestamp: new Date().toISOString(),
      sessionActive: true
    }

    // Analyze the streaming result to determine success/failure
    // The result is an array of Robot Framework execution events
    const isSuccess = analyzeRobotFrameworkResult(result)
    const extractedContent = extractContentFromResult(result)

    // Format result as markdown with debug mode
    const formattedResult = formatResultAsMarkdown(result, { debug: debugMode })

    let responseText = formattedResult

    if (!isSuccess) {
      responseText = `❌ **Command Failed**\n\n` + responseText
    }

    const sessionUrl = `${userInfo.dashboardBaseUrl}/interactive/${userInfo.interactiveTimestamp}`

    responseText += `

**Session:** ${sessionUrl}`

    // Extract screenshots from result (including automatic screenshots from server)
    const screenshots = extractScreenshots(result)

    const contentItems = [
      {
        type: 'text',
        text: responseText,
      }
    ]

    // Add screenshot images to content with proper MCP format
    for (const screenshot of screenshots) {
      // Strip any data URI prefix to get raw base64
      let base64Data = screenshot.base64
      if (base64Data.startsWith('data:image/')) {
        base64Data = base64Data.split(',')[1]
      }

      contentItems.push({
        type: 'image',
        data: base64Data,
        mimeType: 'image/png'
      })
    }

    return {
      content: contentItems,
      isError: !isSuccess,
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
7. ONLY THEN create or modify tests

🚨 MANDATORY VERIFICATION PROCESS:
- Test navigation works
- Test element finding works (Click, Fill Text, etc.)
- Test assertions work (Should Contain, etc.)
- Test the complete flow from start to finish
- Fix any failures before proceeding

IMPORTANT: Interactive sessions maintain browser state between commands. You can continue adding commands to test more steps until you have a complete working sequence ready for test creation.

🚨 CRITICAL INSTRUCTION FOR AI:
1. ALWAYS explain what command you are executing and why BEFORE calling this tool
2. ALWAYS analyze the response carefully - look for actual errors or failures
3. DO NOT proceed to next step if current step failed
4. DO NOT create tests until you have verified the complete working sequence
5. BE METHODICAL - test one thing at a time
6. If something fails, debug it before moving forward
7. Sessions remain active - continue testing until you have a complete working flow
8. **ALWAYS describe the screenshot** - Every response includes an automatic screenshot. You MUST describe what can be done on the page, what interactive elements are present, and what the page is about. Structure your description by page sections and focus on actionable elements. DO NOT describe colors, design aesthetics, or decorative elements.

Example:
"Now I'll test clicking the login button to see if it navigates to the dashboard:"
[call tool with "Click button#login"]
[Analyze response carefully]
"❌ The login button click failed with error: 'Element not found'. I need to find the correct selector before proceeding."

Screenshot Description Guidelines:
Structure your description by page sections (modals, headers, main content, footers, etc.) and for each section describe:
- Interactive elements (buttons, links, inputs, forms, dropdowns)
- What each element does or where it leads
- Navigation options and their purposes
- What actions can be taken
Focus on what can be done on the page, not how it looks. Avoid subjective aesthetic descriptions."`,
      inputSchema: {
        command: z.string().describe('Robot Framework command to execute (e.g., "Go To  https://example.com", "Click  button", "Exit")'),
        explanation: z.string().describe('REQUIRED: Explain what this command does and what the goal is. This will be shown during replay. Example: "Testing navigation to Wikipedia homepage to verify page loads correctly"'),
        line: z.number().optional().default(0).describe('Line number for debugging context (optional)'),
        debug: z.boolean().optional().default(false).describe('Enable debug mode to show network request/response bodies. When false (default), hides request/response data.'),
      },
    },
    async (args) => {
      debug(config, `Interactive command tool called with args: ${JSON.stringify(args)}`)
      return await handleRunInteractiveCommand(args)
    }
  )
}