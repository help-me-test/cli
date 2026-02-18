/**
 * Version Command
 * 
 * Displays the current version of the HelpMeTest CLI tool.
 * Supports both --version/-V flag and version command.
 */

import { colors, output } from '../utils/colors.js'
import { getVersion, getPackageName } from '../utils/version.js'
import { log } from '../utils/log.js'

/**
 * Version command handler
 * @param {Object} options - Command options
 */
export default function versionCommand(options = {}) {
  const version = getVersion()
  const packageName = getPackageName()
  
  if (options.verbose) {
    output.info(`${colors.brand(packageName)} version ${colors.highlight(version)}`)
    output.dim(`Package: ${packageName}`)
    output.dim(`Version: ${version}`)
    output.dim(`Homepage: https://helpmetest.com`)
    output.dim(`Repository: https://github.com/help-me-test/cli`)
  } else {
    // Simple version output for -V flag compatibility
    log(version)
  }
}