/**
 * Colors utility for CLI output
 * 
 * Provides consistent colored output across the CLI application
 */

import chalk from 'chalk'

/**
 * Color utilities for different types of output
 */
const colors = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  
  // UI elements
  title: chalk.bold.cyan,
  subtitle: chalk.bold,
  dim: chalk.dim,
  highlight: chalk.magenta,
  
  // Data colors
  value: chalk.white,
  key: chalk.cyan,
  url: chalk.underline.blue,
  
  // Special formatting
  brand: chalk.bold.magenta,
  command: chalk.green,
  argument: chalk.yellow,
  option: chalk.cyan,
}

/**
 * Formatted output functions
 */
const output = {
  /**
   * Success message with checkmark
   * @param {string} message - Success message
   */
  success: (message) => {
    console.log(colors.success('✓'), message)
  },

  /**
   * Error message with X mark
   * @param {string} message - Error message
   */
  error: (message) => {
    console.error(colors.error('✗'), message)
  },

  /**
   * Warning message with warning symbol
   * @param {string} message - Warning message
   */
  warning: (message) => {
    console.log(colors.warning('⚠'), message)
  },

  /**
   * Info message with info symbol
   * @param {string} message - Info message
   */
  info: (message) => {
    console.log(colors.info('ℹ'), message)
  },

  /**
   * Title with brand styling
   * @param {string} title - Title text
   */
  title: (title) => {
    console.log(colors.brand('━━━ ') + colors.title(title) + colors.brand(' ━━━'))
  },

  /**
   * Key-value pair output
   * @param {string} key - Key name
   * @param {string} value - Value
   */
  keyValue: (key, value) => {
    console.log(`  ${colors.key(key + ':')} ${colors.value(value)}`)
  },

  /**
   * Command example
   * @param {string} command - Command to highlight
   */
  command: (command) => {
    console.log(`  ${colors.dim('$')} ${colors.command(command)}`)
  },

  /**
   * Section header
   * @param {string} header - Header text
   */
  section: (header) => {
    console.log('\n' + colors.subtitle(header))
  },

  /**
   * Dry run output
   * @param {string} message - What would be executed
   */
  dryRun: (message) => {
    console.log(colors.dim('[DRY RUN]'), message)
  },

  /**
   * Verbose output
   * @param {string} message - Verbose message
   */
  verbose: (message) => {
    console.log(colors.dim('[VERBOSE]'), colors.dim(message))
  },

  /**
   * Dimmed output (faint text)
   * @param {string} message - Message to dim
   */
  dim: (message) => {
    console.log(colors.dim(message))
  },
}

export {
  colors,
  output,
  chalk,
}