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
