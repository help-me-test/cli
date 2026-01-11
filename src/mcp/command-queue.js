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

// State for interactive command flow control
export const state = {
  requiresSendToUI: false
}

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


/**
 * Handle get pending commands
 */
async function handleGetPendingCommands() {
  const hasMessages = queue.length > 0

  if (hasMessages) {
    return {
      content: [{
        type: 'text',
        text: `🔔 **User sent ${queue.length} message(s):**

${queue.map((msg, i) => `${i + 1}. "${msg.command}"`).join('\n')}

**What to do now:** Execute what the user asked. Read their messages and do what they want.`
      }]
    }
  }

  return {
    content: [{
      type: 'text',
      text: 'No pending messages from user. Queue is empty.'
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

    // Clear the blocking flag - send_to_ui has been called
    state.requiresSendToUI = false

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
 * Format messages response
 */
function formatMessagesResponse(messages) {
  return {
    content: [{
      type: 'text',
      text: `🔔 **User sent ${messages.length} message(s):**

${messages.map((msg, i) => `${i + 1}. "${msg.command}"`).join('\n')}

**What to do now:** Execute what the user asked. Read their messages and do what they want.`
    }]
  }
}

/**
 * Handle listen for messages (idle mode)
 * Waits for messages to arrive in the queue (populated by background listener)
 */
async function handleListenForMessages(args) {
  const { checkInterval = 500, maxWait = 300000 } = args
  const startTime = Date.now()

  console.log('[Queue] Entering listen mode, waiting for user messages...')

  // Wait for messages to arrive (background listener populates the queue)
  while (Date.now() - startTime < maxWait) {
    // Check if messages exist or arrived
    if (queue.length > 0) {
      const messages = [...queue]
      console.log(`[Queue] Found ${messages.length} message(s) in queue`)
      return formatMessagesResponse(messages)
    }

    // Small sleep before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  console.log('[Queue] Listen mode timeout - no messages received')
  return {
    content: [{
      type: 'text',
      text: `⏱️ No user messages received after ${maxWait/1000}s.

The queue remains empty. You can:
1. Call listen_for_user_messages again to continue waiting
2. Check if there are other tasks to work on
3. Ask if there's anything else to help with`
    }]
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

  // Listen for user messages tool (waits for messages in queue)
  server.registerTool(
    'listen_for_user_messages',
    {
      title: 'Listen for User Messages (Idle Mode)',
      description: `Enter idle listening mode to wait for user messages.

This tool waits for messages to arrive in the queue (populated by the background listener).
Returns immediately when messages are found. Use this when you've completed all tasks.

**How it works:**
1. Checks if messages already exist in queue - returns immediately if found
2. Waits for messages to arrive (background listener populates queue via SSE)
3. Returns immediately when messages arrive
4. Times out after 5 minutes by default (300 seconds)

**When to use:**
- After completing all tasks
- When waiting for user input
- When there's nothing else to do

🚨 INSTRUCTION FOR AI:
When you've completed all tasks and have nothing to do, call this tool to enter listening mode.
This is better than just ending the conversation - it keeps you ready to help the user.

**Example:**
"I've completed all the exploration tasks. Now entering listening mode to wait for any further instructions from you..."
[call listen_for_user_messages]

If messages arrive, respond to them immediately using send_to_ui.
If timeout occurs with no messages, you can call this tool again to continue listening.`,
      inputSchema: {
        checkInterval: z.number().optional().default(500).describe('How often to check queue in ms (default: 500ms)'),
        maxWait: z.number().optional().default(300000).describe('Maximum time to wait in ms (default: 300000ms = 5 minutes)')
      }
    },
    async (args) => {
      return await handleListenForMessages(args)
    }
  )
}
