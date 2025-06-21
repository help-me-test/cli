/**
 * MCP Server Configuration
 * 
 * Configuration constants and defaults for the MCP server implementation.
 */

import { getMcpServerInfo } from './version.js'

/**
 * Default MCP server configuration
 */
export const MCP_SERVER_DEFAULTS = getMcpServerInfo()

/**
 * Transport configuration defaults
 */
export const TRANSPORT_DEFAULTS = {
  http: {
    port: 3000,
    host: 'localhost',
    path: '/sse',
  },
  stdio: {
    // No additional config needed for stdio
  },
}

/**
 * Tool configuration
 */
export const TOOL_CONFIGS = {
  health_check: {
    name: 'health_check',
    description: 'Perform a health check on a specified URL',
    defaultTimeout: 30,
    maxTimeout: 300,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to check',
          pattern: '^https?://.+',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (optional)',
          minimum: 1,
          maximum: 300,
          default: 30,
        },
      },
      required: ['url'],
    },
  },
  system_status: {
    name: 'system_status',
    description: 'Get current system status and metrics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
}

/**
 * Server capabilities configuration
 */
export const SERVER_CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {},
  logging: {},
}

/**
 * Environment-specific configuration
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const configs = {
    development: {
      debug: true,
      verbose: true,
      logLevel: 'debug',
    },
    production: {
      debug: false,
      verbose: false,
      logLevel: 'info',
    },
    test: {
      debug: false,
      verbose: false,
      logLevel: 'error',
    },
  }

  return configs[env] || configs.development
}

/**
 * Get complete MCP server configuration
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} Complete server configuration
 */
export const getMcpServerConfig = (overrides = {}) => {
  const envConfig = getEnvironmentConfig()
  
  return {
    ...MCP_SERVER_DEFAULTS,
    ...envConfig,
    transport: TRANSPORT_DEFAULTS,
    tools: TOOL_CONFIGS,
    capabilities: SERVER_CAPABILITIES,
    ...overrides,
  }
}

/**
 * Validate MCP server configuration
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if configuration is valid
 * @throws {Error} If configuration is invalid
 */
export const validateMcpConfig = (config) => {
  const required = ['name', 'version']
  const missing = required.filter(key => !config[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required MCP configuration: ${missing.join(', ')}`)
  }

  if (config.name && typeof config.name !== 'string') {
    throw new Error('MCP server name must be a string')
  }

  if (config.version && typeof config.version !== 'string') {
    throw new Error('MCP server version must be a string')
  }

  return true
}

/**
 * Get tool configuration by name
 * @param {string} toolName - Name of the tool
 * @returns {Object|null} Tool configuration or null if not found
 */
export const getToolConfig = (toolName) => {
  return TOOL_CONFIGS[toolName] || null
}

/**
 * Get all available tool names
 * @returns {string[]} Array of tool names
 */
export const getAvailableTools = () => {
  return Object.keys(TOOL_CONFIGS)
}

/**
 * Check if a tool is available
 * @param {string} toolName - Name of the tool to check
 * @returns {boolean} True if tool is available
 */
export const isToolAvailable = (toolName) => {
  return toolName in TOOL_CONFIGS
}