/**
 * Version Management Utility
 * 
 * Centralized version management that reads from package.json
 * to ensure consistency across the CLI application.
 */

import packageJson from '../../package.json' with { type: 'json' }

/**
 * Get the current version from package.json
 * @returns {string} Current version
 */
export const getVersion = () => {
  return packageJson.version
}

/**
 * Get the package name from package.json
 * @returns {string} Package name
 */
export const getPackageName = () => {
  return packageJson.name
}

/**
 * Get user agent string with current version
 * @returns {string} User agent string
 */
export const getUserAgent = () => {
  return `HelpMeTest-CLI/${getVersion()}`
}

/**
 * Get MCP server info with current version
 * @returns {Object} MCP server information
 */
export const getMcpServerInfo = () => {
  return {
    name: 'helpmetest-mcp-server',
    version: getVersion(),
    description: 'HelpMeTest MCP Server - Health monitoring and system metrics via Model Context Protocol',
    author: 'HelpMeTest',
    license: 'MIT',
    homepage: 'https://helpmetest.com',
    repository: 'https://github.com/helpmetest/cli',
  }
}

/**
 * Get version info for display
 * @returns {Object} Version information
 */
export const getVersionInfo = () => {
  return {
    version: getVersion(),
    name: getPackageName(),
    userAgent: getUserAgent(),
  }
}

// Export version as default for convenience
export default getVersion()