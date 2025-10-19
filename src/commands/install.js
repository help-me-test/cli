/**
 * Install Command Handler
 * 
 * Handles the install mcp command for setting up MCP integration
 * with various editors (Cursor, VSCode, Claude).
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { output } from '../utils/colors.js'
import { getUserInfo, apiPost } from '../utils/api.js'
import open from 'open'
import inquirer from 'inquirer'

const execAsync = promisify(exec)

/**
 * Check if an editor is installed by checking both PATH and Applications folder
 * @param {string} editor - Editor name (cursor, code, claude)
 * @returns {Promise<boolean>} - True if editor is installed
 */
async function checkEditor(editor) {
  // First check PATH
  try {
    await execAsync(`which ${editor}`)
    return true
  } catch {
    // If not in PATH, check Applications folder
    const appNames = {
      cursor: 'Cursor.app',
      code: 'Visual Studio Code.app', 
      claude: 'Claude.app'
    }
    
    const appName = appNames[editor]
    if (!appName) return false
    
    try {
      await execAsync(`test -d "/Applications/${appName}"`)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Get API token from argument or environment
 * @param {string} token - Token from command line argument
 * @returns {string} - API token
 */
function getApiToken(token) {
  return token || process.env.HELPMETEST_API_TOKEN
}

/**
 * Get the command path for this CLI
 * @returns {string} - Path to the CLI executable
 */
function getCliCommand() {
  // If execPath contains 'helpmetest', it's a compiled binary - use execPath
  if (process.execPath.includes('helpmetest')) {
    return process.execPath
  }
  
  // Otherwise it's development mode - use argv[1] (script path)
  return process.argv[1]
}


/**
 * Generate MCP configuration for VSCode/Cursor
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 * @returns {Object} - MCP configuration object
 */
function generateMcpConfig(apiToken, companyName) {
  const serverName = `HelpMeTest for ${companyName}`
  
  return {
    [serverName]: {
      "type": "stdio",
      "command": getCliCommand(),
      "args": [
        "mcp",
        apiToken
      ]
    }
  }
}

/**
 * Handle install mcp command execution
 * @param {string} token - API token (optional, will use env var if not provided)
 * @param {Object} options - Command options
 */
export default async function installCommand(token, options) {
  try {
    const apiToken = getApiToken(token)

    if (!apiToken) {
      output.error('API token is required. Provide it as an argument or set HELPMETEST_API_TOKEN environment variable.')
      output.info('Usage: helpmetest install mcp HELP-your-token-here')
      process.exit(1)
    }

    // Test authentication first
    try {
      const { getAllTests } = await import('../utils/api.js')
      await getAllTests()
    } catch (error) {
      if (error.status >= 400) {
        output.error('Authentication failed: Invalid API token')
        output.info('The provided API token is not valid or has been revoked.')
        output.info('Please check your token at https://helpmetest.com/settings')
        process.exit(1)
      }
      throw error
    }

    let userInfo
    try {
      userInfo = await getUserInfo()
    } catch (error) {
      // If getUserInfo fails but we passed auth test above, continue anyway
      userInfo = {}
    }

    const companyName = userInfo.companyName || userInfo.requestCompany?.name || 'HelpMeTest'

    // Check for available binaries
    const editors = [
      { name: 'Claude Code', value: 'claude' },
      { name: 'VSCode', value: 'code' },
      { name: 'Cursor', value: 'cursor' }
    ]

    const checks = await Promise.all([
      checkEditor('claude'),
      checkEditor('code'),
      checkEditor('cursor')
    ])

    const editorChoices = editors.map((editor, index) => ({
      name: `${editor.name}${checks[index] ? '' : ' (not installed)'}`,
      value: editor.value,
      disabled: false
    }))

    const availableCount = checks.filter(Boolean).length
    if (availableCount === 0) {
      output.warning('No supported editors found (cursor, code, claude)')
      return
    }

    // Show interactive selection
    let selectedEditor
    
    // For testing purposes, if all available editors should be selected
    if (options.all) {
      const availableEditor = editorChoices.find((_, index) => checks[index])
      selectedEditor = availableEditor ? availableEditor.value : editorChoices[0].value
    } else {
      const result = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedEditor',
          message: 'Select editor to install MCP integration:',
          choices: editorChoices
        }
      ])
      selectedEditor = result.selectedEditor
    }

    // Generate installation instructions for selected editor
    const editorIndex = editors.findIndex(e => e.value === selectedEditor)
    const isInstalled = checks[editorIndex]
    
    if (!isInstalled) {
      output.warning(`${editors[editorIndex].name} is not installed on this system - cannot install MCP integration`)
      return
    }
    
    switch (selectedEditor) {
      case 'cursor':
        await handleCursorInstall(apiToken, companyName)
        break
      case 'code':
        await handleVSCodeInstall(apiToken, companyName)
        break
      case 'claude':
        await handleClaudeInstall(apiToken, companyName)
        break
    }

  } catch (error) {
    output.error(`Failed to install MCP integration: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Handle Cursor installation
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 */
async function handleCursorInstall(apiToken, companyName) {
  // Generate proper MCP config for Cursor
  const serverName = `HelpMeTest for ${companyName}`
  const mcpConfig = {
    name: serverName,
    type: "stdio",
    command: getCliCommand(),
    args: ["mcp", apiToken]
  }

  const configBase64 = Buffer.from(JSON.stringify(mcpConfig)).toString('base64')
  const deeplinkUrl = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${configBase64}`

  try {
    await open(deeplinkUrl)
    output.success('Opened Cursor installation link')

    // Notify server about MCP installation
    try {
      await apiPost('/api/achievements/mcp-installed', { editor: 'cursor' })
    } catch (error) {
      // Don't fail installation if notification fails
    }
  } catch (error) {
    output.info('Could not open link automatically. Manual configuration:')
    const config = generateMcpConfig(apiToken, companyName)
    console.log(JSON.stringify(config, null, 2))
  }
}

/**
 * Handle VSCode installation
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 */
async function handleVSCodeInstall(apiToken, companyName) {
  // Generate VSCode MCP install URL
  const serverName = `HelpMeTest for ${companyName}`
  const installUrl = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({
    name: serverName,
    type: "stdio",
    command: getCliCommand(),
    args: ["mcp", apiToken]
  }))}`

  try {
    await open(installUrl)
    output.success('Opened VSCode installation link')

    // Notify server about MCP installation
    try {
      await apiPost('/api/achievements/mcp-installed', { editor: 'vscode' })
    } catch (error) {
      // Don't fail installation if notification fails
    }
  } catch (error) {
    output.info('Could not open link automatically. Manual configuration:')
    const config = generateMcpConfig(apiToken, companyName)
    console.log(JSON.stringify(config, null, 2))
  }
}

/**
 * Handle Claude installation
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 */
async function handleClaudeInstall(apiToken, companyName) {
  // Claude requires server names with only letters, numbers, hyphens, and underscores
  const safeServerName = `HelpMeTest-for-${companyName.replace(/[^a-zA-Z0-9-_]/g, '-')}`
  const addCommand = `claude mcp add "${safeServerName}" ${getCliCommand()} mcp ${apiToken}`

  let installed = false

  try {
    const result = await execAsync(addCommand)
    output.success('Successfully added to Claude MCP')
    installed = true
  } catch (error) {
    if (error.message.includes('already exists')) {
      // Remove existing and re-add
      const removeCommand = `claude mcp remove "${safeServerName}"`
      try {
        await execAsync(removeCommand)
        await execAsync(addCommand)
        output.success('Successfully updated Claude MCP')
        installed = true
      } catch (updateError) {
        output.info('Could not install automatically. Run this command:')
        console.log(addCommand)
        return
      }
    } else {
      output.info('Could not install automatically. Run this command:')
      console.log(addCommand)
      return
    }
  }

  // Notify server about MCP installation
  if (installed) {
    try {
      await apiPost('/api/achievements/mcp-installed', { editor: 'claude' })
    } catch (error) {
      // Don't fail installation if notification fails
    }
  }

  // Show the list after installation
  try {
    const listResult = await execAsync('claude mcp list')
    console.log(listResult.stdout)
  } catch (error) {
    // Ignore list errors
  }
}

export { getCliCommand }