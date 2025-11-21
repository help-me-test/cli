/**
 * Exploratory Testing MCP Tools
 * Uses interactive commands to explore and test webpages
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'

/**
 * Execute an interactive command and return the result
 */
async function runCommand(sessionTimestamp, command) {
  const userInfo = await detectApiAndAuth()

  const result = await runInteractiveCommand({
    test: 'exploratory',
    timestamp: sessionTimestamp,
    command,
    line: 0
  })

  return result
}

/**
 * Main exploratory testing function
 * Uses AI to guide the exploration via interactive commands
 */
async function exploreWebpage(url, aiGuidance) {
  const userInfo = await detectApiAndAuth()
  const sessionTimestamp = Date.now()
  const sessionId = `${userInfo.activeCompany}__exploratory__${sessionTimestamp}`

  debug(config, `Starting exploratory testing for: ${url}`)

  const report = {
    url,
    sessionId,
    timestamp: new Date().toISOString(),
    understanding: '',
    useCases: [],
    findings: [],
    commands: []
  }

  try {
    // Step 1: Navigate
    report.commands.push({ step: 'Navigate', command: `Go To    ${url}` })
    const navResult = await runCommand(sessionTimestamp, `Go To    ${url}`)

    // Let AI provide guidance based on what's passed
    // For now we just return the session for AI to use interactively

    return {
      success: true,
      sessionId,
      message: `Exploratory session started for ${url}. Session ID: ${sessionId}`,
      nextSteps: `Use helpmetest_run_interactive_command with this session to:
1. Get page title with: Get Title
2. Get page content with: Get Text body
3. Get all clickable elements
4. Analyze what you see
5. Form your understanding of what this page is for
6. Test the use cases you identify
7. Report findings`
    }

  } catch (error) {
    debug(config, `Exploratory testing failed: ${error.message}`)
    throw error
  }
}

/**
 * Handle explore tool call
 */
async function handleExplore(args) {
  const { url } = args

  debug(config, `Exploratory testing tool called for: ${url}`)

  try {
    const result = await exploreWebpage(url)

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Exploratory Testing Session Started

**URL:** ${url}
**Session ID:** ${result.sessionId}

## Next Steps

I've started an exploratory testing session. Now I'll use interactive commands to:

1. **Understand the page**
   - Get the page title
   - Read visible content
   - Find all interactive elements (buttons, forms, links)

2. **Determine what this page is for**
   - Analyze the structure
   - Identify the primary purpose
   - Find key use cases users would try

3. **Test those use cases**
   - Try filling forms
   - Click buttons
   - Test navigation
   - Look for errors

4. **Report findings**
   - Document what works
   - Document what's broken
   - Explain the issues

Let me start exploring...`,
        },
      ],
    }

  } catch (error) {
    debug(config, `Error in exploratory testing: ${error.message}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ Failed to Start Exploratory Testing

**URL:** ${url}
**Error:** ${error.message}`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Register exploratory testing MCP tools
 */
export function registerExploratoryTools(server) {
  server.registerTool(
    'helpmetest_explore',
    {
      title: 'Help Me Test: Exploratory Testing',
      description: `Start an exploratory testing session on a webpage.

This tool starts a testing session and then you (the AI) use interactive commands to:
1. Navigate to the page
2. Explore what's there using Robot Framework commands (Get Title, Get Text, etc)
3. Form your understanding of what the page is for
4. Identify use cases users would try
5. Test those use cases using interactive commands
6. Find bugs (broken forms, error-throwing buttons, etc)
7. Report your findings

You MUST use helpmetest_run_interactive_command to actually explore. Don't make assumptions.

Available commands you can use:
- Get Title
- Get Text <selector>
- Get Element Count <selector>
- Click <selector>
- Fill Text <selector> <value>
- And many more Browser keywords

🚨 CRITICAL INSTRUCTIONS:
1. Start exploration by calling this tool
2. Use interactive commands to actually see what's on the page
3. Form your understanding based on what you actually see
4. Test use cases you identify
5. Report findings based on real testing
6. DON'T hardcode or assume anything`,
      inputSchema: {
        url: z.string().describe('URL to explore and test'),
      },
    },
    async (args) => {
      debug(config, `Exploratory tool called with args: ${JSON.stringify(args)}`)
      return await handleExplore(args)
    }
  )
}
