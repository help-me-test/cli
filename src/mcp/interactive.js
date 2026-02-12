/**
 * Interactive MCP Tools
 * Provides interactive development and keyword exploration tools
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'
import { formatResultAsMarkdown, extractScreenshots } from './formatResultAsMarkdown.js'
import { formatAndSendToUI, state, registerInteractiveSession, injectSystemMessage, appendPendingEventsToResponse } from './command-queue.js'
import open from 'open'
import { writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// Track URLs that have been opened in browser (by identifier)
const openedUrls = new Set()

// Track current interactive session timestamp (persists across tool calls)
let currentSessionTimestamp = null

// Track if we've injected auth prompt this MCP session
let hasInjectedAuthPrompt = false

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
    console.error(`🌐 Opening browser for ${description}: ${url}`)
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
    console.error(`ℹ️ ${description} already opened, skipping`)
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
  const { command, explanation, line = 0, debug: debugMode = false, screenshot = false, timeout = 5000, timestamp: sessionTimestamp, message, tasks } = args

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
      console.error(`[Interactive] Using provided session timestamp: ${timestamp}`)
      registerInteractiveSession(timestamp)
    } else if (currentSessionTimestamp) {
      timestamp = currentSessionTimestamp
      console.error(`[Interactive] Continuing existing session: ${timestamp}`)
    } else {
      timestamp = new Date().toISOString()
      currentSessionTimestamp = timestamp
      console.error(`[Interactive] Created new session: ${timestamp}`)
      registerInteractiveSession(timestamp)

      // Inject auth state prompt on first interactive command
      if (!hasInjectedAuthPrompt) {
        hasInjectedAuthPrompt = true
        try {
          const { getHowToInstructions } = await import('./instructions.js')
          const result = await getHowToInstructions({ type: 'authentication_state_management' })
          injectSystemMessage(result.content[0].text)
        } catch (e) {
          console.error(`[Interactive] Failed to inject auth prompt: ${e.message}`)
        }
      }
    }

    const room = `${userInfo.activeCompany}__interactive__${timestamp}`

    // Store room for error messages
    state.lastRoom = room

    // If message or tasks provided, send properly formatted UI update to clear blocking flag
    if (message || tasks) {
      await formatAndSendToUI({ message, tasks, room })
      console.error(`[Interactive] Sent UI update before command execution`)
    }

    // Check if blocked - must communicate state/plan/expectations before running next command
    // (only if message/tasks weren't just sent above)
    if (state.requiresSendToUI && !message && !tasks) {
      const roomHint = state.lastRoom ? `\n\nUse room: "${state.lastRoom}"` : ''
      throw new Error(`Must communicate state/plan/expectations before running next command. Either:
1. Pass message/tasks parameters to run_interactive_command (preferred - one call), OR
2. Call send_to_ui separately (two calls)${roomHint}`)
    }

    const messageId = `cmd-${Date.now()}`

    const sendNotification = (type) =>
      formatAndSendToUI({
        room,
        messageId,
        command,
        explanation,
        notificationType: type
      })

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
      screenshot,
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

⚠️ **Next:** Communicate what happened and your plan by passing message/tasks to next run_interactive_command call (or call send_to_ui separately).`
    } else {
      responseText = `✅ **Command Succeeded**

${responseText}

⚠️ **Next:** Communicate state/plan/expectations by passing message/tasks to next run_interactive_command call (or call send_to_ui separately).`
    }

    const sessionUrl = `${userInfo.dashboardBaseUrl}/interactive/${timestamp}`
    const totalElapsedMs = Date.now() - startTime
    const totalElapsedSec = (totalElapsedMs / 1000).toFixed(3)

    responseText += `

**Session:** ${sessionUrl}
**Total Time:** ${totalElapsedSec}s`

    // Append all pending events (system messages, user messages, test status changes)
    responseText = appendPendingEventsToResponse(responseText)

    // Extract screenshots from result (including automatic screenshots from server)
    const screenshots = extractScreenshots(result)

    // Save screenshots to temp folder if screenshot mode enabled
    const savedScreenshotPaths = []
    if (screenshot && screenshots.length > 0) {
      const tempDir = join(tmpdir(), 'helpmetest', 'screenshots')
      await mkdir(tempDir, { recursive: true })

      for (let i = 0; i < screenshots.length; i++) {
        let base64Data = screenshots[i].base64
        let ext = 'png'

        if (base64Data.startsWith('data:image/')) {
          const match = base64Data.match(/^data:image\/(\w+);/)
          if (match) ext = match[1] === 'jpeg' ? 'jpg' : match[1]
          base64Data = base64Data.split(',')[1]
        }

        const filename = `screenshot-${Date.now()}-${i}.${ext}`
        const filepath = join(tempDir, filename)
        await writeFile(filepath, Buffer.from(base64Data, 'base64'))
        savedScreenshotPaths.push(filepath)
        console.error(`📸 Screenshot saved: ${filepath}`)
      }
    }

    if (savedScreenshotPaths.length > 0) {
      responseText += `\n**Screenshots saved:**\n${savedScreenshotPaths.map(p => `- ${p}`).join('\n')}`
    }

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
      description: `Execute Robot Framework commands interactively. Sessions maintain browser state between commands.

🚨 **MANDATORY PREREQUISITE FOR helpmetest_upsert_test**
You MUST use this tool to test your complete flow interactively BEFORE calling \`helpmetest_upsert_test\`. Creating tests without interactive validation is NOT allowed.

⚠️ **FIRST TIME USING THIS TOOL?** Call \`how_to({ type: "interactive_command_instructions" })\` for detailed workflow and requirements.

**Quick Reminders:**
- ⚠️ Create TaskList FIRST before running any commands (use message/tasks parameters or send_to_ui)
- ⚠️ Communicate state/plan/expectations after EACH command using message/tasks parameters (eliminates need for separate send_to_ui call!)
- ⚠️ DO NOT create tests without testing the full sequence interactively first
- ⚠️ Describe screenshots and analyze failures based on visible evidence
- 🚨 **AUTHENTICATION:** Before testing login/auth flows, call \`how_to({ type: "authentication_state_management" })\` to learn As/Save As pattern

**Efficient Usage:**
Pass message or tasks parameters directly to this tool instead of calling send_to_ui separately:
- message: "Navigating to login page to test authentication flow"
- tasks: [{ name: "Login test", status: "in_progress" }]

**Common Commands:**
- Go To <url> - Navigate to a page
- Click <selector> - Click element
- Fill Text <selector> <text> - Input text
- Get Text <selector> - Validate text
- Exit - End session

**Sessions:** Provide timestamp parameter to continue existing session, or omit to create new session.`,
      inputSchema: {
        command: z.string().describe('Robot Framework command to execute (e.g., "Go To  https://example.com", "Click  button", "Exit")'),
        explanation: z.string().describe('REQUIRED: Explain what this command does and what the goal is. This will be shown during replay. Example: "Testing navigation to Wikipedia homepage to verify page loads correctly"'),
        line: z.number().optional().default(0).describe('Line number for debugging context (optional)'),
        debug: z.boolean().optional().default(false).describe('Enable debug mode to show network request/response bodies. When false (default), hides request/response data.'),
        screenshot: z.boolean().optional().default(false).describe('Enable screenshot capture after command execution. DEFAULT: false. ONLY set to true if you need visual confirmation that readable/clickable page content cannot provide (e.g., visual layout issues, image content, color verification). Every command returns ExtractReadableContent with full page text and FindInteractableElements with all clickable elements - this is usually sufficient. Screenshots are SLOW - avoid unless absolutely necessary for visual information.'),
        timeout: z.number().optional().default(1000).describe('Timeout in milliseconds for command execution (default: 1000ms / 1 second). IMPORTANT: Increase timeout for "Go To" commands (recommend 5000-10000ms for page navigation) and slow-loading elements.'),
        timestamp: z.string().optional().describe('Optional session timestamp to continue an existing interactive session (e.g., "2026-01-12T14:46:55.830Z"). If not provided, creates a new session.'),
        message: z.string().optional().describe('Optional message to send to UI before executing command. This eliminates the need for separate send_to_ui call.'),
        tasks: z.array(z.object({
          name: z.string().describe('Task name'),
          status: z.enum(['pending', 'in_progress', 'done', 'failed']).describe('Task status')
        })).optional().describe('Optional task list to send to UI before executing command. This eliminates the need for separate send_to_ui call.'),
      },
    },
    async (args) => {
      debug(config, `Interactive command tool called with args: ${JSON.stringify(args)}`)
      return await handleRunInteractiveCommand(args)
    }
  )
}