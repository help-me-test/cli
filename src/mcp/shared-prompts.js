/**
 * Shared prompt fragments for MCP tools
 *
 * These constants and functions are reused across multiple tools (interactive, exploratory, etc.)
 * to ensure consistent agent behavior and communication patterns.
 */

/**
 * Generate send_to_ui requirement prompt with optional variations
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeExamples - Whether to include good/bad examples (default: true)
 * @param {boolean} options.includeTaskList - Whether to include TaskList requirement (default: false)
 * @returns {string} The formatted send_to_ui requirement prompt
 */
export const sendToUIPrompt = ({ includeExamples = true, includeTaskList = false } = {}) => {
  const basePrompt = `🚨 **CRITICAL: You MUST use send_to_ui to communicate state, plan, and expectations.**

After EVERY action (commands, artifact updates, tool calls), explain using MARKDOWN with blank lines:

**1. CURRENT STATE** - What just happened and what's the result:

- What did the command do?
- Did it succeed or fail?
- What changed on the page (URL, elements appeared/disappeared, text changed)?
- What data did you observe (response codes, performance metrics, errors)?

**2. YOUR PLAN** - What you're going to do next and why:

- What's the next step in the workflow?
- Why is this step necessary?
- What are you trying to accomplish?
- How does this move toward the goal?

**3. EXPECTATIONS** - What should happen if everything works:

- What result do you expect from the next action?
- What would success look like?
- What would indicate failure?
- What validates that the workflow is progressing correctly?`

  const examples = `

**Example (Good with blank lines):**

✅ **CURRENT STATE:**

Navigation to login page succeeded with 200 response in 0.2s. URL is now /login, page title is 'Sign In', and I can see email/password input fields and a submit button.

**PLAN:**

Next, I'll fill in the email field with test@example.com to begin the authentication flow. This is step 2 of 5 in the login workflow.

**EXPECTATIONS:**

After filling the email field, I expect the field to contain the email address, and I should be able to proceed to filling the password field. If validation runs, I expect to see either a green checkmark (valid email) or an error message (invalid format).

**Example (Bad - cramped without blank lines):**

❌ "Done. Navigated to page."  // Missing state details, plan, and expectations
❌ "The page has a blue header with white text and a nice gradient..."  // Describing design, not state
❌ "I filled in the form."  // Missing what you filled, why, and what you expect next`

  let result = basePrompt
  if (includeExamples) result += examples
  if (includeTaskList) result += '\n\n' + TASKLIST_REQUIREMENT

  return result
}

/**
 * Requirement for agents to use TaskList updates for progress tracking
 *
 * Forces agents to:
 * - Create TaskList BEFORE starting work
 * - Update task status after each step
 * - Keep user informed of progress in real-time
 */
export const TASKLIST_REQUIREMENT = `🚨 **MANDATORY: CREATE TASK LIST FIRST**

BEFORE using this tool even ONCE, you MUST:
1. Think about ALL the steps you need to complete
2. Create a complete TaskList with send_to_ui({ tasks: [...] })
3. ALL tasks start as 'pending'
4. Commit to this plan - show the user what you're going to do
5. ONLY THEN start executing

**Example TaskList creation (DO THIS FIRST):**
send_to_ui({
  tasks: [
    {name: "Navigate to example.com", status: "pending"},
    {name: "Fill login form", status: "pending"},
    {name: "Submit and verify", status: "pending"}
  ]
})

**AFTER each step**: Update TaskList via send_to_ui:
- Mark completed step as 'done' ✅ or 'failed' ❌
- Mark next step as 'in_progress' 🔄
- Call: send_to_ui({ tasks: [updated array] })
- This shows user your progress in real-time`

/**
 * Requirement for batch operations to use TaskList
 *
 * When processing multiple items (delete all tests, create multiple items, etc.),
 * agent must create TaskList with one task per item and update status as each is processed.
 */
export const BATCH_OPERATION_REQUIREMENT = `🚨 **CRITICAL: BATCH OPERATIONS REQUIRE TASKLIST**

When user asks to process MULTIPLE items (e.g., "delete all tests", "create 10 tests", "update all artifacts"):

1. **FIRST**: Create TaskList with ONE task per item
2. **THEN**: Process items ONE BY ONE, updating status after each
3. **NEVER**: Process all items silently without showing progress

**Example - User says "delete all tests":**

First, create TaskList:
send_to_ui({
  room: <room>,
  tasks: [
    {name: "Delete test: Login Flow", status: "pending"},
    {name: "Delete test: User Registration", status: "pending"},
    {name: "Delete test: Password Reset", status: "pending"}
  ]
})

Then process each item:
send_to_ui({ room: <room>, tasks: [{name: "Delete test: Login Flow", status: "in_progress"}, ...] })
[delete test]
send_to_ui({ room: <room>, tasks: [{name: "Delete test: Login Flow", status: "done"}, {name: "Delete test: User Registration", status: "in_progress"}, ...] })
[delete test]
...and so on

**This applies to:**
- Deleting multiple items
- Creating multiple items
- Updating multiple records
- Running multiple tests
- Any operation on 2+ items

**This does NOT apply to:**
- Single question answering ("what is X?")
- Single command execution (already has progress indicator)
- Operations on exactly 1 item`

/**
 * Idle mode requirement - agent should listen for user messages when idle
 *
 * When agent completes all tasks, it should enter listening mode and stay there
 * by repeatedly calling get_user_messages until user sends messages.
 */
export const IDLE_LISTENING_REQUIREMENT = `🚨 **WHEN IDLE: LISTEN FOR USER MESSAGES**

When you complete all tasks and have nothing else to do:

1. Call get_user_messages with wait=300000 (5 minutes)
2. When it returns with no messages, call it again immediately
3. Stay in this loop until user sends messages
4. When messages arrive, respond and execute, then return to listening

**Example:**
"I've completed deleting all duplicate tests. Now entering listening mode..."
[call get_user_messages with wait=300000]
[if no messages, call again]
[if messages arrive, respond with send_to_ui and execute]
[after completing new task, return to listening mode]

**DO NOT:**
- End the conversation when tasks are done
- Wait for user to manually ask you to listen
- Leave listening mode unless explicitly told to stop`
