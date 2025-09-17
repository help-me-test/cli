/**
 * Management MCP Tools
 * Provides management and administrative tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { deleteHealthCheck, undoUpdate } from '../utils/api.js'

/**
 * Handle delete health check tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.name - Health check name to delete
 * @returns {Object} Delete health check result
 */
async function handleDeleteHealthCheck(args) {
  const { name } = args
  
  debug(config, `Deleting health check: ${name}`)
  
  try {
    const result = await deleteHealthCheck(name)
    debug(config, `Health check deletion result: ${JSON.stringify(result)}`)
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Health Check Deleted Successfully

**Deleted:** ${name}

**Note:** This operation creates an audit trail and can potentially be undone using the 'helpmetest_undo_update' command if the deletion was made in error.

**Raw Response:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error deleting health check: ${error.message}`)
    
    const errorResponse = {
      error: true,
      name,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle undo update tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.updateId - ID of the update to undo
 * @returns {Object} Undo update result
 */
async function handleUndoUpdate(args) {
  const { updateId } = args
  
  debug(config, `Undoing update: ${updateId}`)
  
  try {
    const result = await undoUpdate(updateId)
    debug(config, `Undo update result: ${JSON.stringify(result)}`)
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Update Undone Successfully

**Update ID:** ${updateId}
**Status:** Successfully reverted

The specified update has been undone and the previous state has been restored.

**Details:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`

**Note:** This operation itself creates a new update entry in the audit trail. If you need to undo this undo operation, you would need to use the new update ID from this response.`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error undoing update: ${error.message}`)
    
    const errorResponse = {
      error: true,
      updateId,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null
      }
    }
    
    let errorExplanation = `❌ Undo Operation Failed

**Update ID:** ${updateId}
**Error:** ${error.message}

**Possible Reasons:**
1. Update ID does not exist or is invalid
2. Update is not revertable (some operations cannot be undone)
3. Update has already been undone
4. Insufficient permissions to undo this update
5. API connection or authentication issue

**Troubleshooting:**
1. Verify the update ID is correct
2. Check if the update type supports undo operations
3. Ensure you have the necessary permissions
4. Try checking the updates feed to see available update IDs

**Debug Information:**
\`\`\`json
${JSON.stringify(errorResponse, null, 2)}
\`\`\``
    
    return {
      content: [
        {
          type: 'text',
          text: errorExplanation,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Register management-related MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerManagementTools(server) {
  // Register delete_health_check tool
  server.registerTool(
    'helpmetest_delete_health_check',
    {
      title: 'Help Me Test: Delete Health Check Tool',
      description: 'Delete a health check by name. This operation creates an audit trail in the updates feed and can potentially be undone using the undo_update tool if the update is revertable.',
      inputSchema: {
        name: z.string().describe('Health check name to delete'),
      },
    },
    async (args) => {
      debug(config, `Delete health check tool called with args: ${JSON.stringify(args)}`)
      return await handleDeleteHealthCheck(args)
    }
  )

  // Register undo_update tool
  server.registerTool(
    'helpmetest_undo_update',
    {
      title: 'Help Me Test: Undo Update Tool',
      description: 'Undo a previous update by update ID. Can revert various operations including test deletion, modification, etc. if the update is revertable.',
      inputSchema: {
        updateId: z.string().describe('ID of the update to undo'),
      },
    },
    async (args) => {
      debug(config, `Undo update tool called with args: ${JSON.stringify(args)}`)
      return await handleUndoUpdate(args)
    }
  )
}