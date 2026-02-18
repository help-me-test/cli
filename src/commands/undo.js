/**
 * Undo Command Handler
 * 
 * Handles undoing operations that have been recorded in the updates feed.
 * This allows reverting deletions and other operations that support undo.
 */

import { output } from '../utils/colors.js'
import { config } from '../utils/config.js'
import { undoUpdate, displayApiError } from '../utils/api.js'
import { debug } from '../utils/log.js'

/**
 * Handle undo command execution
 * @param {string} updateId - Update ID to undo
 * @param {Object} options - Command options
 * @param {boolean} options.verbose - Show detailed output
 * @param {boolean} options.dryRun - Show what would be undone without actually undoing
 */
export default async function undoCommand(updateId, options) {
  try {
    const { verbose = false, dryRun = false } = options

    if (!updateId) {
      output.error('Update ID is required')
      output.info('Usage: helpmetest undo <update-id>')
      output.info('Update IDs are provided when you delete tests or health checks')
      process.exit(1)
    }

    debug(config, `Undo command: updateId=${updateId}, dryRun=${dryRun}, verbose=${verbose}`)

    if (dryRun) {
      output.section('Dry Run - Undo Operation')
      output.keyValue('Update ID', updateId)
      output.keyValue('Action', 'UNDO (not executed)')
      output.info('This would attempt to reverse the operation recorded in this update')
      output.success('Dry run completed - no actual undo performed')
      return
    }

    if (verbose) {
      output.section('Undoing Operation')
      output.keyValue('Update ID', updateId)
    }

    const startTime = Date.now()
    const result = await undoUpdate(updateId)
    const duration = Date.now() - startTime

    if (verbose) {
      output.section('Undo Result:')
      output.keyValue('Status', 'Success')
      output.keyValue('Update ID', updateId)
      output.keyValue('Action', result.action || 'Unknown')
      output.keyValue('Duration', `${duration}ms`)
      
      if (result.message) {
        output.keyValue('Message', result.message)
      }
      
      if (result.restoredData) {
        output.section('Restored Data:')
        if (result.restoredData.name) {
          output.keyValue('Name', result.restoredData.name)
        }
        if (result.restoredData.type) {
          output.keyValue('Type', result.restoredData.type)
        }
      }
      
      output.success('Operation undone successfully')
    } else {
      const actionText = result.action ? ` (${result.action})` : ''
      output.success(`Operation undone successfully${actionText} (${duration}ms)`)
    }

    debug(config, `Undo operation completed in ${duration}ms, action: ${result.action}`)
    
  } catch (error) {
    debug(config, `Undo operation failed: ${error.message}`)
    
    if (error.name === 'ApiError') {
      displayApiError(error, options.verbose)
      
      // Provide helpful suggestions based on error type
      if (error.status === 404) {
        output.info('The update ID may not exist or may not be undoable')
        output.info('Check that the update ID is correct and the operation supports undo')
      } else if (error.status === 409) {
        output.info('The operation may have already been undone or is no longer undoable')
      }
    } else {
      output.error(`Failed to undo operation: ${error.message}`)
    }
    
    process.exit(1)
  }
}
