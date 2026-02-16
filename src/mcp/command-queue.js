/**
 * Command Queue MCP Tools
 * Listens to SSE stream from server for agent commands
 */

import { z } from 'zod'
import { config } from '../utils/config.js'
import { STREAM } from '../utils.js'
import { log } from '../utils/log.js'

// Module-level unified queue for ALL events (user messages, test status changes, etc.)
// Max 100 items to prevent memory issues
const MAX_QUEUE_SIZE = 100
let queue = []
let eventIdCounter = 0

// Track last processed event index to avoid re-processing
let lastProcessedIndex = -1

// Track active interactive sessions created in this MCP session
const activeInteractiveSessions = new Set()

// Track if background listener has been started
let listenerStarted = false

// Track TaskList IDs per room for this MCP session
const taskListIds = new Map()

// State for interactive command flow control
export const state = {
  requiresSendToUI: false,
  lastRoom: null
}

/**
 * Register an interactive session as active
 * @param {string} timestamp - Session timestamp
 */
export function registerInteractiveSession(timestamp) {
  activeInteractiveSessions.add(timestamp)
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
 * Inject a system message into the queue
 * @param {string} content - Message content
 */
// Track which system messages have been injected (by key)
const injectedMessages = new Set()

export function injectSystemMessage(content) {
  const event = {
    id: ++eventIdCounter,
    timestamp: Date.now(),
    type: 'system_message',
    content
  }

  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift()
    if (lastProcessedIndex >= 0) {
      lastProcessedIndex--
    }
  }

  queue.push(event)
}

/**
 * Inject system message only once per session (tracked by key)
 * @param {string} key - Unique key to track if message was already injected
 * @param {string} content - Message content to inject
 * @returns {boolean} true if injected, false if already injected
 */
export function injectSystemMessageOnce(key, content) {
  if (injectedMessages.has(key)) {
    return false
  }
  injectedMessages.add(key)
  injectSystemMessage(content)
  return true
}

/**
 * Inject multiple prompts at once (batch operation)
 * @param {Object} prompts - Object with prompt keys and their content
 */
export function injectPrompts(prompts) {
  for (const [key, content] of Object.entries(prompts)) {
    injectSystemMessageOnce(key, content)
  }
}

/**
 * Inject prompt by fetching it from instructions
 * @param {string|string[]} types - Single type or array of types to fetch and inject
 */
export async function injectPromptsByType(types) {
  const typeArray = Array.isArray(types) ? types : [types]

  try {
    const { getAllPrompts } = await import('./instructions.js')

    // Fetch ALL prompts in ONE request
    const allPrompts = await getAllPrompts()

    // Inject requested types
    const prompts = {}
    for (const type of typeArray) {
      if (allPrompts[type]) {
        prompts[type] = allPrompts[type]
      }
    }

    injectPrompts(prompts)
  } catch (e) {
    log(`[CommandQueue] Failed to inject prompts: ${e.message}`)
  }
}

/**
 * Get all pending events (user messages, test status changes, system messages) and clear the queue
 * @returns {Array} All events from the queue
 */
export function getPendingEvents() {
  const events = [...queue]
  queue = []
  return events
}

/**
 * Alias for backwards compatibility
 */
export function getPendingMessages() {
  return getPendingEvents()
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

  return removed
}

/**
 * Ensure background listener is started (lazy initialization)
 */
function ensureListenerStarted() {
  if (!listenerStarted) {
    listenerStarted = true
    startBackgroundListener().catch(() => {
      listenerStarted = false // Allow retry on next call
    })
  }
}

/**
 * Start background listener that continuously receives messages from server
 * and adds them to queue. Runs indefinitely with auto-reconnect.
 */
async function startBackgroundListener() {
  let retryCount = 0
  const maxRetryDelay = 60000 // 60 seconds max

  while (true) {
    try {
      const { detectApiAndAuth } = await import('../utils/api.js')
      const userInfo = await detectApiAndAuth()
      const pattern = '-heartbeat'

      let buffer = ''

      await STREAM(
        config.apiBaseUrl,
        `/api/stream/${pattern}`,
        {},
        (chunk) => {
          buffer += chunk
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (!event.trim()) continue

            try {
              const data = JSON.parse(event.trim())

              if (data._type_?.includes('__PING__') && data.room) {
                sendToUI({
                  ...data,
                  status: 'processed'
                }, data.room).catch(err => {})
              }

              if (data.sender === 'user' && data.text && data.status === 'processing') {
                const isDuplicate = queue.some(msg => msg.messageId === data.messageId)

                if (!isDuplicate) {
                  const event = {
                    id: ++eventIdCounter,
                    timestamp: Date.now(),
                    type: 'user_message',
                    ...data
                  }

                  if (queue.length >= MAX_QUEUE_SIZE) {
                    queue.shift()
                    if (lastProcessedIndex >= 0) {
                      lastProcessedIndex--
                    }
                  }

                  queue.push(event)
                }
              }

              if (data.type === 'test_status_change') {
                const event = {
                  id: ++eventIdCounter,
                  timestamp: Date.now(),
                  ...data
                }

                if (queue.length >= MAX_QUEUE_SIZE) {
                  queue.shift()
                  if (lastProcessedIndex >= 0) {
                    lastProcessedIndex--
                  }
                }

                queue.push(event)
              }

            } catch (e) {
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
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

export { startBackgroundListener }


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

  } catch (error) {
  }
}

/**
 * Handle get messages - waits up to {wait}ms for messages
 * @param {number} wait - Maximum wait time in ms (default: 500ms)
 */
async function handleGetMessages({ wait = 500 }) {
  // Ensure background listener is running
  ensureListenerStarted()

  // Send initial heartbeat
  await sendHeartbeat()

  // Set up heartbeat interval (every 3 seconds while listening)
  const heartbeatInterval = setInterval(sendHeartbeat, 3000)
  let interval = null
  let timeout = null

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      clearInterval(heartbeatInterval)
    }

    const checkMessages = () => {
      // Filter for user messages only
      const userMessages = queue.filter(event => event.type === 'user_message')
      if (userMessages.length === 0) return false

      // Remove user messages from queue
      queue = queue.filter(event => event.type !== 'user_message')

      // Mark all messages as processed
      for (const msg of userMessages) {
        if (msg.messageId && msg.room) {
          msg.status = 'processed'
          sendToUI(msg, msg.room)
        }
      }

      cleanup()

      resolve({
        content: [{
          type: 'text',
          text: formatUserMessages(userMessages)
        }]
      })
      return true
    }

    // Check immediately
    if (checkMessages()) return

    // Set up polling and timeout
    interval = setInterval(() => {
      if (checkMessages()) clearInterval(interval)
    }, 500)

    timeout = setTimeout(() => {
      cleanup()

      if (queue.length === 0) {
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

/**
 * Format and send any message type to UI with proper structure
 * @param {Object} options - Options
 * @param {string} options.room - Room identifier
 * @param {string} [options.message] - Text message to send (for PLAIN or TaskList)
 * @param {Array} [options.tasks] - Task list array (for TaskList)
 * @param {string} [options.command] - Command text (for CommandNotification)
 * @param {string} [options.explanation] - Command explanation (for CommandNotification)
 * @param {string} [options.notificationType] - Notification type: running/success/failed (for CommandNotification)
 * @param {string} [options.messageId] - Message ID (for CommandNotification)
 * @returns {Promise<void>}
 */
export async function formatAndSendToUI({ message, tasks, command, explanation, notificationType, messageId, room }) {
  // CommandNotification: when command/explanation/notificationType are provided
  if (command !== undefined && notificationType !== undefined) {
    await sendToUI({
      messageId,
      _type_: ["CommandNotification", notificationType],
      command,
      explanation
    }, room)
    return
  }

  // TaskList: when tasks array is provided
  if (tasks) {
    // Get or create TaskList ID for this room
    let taskListId = taskListIds.get(room)
    if (!taskListId) {
      taskListId = `tasklist-${Date.now()}`
      taskListIds.set(room, taskListId)
    }

    const payload = {
      id: taskListId,
      _type_: ['TaskList'],
      status: 'working',
      inProgress: tasks.some(t => t.status === 'in_progress'),
      updatedAt: Date.now(),
      tasks
    }
    if (message) payload.message = message

    await sendToUI(payload, room)
    // Clear the blocking flag for interactive commands
    state.requiresSendToUI = false
    return
  }

  // PLAIN: plain text message
  if (message) {
    await sendToUI({
      _type_: ['PLAIN'],
      text: message
    }, room)
    // Clear the blocking flag for interactive commands
    state.requiresSendToUI = false
    return
  }

  throw new Error('formatAndSendToUI: Must provide either tasks, message, or command/notificationType')
}

async function handleSendToUI(args) {
  // Ensure background listener is running
  ensureListenerStarted()

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
    // Use shared formatting function
    await formatAndSendToUI({ message, tasks, room })

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
 * Format actionable events for display
 */
export function formatEvents(events) {
  if (!events || events.length === 0) {
    return ''
  }

  const systemMessages = events.filter(e => e.type === 'system_message')
  const userMessages = events.filter(e => e.type === 'user_message')
  const testEvents = events.filter(e => e.type === 'test_status_change')

  let output = '\n\n---\n\n'

  if (systemMessages.length > 0) {
    systemMessages.forEach(msg => {
      output += `${msg.content}\n\n---\n\n`
    })
  }

  if (userMessages.length > 0) {
    output += `💬 **User sent ${userMessages.length} message(s):**\n\n`
    userMessages.forEach(msg => {
      output += `**Message:** ${msg.text}\n`
      output += `**Room:** ${msg.room}\n`
      output += `**Time:** ${msg.timestamp}\n\n`
    })
    output += '⚠️ **MANDATORY: Respond IMMEDIATELY using send_to_ui**\n\n'
  }

  if (testEvents.length > 0) {
    output += `🧪 **${testEvents.length} Test Status Change(s):**\n\n`
    testEvents.forEach(event => {
      const emoji = event.status === 'FAIL' ? '❌' : event.status === 'PASS' ? '✅' : '⚠️'
      const direction = event.previous_status === 'PASS' && event.status === 'FAIL' ? '📉 REGRESSION' :
                       event.previous_status === 'FAIL' && event.status === 'PASS' ? '📈 RECOVERY' : '🔄 CHANGE'
      output += `${emoji} **${direction}**: Test "${event.test_name}" (${event.test_id})\n`
      output += `   Previous: ${event.previous_status} → Current: ${event.status}\n`
      output += `   Time: ${event.timestamp}\n`
      output += `   Duration: ${event.elapsed_time}s\n\n`
    })
  }

  output += '---\n\n'

  if (userMessages.length > 0) {
    output += '**FIRST:** Call send_to_ui to respond to user messages\n'
    output += '**THEN:** Handle test failures/recoveries if needed\n'
  } else if (testEvents.length > 0) {
    output += '**What to do:**\n'
    output += '1. Investigate test failures/regressions\n'
    output += '2. Acknowledge recoveries\n'
    output += '3. Take corrective action if needed\n'
  }

  return output
}

/**
 * Format response with pending events
 * Call this at the end of any tool to include system messages, user messages, test changes
 * @param {string} responseText - Existing response text
 * @returns {string} Formatted response with pending events
 */
export function formatResponse(responseText) {
  // Get unprocessed events
  const newEvents = []
  for (let i = lastProcessedIndex + 1; i < queue.length; i++) {
    newEvents.push(queue[i])
  }

  if (newEvents.length === 0) {
    return responseText
  }

  // Update lastProcessedIndex
  const lastEventIndex = queue.indexOf(newEvents[newEvents.length - 1])
  lastProcessedIndex = lastEventIndex

  // Mark user messages as processed
  const userMessages = newEvents.filter(e => e.type === 'user_message')
  for (const msg of userMessages) {
    if (msg.messageId && msg.room) {
      msg.status = 'processed'
      sendToUI(msg, msg.room).catch(() => {})
    }
  }

  return formatEvents(newEvents) + responseText
}

/**
 * Handle listen to events - waits for actionable events (user messages + test status changes)
 */
async function handleListenToEvents({ wait = 5000 }) {
  // Ensure background listener is running
  ensureListenerStarted()

  // Send initial heartbeat
  await sendHeartbeat()

  // Set up heartbeat interval (every 3 seconds while listening)
  const heartbeatInterval = setInterval(sendHeartbeat, 3000)
  let interval = null
  let timeout = null

  return new Promise((resolve) => {
    const cleanup = () => {
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      clearInterval(heartbeatInterval)
    }

    const checkEvents = () => {
      const newEvents = []
      for (let i = lastProcessedIndex + 1; i < queue.length; i++) {
        newEvents.push(queue[i])
      }

      if (newEvents.length === 0) return false

      // Update lastProcessedIndex to the last event we're returning
      const lastEventIndex = queue.indexOf(newEvents[newEvents.length - 1])
      lastProcessedIndex = lastEventIndex


      // Mark user messages as processed
      const userMessages = newEvents.filter(e => e.type === 'user_message')
      for (const msg of userMessages) {
        if (msg.messageId && msg.room) {
          msg.status = 'processed'
          sendToUI(msg, msg.room)
        }
      }

      cleanup()

      resolve({
        content: [{
          type: 'text',
          text: formatEvents(newEvents)
        }]
      })
      return true
    }

    // Check immediately
    if (checkEvents()) return

    // Set up polling and timeout
    interval = setInterval(() => {
      if (checkEvents()) clearInterval(interval)
    }, 500)

    timeout = setTimeout(() => {
      cleanup()

      // Get unprocessed actionable events
      const newEvents = []
      for (let i = lastProcessedIndex + 1; i < queue.length; i++) {
        const event = queue[i]
        if (event.type === 'user_message' || event.type === 'test_status_change') {
          newEvents.push(event)
        }
      }

      if (newEvents.length > 0) {
        // Update lastProcessedIndex
        const lastEventIndex = queue.indexOf(newEvents[newEvents.length - 1])
        lastProcessedIndex = lastEventIndex

        // Mark user messages as processed
        const userMessages = newEvents.filter(e => e.type === 'user_message')
        for (const msg of userMessages) {
          if (msg.messageId && msg.room) {
            msg.status = 'processed'
            sendToUI(msg, msg.room)
          }
        }
      }

      resolve({
        content: [{
          type: 'text',
          text: newEvents.length === 0
            ? 'No actionable events. Queue is empty.'
            : formatEvents(newEvents)
        }]
      })
    }, wait)
  })
}


/**
 * Register command queue tools
 */
export function registerCommandQueueTools(server) {
  // Listen to actionable events tool
  server.registerTool(
    'listen_to_events',
    {
      title: 'Listen to All Events',
      description: `Listen for all actionable events: user messages AND test status changes.

This is the UNIFIED event queue - all events flow through here.

Waits up to {wait}ms for events to arrive:
- Short wait (5000ms default): Returns quickly with any pending events
- Long wait (300000ms = 5 minutes): Listens for extended time, good for monitoring mode

**Event Types Returned:**
1. **user_message**: Messages from user via frontend chat
   - 💬 User sent a message
   - ⚠️ You MUST respond immediately using send_to_ui

2. **test_status_change**: Test status changed (PASS→FAIL, FAIL→PASS, etc.)
   - 📉 REGRESSION: Test went from PASS to FAIL (needs attention!)
   - 📈 RECOVERY: Test went from FAIL to PASS (acknowledge success)
   - 🔄 OTHER CHANGES: Status changed in other ways

**Parameters:**
- wait: Maximum wait time in ms (default: 5000ms)

**Use this tool to:**
- Build self-healing loops that respond to test failures AND user commands
- Monitor for test failures that need investigation
- Respond to user messages in real-time
- Stay aware of system health changes

**When events arrive:**
1. FIRST: Respond to user messages if any (using send_to_ui)
2. THEN: Handle test failures/recoveries

⚠️ **When idle:** Call \`how_to({ type: "idle_listening_instructions" })\` for guidance on staying in listening mode.`,
      inputSchema: {
        wait: z.number().optional().default(5000).describe('Maximum wait time in ms (default: 5000ms)')
      }
    },
    async (args) => {
      return await handleListenToEvents(args)
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

⚠️ **For batch operations:** When processing multiple items, call \`how_to({ type: "batch_operations_instructions" })\` for TaskList requirements.
⚠️ **Communication format:** Call \`how_to({ type: "send_to_ui_instructions" })\` for state/plan/expectations format.`,
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
