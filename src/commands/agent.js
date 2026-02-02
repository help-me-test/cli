/**
 * Agent Command - Launch Claude Code agents with predefined workflows
 *
 * Commands:
 * - helpmetest agent claude - Launch Claude in self-healing mode with HelpMeTest tools enabled
 */

import { spawn } from 'child_process'
import { output } from '../utils/colors.js'
import { apiGet, detectApiAndAuth } from '../utils/api.js'

/**
 * Fetch all instructions from server once
 */
async function fetchAllInstructions() {
  await detectApiAndAuth()
  const response = await apiGet('/api/prompts', {})
  return response
}

/**
 * Launch Claude in self-healing mode with HelpMeTest tools
 */
export async function claude() {
  try {
    // Fetch ALL instructions from server once
    output.dim('📥 Fetching instructions from server...')
    const prompts = await fetchAllInstructions()
    const prompt = prompts.self_healing

    output.success('🤖 Launching Claude Agent with HelpMeTest tools enabled...')
    output.dim('🔧 Self-healing mode active - monitoring for test failures')
    output.dim('💬 Send "stop" or press Ctrl+C to exit')

    // Spawn Claude with HelpMeTest tools enabled and custom prompt
    const args = [
      prompt,
      '--model', 'haiku',
      '--allowed-tools', 'mcp__HelpMeTest*',
      '--append-system-prompt', '\n\n🤖 HELPMETEST AGENT MODE: You have access to all HelpMeTest tools for autonomous test management and debugging.'
    ]

    const claudeProcess = spawn('claude', args, {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    // Handle Claude process exit
    claudeProcess.on('exit', (code) => {
      if (code === 0) {
        output.success('🤖 Claude Agent session ended')
      } else if (code !== null) {
        output.error(`Claude Agent exited with code ${code}`)
      }
      process.exit(code || 0)
    })

    // Handle errors
    claudeProcess.on('error', (err) => {
      if (err.code === 'ENOENT') {
        output.error('Claude Code not found. Install it first:')
        output.info('  npm install -g @anthropic-ai/claude-code')
      } else {
        output.error(`Failed to launch Claude Agent: ${err.message}`)
      }
      process.exit(1)
    })

  } catch (error) {
    output.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

export default {
  claude
}
