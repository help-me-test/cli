/**
 * Update Command
 * 
 * Updates the HelpMeTest CLI tool to the latest version by downloading
 * and running the official install script from helpmetest.com/install
 */

import { spawn } from 'child_process'
import { colors, output } from '../utils/colors.js'
import { getVersion } from '../utils/version.js'
import { log } from '../utils/log.js'

/**
 * Update command handler
 * @param {Object} options - Command options
 */
export default async function updateCommand(options = {}) {
  const currentVersion = getVersion()
  
  output.info(`${colors.brand('HelpMeTest CLI')} Update`)
  output.dim(`Current version: ${colors.highlight(currentVersion)}`)
  log('')
  
  if (options.dryRun) {
    output.info('Dry run mode - showing what would be executed:')
    output.dim('Command: curl -fsSL https://helpmetest.com/install | bash')
    output.dim('This would download and run the official HelpMeTest installer script')
    return
  }
  
  if (options.verbose) {
    output.info('Downloading and running the official HelpMeTest installer...')
    output.dim('Script URL: https://helpmetest.com/install')
    log('')
  }
  
  try {
    // Execute the install script
    const installProcess = spawn('bash', ['-c', 'curl -fsSL https://helpmetest.com/install | bash'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Ensure the script runs with proper environment
        DEBUG: options.verbose ? '1' : '0'
      }
    })
    
    installProcess.on('close', (code) => {
      log('')
      if (code === 0) {
        output.success('✅ Update completed successfully!')
        output.info('You may need to restart your terminal or run:')
        output.dim('  source ~/.bashrc  # or ~/.zshrc')
        output.info('To verify the update, run:')
        output.dim('  helpmetest --version')
      } else {
        output.error(`❌ Update failed with exit code ${code}`)
        output.info('Please try again or install manually from:')
        output.dim('  https://helpmetest.com/docs/installation')
        process.exit(code)
      }
    })
    
    installProcess.on('error', (error) => {
      output.error(`❌ Failed to run update script: ${error.message}`)
      output.info('Please ensure you have curl and bash installed, or install manually from:')
      output.dim('  https://helpmetest.com/docs/installation')
      process.exit(1)
    })
    
  } catch (error) {
    output.error(`❌ Update failed: ${error.message}`)
    output.info('Please try installing manually from:')
    output.dim('  https://helpmetest.com/docs/installation')
    process.exit(1)
  }
}