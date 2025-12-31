/**
 * Browser Task Automation MCP Tools
 * Executes browser tasks by calling the AI server's robot agent
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { detectApiAndAuth } from '../utils/api.js'
import fetch from 'node-fetch'

/**
 * Execute browser task via AI server
 */
async function executeBrowserTask(task, url = null) {
  const userInfo = await detectApiAndAuth()

  // Call AI server endpoint
  const aiServerUrl = config.apiBaseUrl.replace('/api', '')  // Remove /api suffix
  const endpoint = `${aiServerUrl}/browser_task`

  const params = new URLSearchParams({ task })
  if (url) {
    params.append('url', url)
  }

  debug(config, `Calling AI server: ${endpoint}?${params}`)

  const response = await fetch(`${endpoint}?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiToken && { 'Authorization': `Bearer ${config.apiToken}` })
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI server error: ${error}`)
  }

  return await response.json()
}

/**
 * Format actions for display
 */
function formatActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return 'No actions performed'
  }

  return actions.map((action, i) => {
    const [step, result] = action
    const status = result.status || 'UNKNOWN'
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '❓'

    let output = `${i + 1}. ${emoji} ${step}`
    if (result.errors && result.errors.length > 0) {
      output += `\n   Errors: ${JSON.stringify(result.errors)}`
    }
    return output
  }).join('\n\n')
}

/**
 * Handle browser task execution
 */
async function handleBrowserTask(args) {
  const { task, url } = args

  debug(config, `Executing browser task: ${task}`)

  try {
    const result = await executeBrowserTask(task, url)

    const formattedActions = formatActions(result.actions)
    const success = result.success

    return {
      content: [
        {
          type: 'text',
          text: `${success ? '✅' : '❌'} **Browser Task ${success ? 'Completed' : 'Failed'}**

**Task:** ${task}
${url ? `**URL:** ${url}\n` : ''}

## Actions Performed

${formattedActions}

## Test Plan

\`\`\`
${result.test_plan}
\`\`\`

**Result:** ${success ? 'Task completed successfully' : 'Task failed - see errors above'}`,
        },
      ],
      isError: !success,
    }

  } catch (error) {
    debug(config, `Error executing browser task: ${error.message}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ Failed to Execute Browser Task

**Task:** ${task}
**Error:** ${error.message}

**Troubleshooting:**
1. Ensure the AI server is running
2. Check your API connection
3. Verify the Robot server is accessible
4. Try a simpler task description

**Debug Info:**
\`\`\`
${error.stack}
\`\`\``,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Register browser task tools
 */
export function registerBrowserTaskTools(server) {
  server.registerTool(
    'helpmetest_do_browser_task',
    {
      title: 'Browser Task Executor (AI Agent)',
      description: `Execute browser automation tasks using an AI agent with autonomous decision-making.

This tool runs an AI agent that:
1. Analyzes the task description
2. Plans the steps needed
3. Executes Robot Framework commands autonomously
4. Evaluates results and adapts
5. Continues until task completion or failure

The agent uses the same thinking loop as browser-use:
- Evaluates current state
- Decides next action
- Executes via Robot Framework
- Tracks progress
- Repeats until done

**Example:**
\`\`\`json
{
  "task": "open helpmetest.com and find the login page",
  "url": "https://helpmetest.com"
}
\`\`\`

The agent will:
1. Navigate to the URL
2. Analyze the page
3. Look for login elements
4. Click/interact as needed
5. Return results

**Best For:**
- Autonomous task execution
- Tasks requiring decision-making
- Multi-step workflows
- Exploratory navigation

**Not For:**
- Building test cases (use interactive commands)
- Debugging specific commands
- Learning Robot Framework syntax

🚨 **AI INSTRUCTION:**
1. Call this tool with the task description
2. Wait for completion (may take time)
3. Analyze the actions performed
4. Report results to user`,
      inputSchema: {
        task: z.string().describe('Natural language description of the browser task to accomplish'),
        url: z.string().optional().describe('Optional starting URL - agent will navigate here first'),
      },
    },
    async (args) => {
      debug(config, `Browser task tool called: ${JSON.stringify(args)}`)
      return await handleBrowserTask(args)
    }
  )
}
