/**
 * Delete Command Handler
 * 
 * Handles deletion of health checks and tests with proper error handling
 * and user feedback.
 */

import { output } from '../utils/colors.js'
import { config, debug } from '../utils/config.js'
import { deleteHealthCheck, deleteTest, displayApiError } from '../utils/api.js'

/**
 * Handle delete health check command execution
 * @param {string} name - Health check name to delete
 * @param {Object} options - Command options
 * @param {boolean} options.verbose - Show detailed output
 * @param {boolean} options.dryRun - Show what would be deleted without actually deleting
 */
export async function deleteHealthCheckCommand(name, options) {
  try {
    const { verbose = false, dryRun = false } = options

    if (!name) {
      output.error('Health check name is required')
      output.info('Usage: helpmetest delete health-check <name>')
      process.exit(1)
    }

    debug(config, `Delete health check command: name=${name}, dryRun=${dryRun}, verbose=${verbose}`)

    if (dryRun) {
      output.section('Dry Run - Health Check Deletion')
      output.keyValue('Health Check Name', name)
      output.keyValue('Action', 'DELETE (not executed)')
      output.info('This would delete the health check and all its heartbeat data')
      output.info('An audit record would be created in the updates feed')
      output.success('Dry run completed - no actual deletion performed')
      return
    }

    if (verbose) {
      output.section('Deleting Health Check')
      output.keyValue('Name', name)
    }

    const startTime = Date.now()
    const result = await deleteHealthCheck(name)
    const duration = Date.now() - startTime

    if (verbose) {
      output.section('Deletion Result:')
      output.keyValue('Status', 'Success')
      output.keyValue('Health Check Name', result.name)
      output.keyValue('Update ID', result.updateId)
      output.keyValue('Duration', `${duration}ms`)
      
      if (result.message) {
        output.keyValue('Message', result.message)
      }
      
      output.success('Health check deleted successfully')
      output.info(`You can undo this operation using: helpmetest undo ${result.updateId}`)
    } else {
      output.success(`Health check '${name}' deleted successfully (${duration}ms)`)
      output.info(`Undo with: helpmetest undo ${result.updateId}`)
    }

    debug(config, `Health check deletion completed in ${duration}ms, update ID: ${result.updateId}`)
    
  } catch (error) {
    debug(config, `Health check deletion failed: ${error.message}`)
    
    if (error.name === 'ApiError') {
      displayApiError(error, options.verbose)
    } else {
      output.error(`Failed to delete health check: ${error.message}`)
    }
    
    process.exit(1)
  }
}

/**
 * Handle delete test command execution
 * @param {string} identifier - Test ID, name, or tag to delete
 * @param {Object} options - Command options
 * @param {boolean} options.verbose - Show detailed output
 * @param {boolean} options.dryRun - Show what would be deleted without actually deleting
 */
export async function deleteTestCommand(identifier, options) {
  try {
    const { verbose = false, dryRun = false } = options

    if (!identifier) {
      output.error('Test identifier is required')
      output.info('Usage: helpmetest delete test <identifier>')
      output.info('Identifier can be test name, ID, or tag (tag:tagname)')
      process.exit(1)
    }

    debug(config, `Delete test command: identifier=${identifier}, dryRun=${dryRun}, verbose=${verbose}`)

    if (dryRun) {
      output.section('Dry Run - Test Deletion')
      output.keyValue('Test Identifier', identifier)
      output.keyValue('Action', 'DELETE (not executed)')
      output.info('This would delete the test and create an audit record')
      output.success('Dry run completed - no actual deletion performed')
      return
    }

    if (verbose) {
      output.section('Deleting Test')
      output.keyValue('Identifier', identifier)
    }

    const startTime = Date.now()
    const result = await deleteTest(identifier)
    const duration = Date.now() - startTime

    if (verbose) {
      output.section('Deletion Result:')
      output.keyValue('Status', 'Success')
      output.keyValue('Test ID', result.id)
      output.keyValue('Update ID', result.updateId)
      output.keyValue('Duration', `${duration}ms`)
      
      if (result.message) {
        output.keyValue('Message', result.message)
      }
      
      output.success('Test deleted successfully')
      output.info(`You can undo this operation using: helpmetest undo ${result.updateId}`)
    } else {
      output.success(`Test '${identifier}' deleted successfully (${duration}ms)`)
      output.info(`Undo with: helpmetest undo ${result.updateId}`)
    }

    debug(config, `Test deletion completed in ${duration}ms, update ID: ${result.updateId}`)
    
  } catch (error) {
    debug(config, `Test deletion failed: ${error.message}`)
    
    if (error.name === 'ApiError') {
      displayApiError(error, options.verbose)
    } else {
      output.error(`Failed to delete test: ${error.message}`)
    }
    
    process.exit(1)
  }
}

/**
 * Main delete command handler - shows help for subcommands
 * @param {Object} options - Command options
 */
export default function deleteCommand(options) {
  output.error('Please specify what to delete')
  output.info('Available subcommands:')
  output.info('  helpmetest delete health-check <name>    Delete a health check')
  output.info('  helpmetest delete test <identifier>      Delete a test')
  output.info('')
  output.info('Use --help with any subcommand for more details')
  process.exit(1)
}