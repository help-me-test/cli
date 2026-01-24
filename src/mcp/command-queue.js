/**
 * Command Queue MCP Tools
 * Listens to SSE stream from server for agent commands
 */

import { z } from 'zod'
import { config } from '../utils/config.js'
import { STREAM } from '../utils.js'
import { BATCH_OPERATION_REQUIREMENT, IDLE_LISTENING_REQUIREMENT } from './shared-prompts.js'

// Module-level queue for storing messages (can be used bidirectionally)
// Max 100 items to prevent memory issues
const MAX_QUEUE_SIZE = 100
let queue = []
let messageIdCounter = 0

// Track active interactive sessions created in this MCP session
const activeInteractiveSessions = new Set()

// State for interactive command flow control
export const state = {
  requiresSendToUI: false
}

/**
 * Register an interactive session as active
 * @param {string} timestamp - Session timestamp
 */
export function registerInteractiveSession(timestamp) {
  activeInteractiveSessions.add(timestamp)
  console.log(`[Session] Registered interactive session: ${timestamp}`)
}

/**
 * Check if a room is valid (either chat.{company} or active interactive session)
 * @param {string} room - Room identifier
 * @param {string} company - Company ID
 * @returns {boolean} True if room is valid
 */
export function isValidRoom(room, company) {
  // Allow chat.{company} format
  if (room === `chat.${company}`) {
    return true
  }

  // Check if it's an interactive session that was created in this session
  // Format: {company}__interactive__{timestamp}
  if (room.startsWith(`${company}__interactive__`)) {
    const timestamp = room.split('__')[2]
    return activeInteractiveSessions.has(timestamp)
  }

  return false
}

/**
 * Get all available rooms for a company
 * @param {string} company - Company ID
 * @returns {Array<string>} Array of available room identifiers
 */
export function getAvailableRooms(company) {
  const rooms = [`chat.${company}`]

  // Add all active interactive sessions
  for (const timestamp of activeInteractiveSessions) {
    rooms.push(`${company}__interactive__${timestamp}`)
  }

  return rooms
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
      const pattern = `${userInfo.activeCompany}__*`

      console.log(`[Queue] Subscribing to all company rooms: ${pattern}`)

      let buffer = ''

      await STREAM(
        config.apiBaseUrl,
        '/api/stream/events',
        { room: pattern },
        (chunk) => {
          buffer += chunk
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (!event.trim()) continue

            try {
              const data = JSON.parse(event.trim())

              console.log('[Queue] Received event:', JSON.stringify(data).substring(0, 200))

              // Respond to PING messages immediately by marking them as processed
              if (data._type_?.includes('__PING__') && data.room) {
                console.log(`[Queue] Marking PING as processed from ${data.room}`)
                sendToUI({
                  ...data,
                  status: 'processed'
                }, data.room).catch(err => {
                  console.error('[Queue] Failed to mark PING as processed:', err)
                })
              }

              // Only add user messages to the queue that are still being processed (skip historical)
              if (data.sender === 'user' && data.text && data.status === 'processing' && !data._historical) {
                // Check for duplicate by messageId
                const isDuplicate = queue.some(msg => msg.messageId === data.messageId)

                if (isDuplicate) {
                  console.log(`[Queue] Skipping duplicate message with messageId: ${data.messageId}`)
                } else {
                  const message = {
                    id: ++messageIdCounter,
                    timestamp: Date.now(),
                    ...data
                  }

                  // Check queue size limit
                  if (queue.length >= MAX_QUEUE_SIZE) {
                    const removed = queue.shift()
                    console.warn(`[Queue] Queue full (${MAX_QUEUE_SIZE}), removed oldest message:`, removed.id)
                  }

                  queue.push(message)
                  console.log(`[Queue] Added user message ${message.id}: "${message.text}" (messageId: ${data.messageId}), queue size: ${queue.length}`)
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
 * Send heartbeat to mcp-listening topic
 */
async function sendHeartbeat() {
  try {
    const { detectApiAndAuth } = await import('../utils/api.js')
    const userInfo = await detectApiAndAuth()

    await sendZMQ(`mcp-listening.${userInfo.activeCompany}`, {
      company: userInfo.activeCompany,
      timestamp: Date.now(),
      type: 'heartbeat'
    }, userInfo.activeCompany)

    console.log('[Queue] Heartbeat sent')
  } catch (error) {
    console.error('[Queue] Error sending heartbeat:', error)
  }
}

/**
 * Handle get messages - waits up to {wait}ms for messages
 * @param {number} wait - Maximum wait time in ms (default: 500ms)
 */
async function handleGetMessages({ wait = 500 }) {
  // Send initial heartbeat
  await sendHeartbeat()

  // Set up heartbeat interval (every 3 seconds while listening)
  const heartbeatInterval = setInterval(sendHeartbeat, 3000)

  return new Promise((resolve) => {
    const checkMessages = () => {
      if (queue.length === 0) return false

      const messages = getPendingMessages()
      console.log(`[Queue] Found ${messages.length} message(s) in queue, cleared queue`)

      // Mark all messages as processed
      for (const msg of messages) {
        if (msg.messageId && msg.room) {
          msg.status = 'processed'
          sendToUI(msg, msg.room)
          console.log(`[Queue] Marked message ${msg.messageId} as processed`)
        }
      }

      // Stop heartbeats
      clearInterval(heartbeatInterval)

      resolve({
        content: [{
          type: 'text',
          text: formatUserMessages(messages)
        }]
      })
      return true
    }

    // Check immediately
    if (checkMessages()) return

    // Set up polling and timeout
    const interval = setInterval(() => {
      if (checkMessages()) clearInterval(interval)
    }, 500)

    setTimeout(() => {
      clearInterval(interval)
      clearInterval(heartbeatInterval) // Stop heartbeats on timeout

      if (queue.length === 0) {
        console.log(`[Queue] Timeout after ${wait}ms - no messages received`)
        resolve({
          content: [{
            type: 'text',
            text: 'No pending messages from user. Queue is empty.'
          }]
        })
      }
    }, wait)
  })
}

/**
 * Handle send to UI
 */
/**
 * Generic function to send message to ZMQ
 * @param {string} room - Room identifier
 * @param {Object} message - Message object
 * @param {string} key - Message key
 * @returns {Promise<Object>} Result object
 */
export async function sendZMQ(room, message, key) {
  const messageId = message.messageId || message.id || String(Date.now())

  const fullMessage = {
    room,
    timestamp: new Date().toISOString(),
    sender: "ai",  // Default sender, but can be overridden by message
    company: key,  // Add company field for consistency
    ...message,
    id: messageId,  // Put AFTER spread so it doesn't get overridden
    messageId  // Put AFTER spread so it doesn't get overridden
  }

  // POST doesn't include auth, so use fetch directly with auth header
  const response = await fetch(`${config.apiBaseUrl}/api/zmq/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiToken}`
    },
    body: JSON.stringify({ room, message: fullMessage, key })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  return { success: true }
}

export async function sendToUI(messageObj, room) {
  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()

  return sendZMQ(room, messageObj, userInfo.activeCompany)
}

async function handleSendToUI(args) {
  const { message, type = 'text', tasks, room } = args

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

  if (!room) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: "Room parameter is required"
        }, null, 2)
      }],
      isError: true
    }
  }

  // Get user info to validate room
  const { detectApiAndAuth } = await import('../utils/api.js')
  const userInfo = await detectApiAndAuth()

  // Validate room is either company__chat or an active interactive session
  if (!isValidRoom(room, userInfo.activeCompany)) {
    const availableRooms = getAvailableRooms(userInfo.activeCompany)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `Invalid room: "${room}".`,
          availableRooms: availableRooms,
          message: `Choose one of the available rooms above. Use "${userInfo.activeCompany}__chat" for company chat or one of the interactive session rooms.`
        }, null, 2)
      }],
      isError: true
    }
  }

  try {
    // If tasks are provided, send TaskList message
    if (tasks) {
      await sendToUI({
        ...args,
        id: 'tasklist-current',
        _type_: ['TaskList'],
        status: 'working',
        inProgress: tasks.some(t => t.status === 'in_progress')
      }, room)
    } else {
      // Send plain text message
      await sendToUI({
        _type_: ['PLAIN'],
        text: message
      }, room)
    }

    // Clear the blocking flag - send_to_ui has been called
    state.requiresSendToUI = false

    const response = {
      success: true,
      message: 'Message sent to UI',
      type: tasks ? 'tasklist' : type
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
 * Format user messages for display (single source of truth for rendering)
 */
export function formatUserMessages(messages) {
  if (!messages || messages.length === 0) {
    return ''
  }

  return `

---

🔔 **User sent ${messages.length} message(s):**

\`\`\`json
${JSON.stringify(messages, null, 2)}
\`\`\`

⚠️ **MANDATORY: Respond IMMEDIATELY**

FIRST, call send_to_ui to explain what you understood and what you'll do:

**For simple requests:**
- Send plain message: send_to_ui({ room: "...", message: "I'll check the logs for errors in the auth service" })

**For multi-step tasks:**
- Create TaskList showing all steps (see TASKLIST_REQUIREMENT prompt)
- send_to_ui({ room: "...", tasks: [{ name: "Check logs", status: "pending" }, ...] })

ONLY AFTER responding, start executing.`
}


/**
 * Register command queue tools
 */
export function registerCommandQueueTools(server) {
  // Get user messages tool
  server.registerTool(
    'get_user_messages',
    {
      title: 'Get User Messages',
      description: `Get messages from user sent through the frontend chat interface.

Waits up to {wait}ms for messages to arrive:
- Small wait (500ms default): Returns almost instantly, good for periodic polling
- Large wait (300000ms = 5 minutes): Listens for extended time, good for idle mode

Always includes the prompt with TaskList requirements.

🚨 CRITICAL: When messages arrive, you MUST respond immediately using send_to_ui.

**Parameters:**
- wait: Maximum wait time in ms (default: 500ms)

${IDLE_LISTENING_REQUIREMENT}`,
      inputSchema: {
        wait: z.number().optional().default(500).describe('Maximum wait time in ms (default: 500ms)')
      }
    },
    async (args) => {
      return await handleGetMessages(args)
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
- room: Room identifier to send message to (required)

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
❌ "Navigated to page"

${BATCH_OPERATION_REQUIREMENT}`,
      inputSchema: {
        message: z.string().optional().describe('Text message to send'),
        type: z.enum(['text', 'error', 'explanation']).optional().default('text').describe('Message type'),
        tasks: z.array(z.object({
          name: z.string().describe('Task name'),
          status: z.enum(['pending', 'in_progress', 'done', 'failed']).describe('Task status')
        })).optional().describe('Progress tasks (statuses: pending, in_progress, done, failed)'),
        room: z.string().describe('Room identifier to send message to (required)')
      }
    },
    async (args) => {
      return await handleSendToUI(args)
    }
  )
}
