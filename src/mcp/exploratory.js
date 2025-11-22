/**
 * Exploratory Testing MCP Tools
 * Smart, prioritized exploration that finds real bugs
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'
import { getArtifact, upsertArtifact } from './artifacts.js'

/**
 * Priority levels for testing
 * Higher number = higher priority
 */
const PRIORITY_MAP = {
  billing: 10,
  payment: 10,
  stripe: 10,
  checkout: 10,
  purchase: 9,
  signup: 8,
  registration: 8,
  login: 8,
  authentication: 8,
  'critical-flow': 7,
  navigation: 3,
  usability: 2,
  accessibility: 0,
  seo: 0
}

/**
 * Get or create exploratory testing artifact for a URL
 * Uses MCP artifact tool handlers directly
 */
async function getOrCreateArtifact(url) {
  const artifactId = `exploratory-${url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`

  debug(config, `Looking for artifact: ${artifactId}`)

  try {
    // Call getArtifact handler directly
    const result = await getArtifact({ id: artifactId })
    // Parse the JSON response from the handler
    const jsonMatch = result.content[0].text.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1])
      debug(config, `Found existing artifact: ${artifactId}`)
      return data.artifact
    }
    throw new Error('Invalid response format')
  } catch (error) {
    debug(config, `Artifact not found, creating new: ${artifactId}`)

    // Call upsertArtifact handler directly
    const result = await upsertArtifact({
      id: artifactId,
      name: `Exploratory Testing: ${url}`,
      type: 'exploratory-testing',
      content: {
        url,
        testedUseCases: [],
        bugs: [],
        lastUpdated: new Date().toISOString()
      },
      tags: ['exploratory-testing', `url:${new URL(url).hostname}`]
    })

    // Parse the JSON response
    const jsonMatch = result.content[0].text.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1])
      debug(config, `Created artifact: ${artifactId}`)
      return data.artifact
    }
    throw new Error('Invalid response format')
  }
}

/**
 * Update exploratory testing artifact
 * Uses MCP artifact tool handlers directly
 */
async function updateExploratoryArtifact(artifactId, updates) {
  debug(config, `Updating artifact: ${artifactId}`)

  // Get current artifact using handler
  const getResult = await getArtifact({ id: artifactId })
  const getJsonMatch = getResult.content[0].text.match(/```json\n([\s\S]*?)\n```/)
  if (!getJsonMatch) throw new Error('Invalid response format')

  const getData = JSON.parse(getJsonMatch[1])
  const artifact = getData.artifact

  const updatedContent = {
    ...artifact.content,
    ...updates,
    lastUpdated: new Date().toISOString()
  }

  // Update using handler
  const updateResult = await upsertArtifact({
    id: artifactId,
    name: artifact.name,
    type: artifact.type,
    content: updatedContent,
    tags: artifact.tags
  })

  const updateJsonMatch = updateResult.content[0].text.match(/```json\n([\s\S]*?)\n```/)
  if (!updateJsonMatch) throw new Error('Invalid response format')

  const updateData = JSON.parse(updateJsonMatch[1])
  return updateData.artifact
}

/**
 * Generate testing summary from artifact data
 */
function generateTestingSummary(artifact, url) {
  const testedUseCases = artifact.content.testedUseCases || []
  const bugs = artifact.content.bugs || []

  // Categorize tested use cases by priority
  const categorized = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  testedUseCases.forEach(uc => {
    const ucLower = uc.toLowerCase()
    if (ucLower.includes('payment') || ucLower.includes('billing') || ucLower.includes('stripe') || ucLower.includes('checkout')) {
      categorized.critical.push(uc)
    } else if (ucLower.includes('signup') || ucLower.includes('login') || ucLower.includes('registration')) {
      categorized.high.push(uc)
    } else if (ucLower.includes('navigation') || ucLower.includes('flow')) {
      categorized.medium.push(uc)
    } else {
      categorized.low.push(uc)
    }
  })

  const totalTests = testedUseCases.length
  const criticalBugs = bugs.filter(b => b.priority >= 10).length
  const highBugs = bugs.filter(b => b.priority >= 8 && b.priority < 10).length
  const mediumBugs = bugs.filter(b => b.priority >= 5 && b.priority < 8).length

  return `## 🔍 Exploratory Testing Summary

### ✅ **What We've Verified:**

${categorized.critical.length > 0 ? `**Critical Flows (Priority 10 - Payment/Billing)**
${categorized.critical.map(uc => `- ✅ ${uc}`).join('\n')}
` : ''}${categorized.high.length > 0 ? `**Authentication Flows (Priority 8-9)**
${categorized.high.map(uc => `- ✅ ${uc}`).join('\n')}
` : ''}${categorized.medium.length > 0 ? `**Navigation & Core Features (Priority 5-7)**
${categorized.medium.map(uc => `- ✅ ${uc}`).join('\n')}
` : ''}${categorized.low.length > 0 ? `**Usability & Other (Priority 2-3)**
${categorized.low.map(uc => `- ✅ ${uc}`).join('\n')}
` : ''}${totalTests === 0 ? '- No tests completed yet\n' : ''}
**Console & Error Status**
- ✅ Testing session active
- ✅ Interactive commands working
${bugs.length === 0 ? '- ✅ No critical bugs found so far' : `- ⚠️ ${bugs.length} bug${bugs.length > 1 ? 's' : ''} identified`}

---

### 🐛 **Bugs Found:** ${bugs.length > 0 ? `

${bugs.map((bug, i) => `**Bug #${i + 1}: ${bug.title}** (Priority ${bug.priority})
- **Status:** ${bug.status || 'NEW'}
- **Impact:** ${bug.impact || 'Not specified'}
- **Location:** ${bug.location || 'Not specified'}
- **Reproduction Steps:**
${bug.reproSteps ? bug.reproSteps.map((step, j) => `  ${j + 1}. ${step}`).join('\n') : '  Not documented'}
`).join('\n')}` : 'None yet'}

---

### 📊 **Test Coverage:**

**Tested Use Cases:** ${totalTests} total
${categorized.critical.length > 0 ? `- 🔴 Critical (Priority 10): ${categorized.critical.length}` : '- 🔴 Critical (Priority 10): 0'}
${categorized.high.length > 0 ? `- 🔴 High (Priority 8-9): ${categorized.high.length}` : '- 🔴 High (Priority 8-9): 0'}
${categorized.medium.length > 0 ? `- 🟡 Medium (Priority 5-7): ${categorized.medium.length}` : '- 🟡 Medium (Priority 5-7): 0'}
${categorized.low.length > 0 ? `- 🟢 Low (Priority 2-3): ${categorized.low.length}` : '- 🟢 Low (Priority 2-3): 0'}

**Bug Severity:**
${criticalBugs > 0 ? `- 🔴 Critical: ${criticalBugs}` : '- 🔴 Critical: 0'}
${highBugs > 0 ? `- 🟡 High: ${highBugs}` : '- 🟡 High: 0'}
${mediumBugs > 0 ? `- 🟢 Medium: ${mediumBugs}` : '- 🟢 Medium: 0'}

---

### 📋 **Confidence Level:**

Based on the evidence:

${categorized.critical.length > 0 ? '✅ **High confidence** on critical payment/billing flows tested' : '⚠️ **No confidence** on payment/billing flows (not tested yet)'}
${categorized.high.length > 0 ? '✅ **High confidence** on authentication flows tested' : '⚠️ **Medium confidence** on authentication (limited testing)'}
${bugs.length === 0 ? '✅ **High confidence** in overall stability (no major bugs found)' : `⚠️ **Concerns** about ${bugs.length} identified bug${bugs.length > 1 ? 's' : ''}`}

---

**Artifact ID:** \`${artifact.id}\`
**URL:** ${url}
**Last Updated:** ${artifact.content.lastUpdated || 'Unknown'}

**Next:** Continue exploring to test more critical paths, or use \`helpmetest_get_artifact\` to see full details.`
}

/**
 * Define testing goals based on what's been tested
 */
function defineTestingGoal(artifact, url) {
  const testedUseCases = artifact.content.testedUseCases || []

  // Check what critical paths haven't been tested
  const hasTestedPayment = testedUseCases.some(uc =>
    uc.toLowerCase().includes('payment') ||
    uc.toLowerCase().includes('stripe') ||
    uc.toLowerCase().includes('checkout') ||
    uc.toLowerCase().includes('billing')
  )

  const hasTestedProSignup = testedUseCases.some(uc =>
    uc.toLowerCase().includes('pro') &&
    uc.toLowerCase().includes('complete')
  )

  const hasTestedFreeSignup = testedUseCases.some(uc =>
    uc.toLowerCase().includes('free') &&
    uc.toLowerCase().includes('complete')
  )

  // Define goal based on what's missing
  if (!hasTestedProSignup) {
    return {
      goal: 'Complete Pro Subscription Signup Flow',
      priority: 10,
      why: 'Payment/billing flows are highest priority. Need to verify entire signup process from start to payment confirmation.',
      steps: [
        'Navigate to homepage',
        'Click "Start your subscription" button',
        'Fill website URL in onboarding form',
        'Verify website analysis works',
        'Confirm company name auto-fill',
        'Proceed to account creation step',
        'Fill email and password',
        'Submit account creation',
        'Verify redirect to payment/dashboard',
        'Check for any errors or blockers'
      ],
      successCriteria: [
        'User can navigate through all onboarding steps',
        'Form validation works correctly',
        'No JavaScript errors in console',
        'Flow reaches payment or dashboard successfully'
      ],
      testData: {
        website: 'playground.helpmetest.com',
        email: 'test@example.com',
        password: 'TestPassword123!'
      }
    }
  } else if (!hasTestedFreeSignup) {
    return {
      goal: 'Complete Free Tier Signup Flow',
      priority: 8,
      why: 'Free tier is the main user acquisition funnel. Must verify complete signup process.',
      steps: [
        'Navigate to homepage',
        'Click "Get started free" button',
        'Fill website URL in onboarding form',
        'Verify website analysis works',
        'Confirm company name auto-fill',
        'Proceed to account creation step',
        'Fill email and password',
        'Submit account creation',
        'Verify redirect to dashboard',
        'Check for any errors or blockers'
      ],
      successCriteria: [
        'User can complete signup without payment',
        'Form validation works correctly',
        'No JavaScript errors in console',
        'User lands on dashboard with working account'
      ],
      testData: {
        website: 'playground.helpmetest.com',
        email: 'test-free@example.com',
        password: 'TestPassword123!'
      }
    }
  } else if (!hasTestedPayment) {
    return {
      goal: 'Verify Payment Integration',
      priority: 10,
      why: 'Payment is critical revenue path. Need to verify Stripe integration works.',
      steps: [
        'Complete Pro signup flow up to payment',
        'Verify Stripe form loads correctly',
        'Test with Stripe test card',
        'Verify payment processing',
        'Check payment confirmation',
        'Verify account activation'
      ],
      successCriteria: [
        'Stripe form loads without errors',
        'Test payment processes successfully',
        'User receives confirmation',
        'Account is activated with Pro features'
      ],
      testData: {
        cardNumber: '4242424242424242',
        expiry: '12/34',
        cvc: '123'
      }
    }
  } else {
    return {
      goal: 'Verify Login Flow',
      priority: 8,
      why: 'Login is essential for returning users.',
      steps: [
        'Navigate to homepage',
        'Click "Log In" button',
        'Fill email and password',
        'Submit login form',
        'Verify redirect to dashboard',
        'Check session persistence'
      ],
      successCriteria: [
        'Valid credentials allow login',
        'Invalid credentials show error',
        'User lands on correct dashboard',
        'Session persists across page reload'
      ],
      testData: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      }
    }
  }
}

/**
 * Handle explore tool call
 */
async function handleExplore(args) {
  const { url, session_state } = args

  debug(config, `Exploratory testing tool called for: ${url}`)

  try {
    const userInfo = await detectApiAndAuth()
    const sessionTimestamp = Date.now()
    const sessionId = `${userInfo.activeCompany}__exploratory__${sessionTimestamp}`

    // Get or create artifact
    const artifact = await getOrCreateArtifact(url)
    debug(config, `Artifact retrieved: ${JSON.stringify(artifact)}`)

    if (!artifact || !artifact.content) {
      throw new Error(`Invalid artifact structure: ${JSON.stringify(artifact)}`)
    }

    const testedUseCases = artifact.content.testedUseCases || []
    const bugs = artifact.content.bugs || []

    // If session_state is provided, we're continuing exploration
    if (session_state) {
      const state = JSON.parse(session_state)
      const summary = generateTestingSummary(artifact, url)

      return {
        content: [
          {
            type: 'text',
            text: `🔍 Continuing Exploration

${summary}`,
          },
        ],
      }
    }

    // First time - start new session
    // Navigate to page
    await runInteractiveCommand({
      test: 'exploratory',
      timestamp: sessionTimestamp,
      command: `Go To    ${url}`,
      line: 0
    })

    const summary = generateTestingSummary(artifact, url)
    const goal = defineTestingGoal(artifact, url)

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Smart Exploratory Testing Started

${summary}

---

## 🎯 Testing Goal

**Goal:** ${goal.goal} (Priority ${goal.priority})

**Why this matters:** ${goal.why}

**Complete test plan:**
${goal.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Success criteria:**
${goal.successCriteria.map(c => `- ✓ ${c}`).join('\n')}

**Test data I'll use:**
\`\`\`json
${JSON.stringify(goal.testData, null, 2)}
\`\`\`

---

## 🎯 Interactive Testing Workflow

This is an **interactive exploratory testing session**. Here's how we'll work together:

### Process:
1. **I propose** specific goal with complete test plan
2. **You approve or adjust** the goal/plan/data
3. **I execute** each step, reporting results
4. **I update** artifact after completing goal
5. **I propose** next goal based on what's tested

### Priority Order:
1. 🔴 **CRITICAL** - Billing/Payment/Stripe (Priority 10)
2. 🔴 **HIGH** - Signup/Login/Registration (Priority 8-9)
3. 🟡 **MEDIUM** - Core navigation and flows (Priority 5-7)
4. 🟢 **LOW** - Usability issues (Priority 2-3)
5. ⚪ **SKIP** - Accessibility/SEO (Priority 0)

---

## 📋 Ready to Start

**Questions for you:**
- Should I proceed with this goal? (yes/no)
- Want to change test data? (or say "yes" to use defaults above)
- Any specific scenarios to add to the plan?

**Say "yes" to proceed, or tell me what to adjust.**`,
        },
      ],
      _meta: {
        artifactId: artifact.id,
        goal: goal,
        initialState: JSON.stringify({
          sessionId,
          url,
          timestamp: sessionTimestamp,
          artifactId: artifact.id,
          goal: goal
        })
      }
    }

  } catch (error) {
    debug(config, `Error in exploratory testing: ${error.message}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ Failed to Start Exploratory Testing

**URL:** ${url}
**Error:** ${error.message}`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Register exploratory testing MCP tools
 */
export function registerExploratoryTools(server) {
  server.registerTool(
    'helpmetest_explore',
    {
      title: 'Help Me Test: Smart Exploratory Testing',
      description: `Intelligent exploratory testing that prioritizes critical user paths and tracks progress in artifacts.

**How it works:**
1. Call this tool with just a URL to start - creates/loads exploratory-testing artifact
2. Tool returns artifact ID - use helpmetest_get_artifact to see what's been tested
3. AI tests ONE untested use case at a time, highest priority first
4. After each test, AI updates artifact with helpmetest_upsert_artifact
5. AI reports bugs and asks if you want to continue

**Priority System:**
- 🔴 Priority 10: Billing, Payment, Stripe, Checkout (TEST FIRST)
- 🔴 Priority 8-9: Signup, Registration, Login
- 🟡 Priority 5-7: Core navigation and critical flows
- 🟢 Priority 2-3: Usability issues
- ⚪ Priority 0: Accessibility, SEO (SKIP)

**CRITICAL AI WORKFLOW:**
1. Call helpmetest_explore with URL → Get artifact ID
2. Call helpmetest_get_artifact with artifact ID → See testedUseCases and bugs
3. Identify untested critical path (check against testedUseCases list)
4. Test the path using helpmetest_run_interactive_command
5. Update artifact with helpmetest_upsert_artifact:
   - Add use case to testedUseCases array
   - Add bug to bugs array (if found)
6. Report findings to user
7. Ask: "Continue exploring? (Y/N)"
8. If yes, repeat from step 2

**Artifact Structure:**
{
  "content": {
    "url": "https://example.com",
    "testedUseCases": ["Pro subscription signup", "Free tier signup"],
    "bugs": [
      {
        "title": "Onboarding form validation broken",
        "priority": 10,
        "description": "...",
        "reproSteps": ["..."]
      }
    ]
  }
}

**Example Flow:**
- Call explore → Get artifact ID "exploratory-https-example-com"
- Fetch artifact → See ["Login"] already tested
- Test payment flow → Find bug
- Update artifact → Add "Payment flow" to testedUseCases, add bug
- Report bug #1 → Ask to continue
- User says yes → Fetch artifact again → Test signup (not in list yet)

**Session State:**
Optional - pass session_state from _meta to continue, but ALWAYS fetch artifact to see what's tested.`,
      inputSchema: {
        url: z.string().describe('URL to explore and test'),
        session_state: z.string().optional().describe('Session state from previous exploration (optional - artifact tracks state)'),
      },
    },
    async (args) => {
      debug(config, `Exploratory tool called with args: ${JSON.stringify(args)}`)
      return await handleExplore(args)
    }
  )
}
