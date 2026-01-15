/**
 * Interactive MCP Tools
 * Provides interactive development and keyword exploration tools
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'
import { formatResultAsMarkdown, extractScreenshots } from './formatResultAsMarkdown.js'
import { getPendingMessages, sendToUI, state, formatUserMessages } from './command-queue.js'
import { sendToUIPrompt, TASKLIST_REQUIREMENT } from './shared-prompts.js'
import open from 'open'

// Track URLs that have been opened in browser (by identifier)
const openedUrls = new Set()

// Track current interactive session timestamp (persists across tool calls)
let currentSessionTimestamp = null

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

  // Check for errors first
  for (const event of result) {
    if (event.error || (event.message && event.type === 'error')) {
      return false
    }
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
  const startTime = Date.now()
  const { command, explanation, line = 0, debug: debugMode = false, timeout = 30000, timestamp: sessionTimestamp } = args

  // Check if blocked - must call send_to_ui before running next interactive command
  if (state.requiresSendToUI) {
    throw new Error('Must call send_to_ui before running next interactive command. Please communicate the state, plan, and expectations from the previous command first.')
  }

  debug(config, `Running interactive command: ${command} (${explanation}) [timeout: ${timeout}ms]`)

  try {
    // Get user info (memoized - will call detectApiAndAuth if not cached)
    const userInfo = await detectApiAndAuth()

    // Determine which session timestamp to use:
    // 1. Use provided timestamp parameter if given
    // 2. Otherwise use current session timestamp if exists
    // 3. Otherwise create new session timestamp
    let timestamp
    if (sessionTimestamp) {
      timestamp = sessionTimestamp
      currentSessionTimestamp = timestamp
      console.log(`[Interactive] Using provided session timestamp: ${timestamp}`)
    } else if (currentSessionTimestamp) {
      timestamp = currentSessionTimestamp
      console.log(`[Interactive] Continuing existing session: ${timestamp}`)
    } else {
      timestamp = new Date().toISOString()
      currentSessionTimestamp = timestamp
      console.log(`[Interactive] Created new session: ${timestamp}`)
    }

    const room = `${userInfo.activeCompany}__interactive__${timestamp}`

    const messageId = `cmd-${Date.now()}`

    const sendNotification = (type) =>
      sendToUI({
        messageId,  // Keep same messageId for updates
        _type_: ["CommandNotification", type],
        command,
        explanation
      }, room)

    // Send initial "running" status
    await sendNotification("running")

    // Open browser automatically on first command of new session
    const browserResult = await openSessionInBrowser(userInfo.dashboardBaseUrl, timestamp)

    // Execute the command
    const result = await runInteractiveCommand({
      test: 'interactive',
      timestamp,
      command,
      explanation,
      line,
      debug: debugMode,
      timeout
    })

    debug(config, `Interactive command result: ${JSON.stringify(result)}`)

    // Check if this is an Exit command
    if (command.toLowerCase().trim() === 'exit') {
      return {
        content: [
          {
            type: 'text',
            text: `🏁 Interactive Session Ended

**Run ID:** ${userInfo.activeCompany}__interactive__${timestamp}
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
      runId: `${userInfo.activeCompany}__interactive__${timestamp}`,
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

    // Update to final status based on actual result
    const commandStatus = isSuccess ? "success" : "failed"
    await sendNotification(commandStatus)

    // Format result as markdown with debug mode
    const formattedResult = formatResultAsMarkdown(result, { debug: debugMode })

    let responseText = formattedResult

    if (!isSuccess) {
      const errorDetails = extractContentFromResult(result)
      const errorMessage = errorDetails.error || "Command execution failed"

      responseText = `❌ **Command Failed**

**Error:** ${errorMessage}

${responseText}

${sendToUIPrompt()}`
    } else {
      responseText = `✅ **Command Succeeded**

${responseText}

${sendToUIPrompt()}`
    }

    const sessionUrl = `${userInfo.dashboardBaseUrl}/interactive/${timestamp}`
    const totalElapsedMs = Date.now() - startTime
    const totalElapsedSec = (totalElapsedMs / 1000).toFixed(3)

    responseText += `

**Session:** ${sessionUrl}
**Total Time:** ${totalElapsedSec}s`

    // Check for user messages sent via AIChat during execution
    const userMessages = getPendingMessages()

    if (userMessages.length > 0) {
      responseText += formatUserMessages(userMessages)
    }

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

    // Set blocking flag - next command will be blocked until send_to_ui is called
    state.requiresSendToUI = true

    return {
      content: contentItems,
      isError: !isSuccess,
    }
    
  } catch (error) {
    debug(config, `Error running interactive command: ${error.message}`)

    // Just throw the error - no wrapping, no hiding
    throw error
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
      description: `🚨 MANDATORY: CREATE TASK LIST FIRST - NO EXCEPTIONS!

${TASKLIST_REQUIREMENT}

⚠️ WARNING: DO NOT CREATE OR MODIFY TESTS WITHOUT INTERACTIVE TESTING FIRST

This tool executes Robot Framework commands interactively. Sessions maintain browser state between commands.

🔴 WORKFLOW - FOLLOW EXACTLY:
1. **CREATE TASK LIST** (see Step 0 above - DO THIS FIRST!)
2. Start with navigation: "Go To https://example.com"
3. Test EACH step, updating TaskList after each command
4. Mark steps: 'in_progress' → 'done' ✅ or 'failed' ❌
5. If step fails, debug it until it works
6. Continue until complete working sequence
7. ONLY THEN create tests

🚨 CRITICAL INSTRUCTIONS:
${sendToUIPrompt()}

**AFTER each interactive command**: Update TaskList via send_to_ui:
- Mark completed step as 'done' ✅ or 'failed' ❌
- Mark next step as 'in_progress' 🔄
- Call: send_to_ui({ tasks: [updated array] })
- This shows user your progress in real-time

3. ALWAYS explain what command you are executing and why BEFORE calling this tool
4. ALWAYS analyze the response carefully - look for actual errors or failures
5. DO NOT proceed to next step if current step failed
6. DO NOT create tests until you have verified the complete working sequence
7. BE METHODICAL - test one thing at a time
8. If something fails, debug it before moving forward
9. Sessions remain active - continue testing until you have a complete working flow
10. **ALWAYS describe the screenshot** - Every response includes an automatic screenshot. You MUST describe what can be done on the page, what interactive elements are present, and what the page is about. CRITICAL: Describe what changed as a result of your command (popup appeared, navigated to new page, checkbox checked, etc.). Structure your description by page sections and focus on actionable elements. DO NOT describe colors, design aesthetics, or decorative elements.

Example:
"Now I'll test clicking the login button to see if it navigates to the dashboard:"
[call tool with "Click button#login"]
[Analyze response carefully]
"❌ The login button click failed with error: 'Element not found'. I need to find the correct selector before proceeding."

Screenshot Description Guidelines:
First, describe what changed as a result of the command:
- Did a popup/modal appear?
- Did the page navigate to a new URL?
- Did form fields get filled?
- Did elements appear/disappear?
- Did the page scroll or change state?

Then structure your description by page sections (modals, headers, main content, footers, etc.) and for each section describe:
- Interactive elements (buttons, links, inputs, forms, dropdowns)
- What each element does or where it leads
- Navigation options and their purposes
- What actions can be taken
Focus on what can be done on the page, not how it looks. Avoid subjective aesthetic descriptions.

**CRITICAL: Failure Analysis**
If something fails or doesn't work as expected, you MUST analyze WHY by examining:
- Network requests visible in the response (401/403/500 errors indicate auth/permission issues)
- Error messages displayed on the page in the screenshot
- Failed login attempts (wrong credentials, blocked account)
- Missing elements (selector issues, page not loaded)
- Timeout errors (element not appearing, slow page load)
- JavaScript errors or console messages in the response

Example failure analysis:
"❌ The login failed. Looking at the response, I can see a 401 Unauthorized error in the network requests, which indicates the credentials are incorrect or the session has expired. The screenshot shows an error message 'Invalid username or password' confirming this is an authentication issue, not a selector problem."

Do NOT just say "it failed" - explain the ROOT CAUSE based on visible evidence."`,
      inputSchema: {
        command: z.string().describe('Robot Framework command to execute (e.g., "Go To  https://example.com", "Click  button", "Exit")'),
        explanation: z.string().describe('REQUIRED: Explain what this command does and what the goal is. This will be shown during replay. Example: "Testing navigation to Wikipedia homepage to verify page loads correctly"'),
        line: z.number().optional().default(0).describe('Line number for debugging context (optional)'),
        debug: z.boolean().optional().default(false).describe('Enable debug mode to show network request/response bodies. When false (default), hides request/response data.'),
        timeout: z.number().optional().default(30000).describe('Timeout in milliseconds for command execution (default: 30000ms / 30 seconds). Increase for slow-loading pages.'),
        timestamp: z.string().optional().describe('Optional session timestamp to continue an existing interactive session (e.g., "2026-01-12T14:46:55.830Z"). If not provided, creates a new session.'),
      },
    },
    async (args) => {
      debug(config, `Interactive command tool called with args: ${JSON.stringify(args)}`)
      return await handleRunInteractiveCommand(args)
    }
  )
}