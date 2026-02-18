/**
 * Install Command Handler
 * 
 * Handles the install mcp command for setting up MCP integration
 * with various editors (Cursor, VSCode, Claude).
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { output } from '../utils/colors.js'
import { apiPost } from '../utils/api.js'
import open from 'open'
import inquirer from 'inquirer'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { getVersion } from '../utils/version.js'
import { log } from '../utils/log.js'

const execAsync = promisify(exec)

/**
 * Notify server about MCP installation
 * @param {string} editor - Editor name (cursor, code, claude, vscode)
 */
async function notifyMcpInstalled(editor) {
  try {
    await apiPost('/api/achievements/mcp-installed', {
      editor,
      hostname: os.hostname()
    })
    output.success(`MCP installation recorded`)
  } catch (error) {
    output.error(`Failed to record MCP installation: ${error.message}`)
    if (error.response?.details) {
      output.info(error.response.details)
    }
  }
}

/**
 * Check if an editor is installed by checking both PATH and installation folders
 * @param {string} editor - Editor name (cursor, code, claude)
 * @returns {Promise<boolean>} - True if editor is installed
 */
async function checkEditor(editor) {
  const platform = os.platform()

  // First check PATH
  try {
    const pathCommand = platform === 'win32' ? 'where' : 'which'
    await execAsync(`${pathCommand} ${editor}`)
    return true
  } catch {
    // If not in PATH, check platform-specific installation folders
    if (platform === 'darwin') {
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
    } else if (platform === 'win32') {
      // Check Windows-specific paths
      const windowsPaths = {
        code: [
          path.join('C:', 'Program Files', 'Microsoft VS Code', 'Code.exe'),
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe')
        ],
        cursor: [
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Cursor', 'Cursor.exe'),
          path.join('C:', 'Program Files', 'Cursor', 'Cursor.exe')
        ],
        claude: [
          path.join(os.homedir(), 'AppData', 'Local', 'Claude', 'Claude.exe')
        ]
      }

      const paths = windowsPaths[editor]
      if (!paths) return false

      for (const editorPath of paths) {
        try {
          await fs.promises.access(editorPath, fs.constants.F_OK)
          return true
        } catch {
          // Continue checking other paths
        }
      }

      return false
    }

    return false
  }
}

/**
 * Check if Claude Desktop is installed
 * @returns {Promise<boolean>} - True if Claude Desktop is installed
 */
async function checkClaudeDesktop() {
  const platform = os.platform()
  
  let possiblePaths = []
  
  switch (platform) {
    case 'darwin': // macOS
      possiblePaths = [
        '/Applications/Claude.app'
      ]
      break
    case 'win32': // Windows
      possiblePaths = [
        path.join(os.homedir(), 'AppData', 'Local', 'Claude', 'Claude.exe'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'Claude.exe'),
        'C:\\Program Files\\Claude\\Claude.exe',
        'C:\\Program Files (x86)\\Claude\\Claude.exe'
      ]
      break
    case 'linux': // Linux
      possiblePaths = [
        '/usr/bin/claude',
        '/usr/local/bin/claude',
        path.join(os.homedir(), '.local', 'share', 'applications', 'claude'),
        '/opt/Claude/claude'
      ]
      break
    default:
      return false
  }
  
  // Check if any of the possible paths exist
  for (const claudePath of possiblePaths) {
    try {
      await fs.promises.access(claudePath, fs.constants.F_OK)
      return true
    } catch {
      // Continue checking other paths
    }
  }
  
  return false
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

    // Update config with the provided token
    const { config } = await import('../utils/config.js')
    config.apiToken = apiToken

    // Detect correct API URL and authenticate
    let userInfo
    try {
      const { detectApiAndAuth } = await import('../utils/api.js')
      userInfo = await detectApiAndAuth()
    } catch (error) {
      if (error.status === 401) {
        output.error('Authentication failed: Invalid API token')
        output.info('The provided API token is not valid or has been revoked.')
        output.info('Please check your token at https://helpmetest.com/settings or https://slava.helpmetest.com/settings')
        process.exit(1)
      }
      // If getUserInfo fails for other reasons, continue anyway
      userInfo = {}
    }

    const companyName = userInfo.companyName || userInfo.requestCompany?.name || 'HelpMeTest'

    // Show all editor options without detection
    const editorChoices = [
      { name: 'Claude Code', value: 'claude' },
      { name: 'Claude Desktop (.mcpb extension)', value: 'claude-desktop' },
      { name: 'VSCode', value: 'code' },
      { name: 'Cursor', value: 'cursor' },
      { name: 'Other (.mcp.json config)', value: 'mcp-json' }
    ]

    // Check for available binaries (disabled - now showing all options)
    // const editors = [
    //   { name: 'Claude Code', value: 'claude' },
    //   { name: 'Claude Desktop (.mcpb extension)', value: 'claude-desktop' },
    //   { name: 'VSCode', value: 'code' },
    //   { name: 'Cursor', value: 'cursor' },
    //   { name: 'Other (.mcp.json config)', value: 'mcp-json' }
    // ]

    // const checks = await Promise.all([
    //   checkEditor('claude'),
    //   Promise.resolve(true), // Always show Claude Desktop option
    //   checkEditor('code'),
    //   checkEditor('cursor'),
    //   Promise.resolve(true) // Always show MCP JSON option
    // ])

    // const editorChoices = editors.map((editor, index) => ({
    //   name: `${editor.name}${checks[index] ? '' : ' (not installed)'}`,
    //   value: editor.value,
    //   disabled: false
    // }))

    // const availableCount = checks.filter(Boolean).length
    // if (availableCount === 0) {
    //   output.warning('No supported editors found (cursor, code, claude)')
    //   return
    // }

    // Show interactive selection
    let selectedEditor

    // For testing purposes, if all available editors should be selected
    if (options.all) {
      selectedEditor = editorChoices[0].value
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
    // (removed installation check - now showing all options regardless of install status)
    
    switch (selectedEditor) {
      case 'claude':
        await handleClaudeInstall(apiToken, companyName)
        break
      case 'claude-desktop':
        await handleClaudeDesktopInstall(apiToken, companyName)
        break
      case 'code':
        await handleVSCodeInstall(apiToken, companyName)
        break
      case 'cursor':
        await handleCursorInstall(apiToken, companyName)
        break
      case 'mcp-json':
        await handleMcpJsonInstall(apiToken, companyName)
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
    await notifyMcpInstalled('cursor')
  } catch (error) {
    output.info('Could not open link automatically. Manual configuration:')
    const config = generateMcpConfig(apiToken, companyName)
    log(JSON.stringify(config, null, 2))
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
    await notifyMcpInstalled('vscode')
  } catch (error) {
    output.info('Could not open link automatically. Manual configuration:')
    const config = generateMcpConfig(apiToken, companyName)
    log(JSON.stringify(config, null, 2))
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
        log(addCommand)
        return
      }
    } else {
      output.info('Could not install automatically. Run this command:')
      log(addCommand)
      return
    }
  }

  // Notify server about MCP installation
  if (installed) {
    await notifyMcpInstalled('claude')
  }

  // Show the list after installation
  try {
    const listResult = await execAsync('claude mcp list')
    log(listResult.stdout)
  } catch (error) {
    // Ignore list errors
  }
}

/**
 * Handle MCP JSON config file creation
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 */
async function handleMcpJsonInstall(apiToken, companyName) {
  const serverName = `helpmetest-${companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
  const mcpJsonPath = './.mcp.json'
  
  let existingConfig = {}
  
  // Read existing .mcp.json if it exists
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const configContent = fs.readFileSync(mcpJsonPath, 'utf8')
      existingConfig = JSON.parse(configContent)
    } catch (error) {
      output.warning('Existing .mcp.json file is invalid JSON, creating new one')
      existingConfig = {}
    }
  }
  
  // Ensure mcpServers object exists
  if (!existingConfig.mcpServers) {
    existingConfig.mcpServers = {}
  }
  
  // Add our server
  existingConfig.mcpServers[serverName] = {
    type: "stdio",
    command: "helpmetest",
    args: ["mcp", apiToken]
  }
  
  try {
    // Write the config file
    fs.writeFileSync(mcpJsonPath, JSON.stringify(existingConfig, null, 2))
    
    output.success(`Created/updated .mcp.json file in current directory`)
    output.info(`Server name: ${serverName}`)
    output.info('')
    output.info('Place this .mcp.json file in your project folder or any folder where you run your AI assistant from.')
    output.info('Your AI tool should automatically pick up this configuration when started from that folder.')
    output.info('')
    output.info('If your AI tool is already running, you may need to restart it to load the new MCP server.')
    
    await notifyMcpInstalled('mcp-json')
    
  } catch (error) {
    output.error(`Failed to create .mcp.json file: ${error.message}`)
    
    const config = {
      mcpServers: {
        [serverName]: {
          type: "stdio",
          command: "helpmetest",
          args: ["mcp", apiToken]
        }
      }
    }
    
    output.info('Manual configuration - create .mcp.json with:')
    log(JSON.stringify(config, null, 2))
  }
}

/**
 * Handle Claude Desktop installation (.mcpb file)
 * @param {string} apiToken - API token
 * @param {string} companyName - Company name
 */
async function handleClaudeDesktopInstall(apiToken, companyName) {
  const { execSync } = await import('child_process')
  
  const manifest = {
    "manifest_version": "0.2",
    "name": "helpmetest",
    "version": getVersion(),
    "description": `HelpMeTest MCP Server - Comprehensive health monitoring, test automation, and system status for ${companyName}`,
    "long_description": `The HelpMeTest MCP extension provides AI-powered monitoring and testing capabilities for ${companyName}.

**Key Features:**
• **Health Check Monitoring** - Monitor URLs, services, and applications with automatic alerting
• **Robot Framework Test Automation** - Create, run, and debug automated tests interactively
• **System Status & Metrics** - Real-time system monitoring and performance insights
• **Interactive Test Development** - Debug tests step-by-step with immediate feedback
• **Deployment Tracking** - Correlate deployments with test failures for faster debugging
• **Keywords Explorer** - Discover and learn Robot Framework capabilities

**AI Integration:**
This extension enables AI assistants to perform comprehensive system monitoring and test automation tasks. Ask your AI to check system health, run tests, analyze failures, or create new automated tests - all through natural language commands.

Perfect for DevOps teams, QA engineers, and developers who want AI-assisted monitoring and testing workflows.`,
    "author": {
      "name": "HelpMeTest",
      "email": "support@helpmetest.com",
      "url": "https://helpmetest.com"
    },
    "homepage": "https://helpmetest.com",
    "documentation": "https://helpmetest.com/docs/mcp", 
    "support": "https://github.com/help-me-test/helpmetest/issues",
    "repository": {
      "type": "git",
      "url": "https://github.com/help-me-test/helpmetest"
    },
    "keywords": [
      "mcp",
      "health-monitoring",
      "test-automation", 
      "robot-framework",
      "system-monitoring",
      "devops",
      "ci-cd",
      "qa-testing",
      "deployment-tracking",
      "ai-tools"
    ],
    "server": {
      "type": "binary",
      "entry_point": "helpmetest",
      "mcp_config": {
        "command": "helpmetest",
        "args": [
          "mcp",
          apiToken
        ],
        "env": {}
      }
    },
    "tools": [
      {
        "name": "health_check",
        "description": "Perform health checks on URLs and monitor system availability"
      },
      {
        "name": "run_test",
        "description": "Execute Robot Framework tests by name, tag, or ID with detailed results"
      },
      {
        "name": "system_status", 
        "description": "Get comprehensive system metrics and monitoring status"
      },
      {
        "name": "run_interactive_command",
        "description": "Debug Robot Framework tests interactively with step-by-step execution"
      },
      {
        "name": "create_test",
        "description": "Create new automated tests with Robot Framework"
      },
      {
        "name": "keywords",
        "description": "Search and explore available Robot Framework keywords and libraries"
      },
      {
        "name": "get_deployments",
        "description": "Retrieve deployment history for correlating with test failures"
      }
    ],
    "license": "MIT",
    "compatibility": {
      "claude_desktop": ">=1.0.0",
      "platforms": ["darwin", "win32", "linux"]
    }
  }

  const tmpDir = `/tmp/helpmetest-mcpb-${Date.now()}`
  const mcpbFile = `/tmp/helpmetest-${companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.mcpb`
  
  try {
    // Create temp directory
    execSync(`mkdir -p "${tmpDir}"`)
    
    // Write manifest.json
    fs.writeFileSync(`${tmpDir}/manifest.json`, JSON.stringify(manifest, null, 2))
    
    // Create .mcpb file (zip archive with just manifest.json)
    execSync(`cd "${tmpDir}" && zip -r "${mcpbFile}" manifest.json`)
    
    // Clean up temp directory  
    execSync(`rm -rf "${tmpDir}"`)
    
    output.success(`Created .mcpb file: ${mcpbFile}`)
    
    // Open with system default handler
    await open(mcpbFile)
    output.success('Opened .mcpb file with Claude Desktop')
    output.info('Follow the installation prompts in Claude Desktop')
    
    await notifyMcpInstalled('claude-desktop')
    
  } catch (error) {
    output.error(`Failed to create .mcpb file: ${error.message}`)
    output.info('Manual installation: Create a .mcpb zip file with manifest.json')
  }
}

export { getCliCommand }