/**
 * Command Queue MCP Tools
 * Listens to SSE stream from server for agent commands
 */

import { z } from 'zod'
import { config } from '../utils/config.js'
import { STREAM, POST } from '../utils.js'

// Module-level queue for storing messages (can be used bidirectionally)
// Max 100 items to prevent memory issues
const MAX_QUEUE_SIZE = 100
let queue = []
let messageIdCounter = 0

/**
 * Get all pending messages and clear the queue
 * @returns {Array} All messages from the queue
 */
export function getPendingMessages() {
  const messages = [...queue]
  queue = []
  return messages
}

/**
 * Remove a command from the queue by ID
 * @param {number} messageId - ID of the message to remove
 * @returns {boolean} True if message was removed, false if not found
 */
export function removeMessage(messageId) {
  const initialLength = queue.length
  queue = queue.filter(msg => msg.id !== messageId)
  const removed = queue.length < initialLength

  if (removed) {
    console.log(`[Queue] Removed message ${messageId}, queue size: ${queue.length}`)
  } else {
    console.warn(`[Queue] Message ${messageId} not found in queue`)
  }

  return removed
}

/**
 * Start background listener that continuously receives messages from server
 * and adds them to queue. Runs indefinitely with auto-reconnect.
 */
export async function startBackgroundListener() {
  let retryCount = 0
  const maxRetryDelay = 60000 // 60 seconds max

  while (true) {
    try {
      console.log('[Queue] Starting background listener...')

      const { detectApiAndAuth } = await import('../utils/api.js')
      const userInfo = await detectApiAndAuth()
      const runId = `${userInfo.activeCompany}__interactive__${userInfo.interactiveTimestamp}`

      console.log(`[Queue] Subscribing to interactive session: ${runId}`)

      let buffer = ''

      await STREAM(
        config.apiBaseUrl,
        '/api/stream/events',
        { sessionId: runId },
        (chunk) => {
          buffer += chunk
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (!event.trim()) continue

            try {
              const data = JSON.parse(event.trim())

              console.log('[Queue] Received event:', JSON.stringify(data).substring(0, 200))

              // Only add user messages to the queue
              if (data.sender === 'user' && data.text) {
                // Check for duplicate by messageId
                const isDuplicate = queue.some(msg => msg.messageId === data.messageId)

                if (isDuplicate) {
                  console.log(`[Queue] Skipping duplicate message with messageId: ${data.messageId}`)
                } else {
                  const message = {
                    id: ++messageIdCounter,
                    timestamp: Date.now(),
                    command: data.text,
                    ...data
                  }

                  // Check queue size limit
                  if (queue.length >= MAX_QUEUE_SIZE) {
                    const removed = queue.shift()
                    console.warn(`[Queue] Queue full (${MAX_QUEUE_SIZE}), removed oldest message:`, removed.id)
                  }

                  queue.push(message)
                  console.log(`[Queue] Added user message ${message.id}: "${message.command}" (messageId: ${data.messageId}), queue size: ${queue.length}`)
                }
              }

            } catch (e) {
              console.error('[Queue] Failed to parse message:', e)
            }
          }
        },
        { 'Authorization': `Bearer ${config.apiToken}` }
      )

      // Reset retry count on successful connection
      retryCount = 0

    } catch (err) {
      // Exponential backoff on errors
      retryCount++
      const delay = Math.min(1000 * Math.pow(2, retryCount - 1), maxRetryDelay)
      console.error(`[Queue] Connection error (retry ${retryCount} in ${delay}ms):`, err.message)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

async function waitForCommand(timeout = 60) {
  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeout * 1000)

    let buffer = ''
    let resolved = false

    try {
      await STREAM(
        config.apiBaseUrl,
        '/api/agent/stream',
        {},
        (chunk) => {
          if (resolved) return

          buffer += chunk
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (!event.trim()) continue
            try {
              const data = JSON.parse(event.trim())
              if (data.command && !resolved) {
                resolved = true
                clearTimeout(timeoutId)
                resolve(data.command)
                throw new Error('ABORT_STREAM')
              }
            } catch (e) {
              if (e.message === 'ABORT_STREAM') throw e
            }
          }
        },
        { 'Authorization': `Bearer ${config.apiToken}` }
      )
    } catch (err) {
      if (err.message !== 'ABORT_STREAM') {
        clearTimeout(timeoutId)
        if (!resolved) resolve(null)
      }
    }
  })
}

/**
 * Handle wait for command
 */
async function handleWaitForCommand(args) {
  const { timeout = 60 } = args

  const command = await waitForCommand(timeout)

  if (command) {
    return {
      content: [{
        type: 'text',
        text: command
      }]
    }
  }

  return {
    content: [{
      type: 'text',
      text: `TIMEOUT: No command received in ${timeout} seconds`
    }]
  }
}

/**
 * Handle get pending commands
 */
async function handleGetPendingCommands() {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(queue, null, 2)
    }]
  }
}

/**
 * Handle send to UI
 */
/**
 * Generic function to send message to ZMQ
 * @param {string} topic - ZMQ topic
 * @param {Object} message - Message object
 * @param {string} key - Message key
 * @returns {Promise<Object>} Result object
 */
export async function sendZMQ(topic, message, key) {
  const messageId = message.messageId || message.id || String(Date.now())

  const fullMessage = {
    id: topic,
    timestamp: new Date().toISOString(),
    sender: "ai",
    ...message,
    messageId  // Put messageId AFTER spread so it can't be overridden
  }
  await POST(`${config.apiBaseUrl}/api/zmq/send`, { topic, message: fullMessage, key })
  return { success: true }
}

export async function sendToUI(messageObj) {
  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()

  const runId = `${userInfo.activeCompany}__interactive__${userInfo.interactiveTimestamp}`

  return sendZMQ(runId, messageObj, userInfo.activeCompany)
}

async function handleSendToUI(args) {
  const { message, type = 'text', tasks } = args

  // Validate that at least one of message or tasks is provided
  if (!message && !tasks) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: "Either 'message' or 'tasks' must be provided"
        }, null, 2)
      }],
      isError: true
    }
  }

  try {
    // If tasks are provided, send TaskList message
    if (tasks) {
      await sendToUI({
        id: 'tasklist-current',
        _type_: ['TaskList'],
        status: 'working',
        inProgress: tasks.some(t => t.status === 'in_progress'),
        tasks
      })
    } else {
      // Send plain text message
      await sendToUI({
        _type_: ['PLAIN'],
        text: message
      })
    }

    // Get pending messages from user
    const userMessages = getPendingMessages()

    const response = {
      success: true,
      message: 'Message sent to UI',
      type: tasks ? 'tasklist' : type
    }

    // Include user messages if any
    if (userMessages.length > 0) {
      response.userMessages = userMessages.map(msg => msg.command)
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message
        }, null, 2)
      }],
      isError: true
    }
  }
}

/**
 * Register command queue tools
 */
export function registerCommandQueueTools(server) {
  // Get pending UI commands tool (non-blocking)
  server.registerTool(
    'get_pending_ui_commands',
    {
      title: 'Get Pending UI Commands',
      description: `Returns all pending UI commands without blocking or removing them from the queue.

Returns JSON array of all commands in queue with structure: [{id, command, timestamp}]

🚨 CRITICAL INSTRUCTION FOR AI:
- **CHECK THIS TOOL AS OFTEN AS POSSIBLE** - The user may send messages at any time
- Call this tool after every few actions to see if the user has sent new messages
- This tool returns ALL pending commands immediately
- Commands are NOT removed from queue when you call this tool
- After processing a command, you should remove it from the queue using the appropriate tool
- If you find user messages, respond to them immediately using send_to_ui`,
      inputSchema: {}
    },
    async () => {
      return await handleGetPendingCommands()
    }
  )

  // Send message to user
  server.registerTool(
    'send_to_ui',
    {
      title: 'Send Message to User',
      description: `Send a message to the user via AIChat and get their pending messages in return.

🚨 CRITICAL INSTRUCTIONS:
1. **Be descriptive**: Don't just say "Done" or "Completed". Explain WHAT you did, WHAT you observed, and WHY
2. **Show your reasoning**: Describe your thought process and decisions
3. **Report observations**: Tell the user what you see, what worked, what didn't
4. **CHECK userMessages AND RESPOND**: If the response contains userMessages array, you MUST respond to EACH message using send_to_ui again. This creates a conversation loop in the interactive session.

**What to include in your message:**
- What action you just took
- What you observed/found (data, errors, results)
- Your reasoning for next steps
- Any issues or interesting findings

**Parameters:**
- message: Text to send (use with type parameter)
- type: 'text' (default), 'error', or 'explanation'
- tasks: Array of {name, status} for progress tracking

**Response:**
{
  "success": true,
  "userMessages": ["what user said"]  // ← CHECK THIS AND RESPOND TO EACH!
}

**MANDATORY: If userMessages is present and not empty:**
1. Read each user message
2. Call send_to_ui again to respond to the user's question/request
3. Continue the conversation until user messages stop coming

**Good examples:**
✅ "Navigated to login page. Found 3 input fields (email, password, remember me) and 1 submit button. The page title is 'Sign In'. Next I'll fill in the credentials."
✅ "Test failed at line 15. Error: Element not found. This suggests the selector has changed or the page hasn't loaded yet. I'll try adding a wait."

**Bad examples:**
❌ "Done"
❌ "Completed successfully"
❌ "Navigated to page"`,
      inputSchema: {
        message: z.string().optional().describe('Text message to send'),
        type: z.enum(['text', 'error', 'explanation']).optional().default('text').describe('Message type'),
        tasks: z.array(z.object({
          name: z.string().describe('Task name'),
          status: z.enum(['pending', 'in_progress', 'done', 'failed']).describe('Task status')
        })).optional().describe('Progress tasks (statuses: pending, in_progress, done, failed)')
      }
    },
    async (args) => {
      return await handleSendToUI(args)
    }
  )

  // Wait for UI command tool (blocking with timeout)
  server.registerTool(
    'wait_for_ui_command',
    {
      title: 'Wait for Web UI Command',
      description: `Wait for user to send command via web UI. Blocks until command arrives or timeout (default 60 seconds).

Commands are received via SSE stream from the server.

🚨 INSTRUCTION FOR AI: When using this tool:
1. EXPLAIN what you're doing: "Waiting for command from web UI..."
2. AFTER receiving command, DESCRIBE it: "Received command: <command>"
3. EXECUTE the command the user sent
4. REPORT results clearly

Example usage:
- User in web UI types: "run tests on login page"
- You call wait_for_ui_command
- Tool returns: "run tests on login page"
- You execute the tests and report results`,
      inputSchema: {
        timeout: z.number().optional().default(60).describe('How long to wait in seconds (default: 60)')
      }
    },
    async (args) => {
      return await handleWaitForCommand(args)
    }
  )
}
