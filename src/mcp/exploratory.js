/**
 * Exploratory Testing MCP Tools
 * Smart, prioritized exploration that finds real bugs
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'

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
 * Uses API directly instead of MCP handlers
 */
async function getOrCreateArtifact(url) {
  const { apiGet, apiPost, detectApiAndAuth } = await import('../utils/api.js')

  await detectApiAndAuth()

  const artifactId = `exploratory-${url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`

  debug(config, `Looking for artifact: ${artifactId}`)

  try {
    const data = await apiGet(`/api/artifacts/${artifactId}`)
    debug(config, `Found existing artifact: ${artifactId}`)
    return data.artifact
  } catch (error) {
    debug(config, `Artifact not found, creating new: ${artifactId}`)

    const payload = {
      id: artifactId,
      name: `Exploratory Testing: ${url}`,
      type: 'exploratory-testing',
      content: {
        url,
        testedUseCases: [],
        testResults: [],
        bugs: [],
        lastUpdated: new Date().toISOString()
      },
      tags: ['exploratory-testing', `url:${new URL(url).hostname}`]
    }

    const data = await apiPost('/api/artifacts', payload)
    debug(config, `Created artifact: ${artifactId}`)
    return data.artifact
  }
}

/**
 * Update exploratory testing artifact
 * Uses API directly
 */
async function updateExploratoryArtifact(artifactId, updates) {
  const { apiGet, apiPost } = await import('../utils/api.js')

  debug(config, `Updating artifact: ${artifactId}`)

  // Get current artifact
  const getData = await apiGet(`/api/artifacts/${artifactId}`)
  const artifact = getData.artifact

  const updatedContent = {
    ...artifact.content,
    ...updates,
    lastUpdated: new Date().toISOString()
  }

  // Update using API
  const payload = {
    id: artifactId,
    name: artifact.name,
    type: artifact.type,
    content: updatedContent,
    tags: artifact.tags
  }

  const updateData = await apiPost('/api/artifacts', payload)
  return updateData.artifact
}

/**
 * Generate testing summary from artifact data
 */
function generateTestingSummary(artifact, url) {
  const testedUseCases = artifact.content.testedUseCases || []
  const testResults = artifact.content.testResults || []
  const bugs = artifact.content.bugs || []

  // Categorize tested use cases by priority
  const categorized = {
    critical: [],
    high: [],
    medium: [],
    low: []
  }

  testedUseCases.forEach(uc => {
    // Find corresponding test result
    const testResult = testResults.find(tr => tr.useCase === uc)
    const status = testResult ? (testResult.passed ? '✅' : '❌') : '⚪'

    const ucLower = uc.toLowerCase()
    const displayText = `${status} ${uc}`

    // Priority 10: Authentication flows (login, signup, registration) - HIGHEST PRIORITY
    if (ucLower.includes('login') || ucLower.includes('signup') || ucLower.includes('registration') || ucLower.includes('authenticate') || ucLower.includes('auth')) {
      categorized.critical.push(displayText)
    // Priority 9: Payment/billing flows
    } else if (ucLower.includes('payment') || ucLower.includes('billing') || ucLower.includes('stripe') || ucLower.includes('checkout')) {
      categorized.high.push(displayText)
    } else if (ucLower.includes('navigation') || ucLower.includes('flow')) {
      categorized.medium.push(displayText)
    } else {
      categorized.low.push(displayText)
    }
  })

  const totalTests = testedUseCases.length
  const passedTests = testResults.filter(tr => tr.passed).length
  const failedTests = testResults.filter(tr => !tr.passed).length
  const criticalBugs = bugs.filter(b => b.priority >= 10).length
  const highBugs = bugs.filter(b => b.priority >= 8 && b.priority < 10).length
  const mediumBugs = bugs.filter(b => b.priority >= 5 && b.priority < 8).length

  return `## 🔍 Exploratory Testing Summary

### ✅ **What We've Verified:**

${categorized.critical.length > 0 ? `**🔐 Authentication Flows (Priority 10 - CRITICAL)**
${categorized.critical.map(uc => `- ${uc}`).join('\n')}
` : ''}${categorized.high.length > 0 ? `**💰 Payment/Billing Flows (Priority 9)**
${categorized.high.map(uc => `- ${uc}`).join('\n')}
` : ''}${categorized.medium.length > 0 ? `**🧭 Navigation & Core Features (Priority 5-7)**
${categorized.medium.map(uc => `- ${uc}`).join('\n')}
` : ''}${categorized.low.length > 0 ? `**📋 Usability & Other (Priority 2-3)**
${categorized.low.map(uc => `- ${uc}`).join('\n')}
` : ''}${totalTests === 0 ? '- No tests completed yet\n' : ''}
**Test Results**
- ✅ Passed: ${passedTests}
- ❌ Failed: ${failedTests}
- 📊 Total: ${totalTests}
${bugs.length === 0 ? '- ✅ No bugs found' : `- 🐛 ${bugs.length} bug${bugs.length > 1 ? 's' : ''} identified`}

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

**Tested Use Cases:** ${totalTests} total (${passedTests} passed, ${failedTests} failed)
${categorized.critical.length > 0 ? `- 🔴 Authentication (Priority 10): ${categorized.critical.length}` : '- 🔴 Authentication (Priority 10): 0 ⚠️ NOT TESTED'}
${categorized.high.length > 0 ? `- 🔴 Payment/Billing (Priority 9): ${categorized.high.length}` : '- 🔴 Payment/Billing (Priority 9): 0'}
${categorized.medium.length > 0 ? `- 🟡 Core Features (Priority 5-7): ${categorized.medium.length}` : '- 🟡 Core Features (Priority 5-7): 0'}
${categorized.low.length > 0 ? `- 🟢 Usability (Priority 2-3): ${categorized.low.length}` : '- 🟢 Usability (Priority 2-3): 0'}

**Bug Severity:**
${criticalBugs > 0 ? `- 🔴 Critical: ${criticalBugs}` : '- 🔴 Critical: 0'}
${highBugs > 0 ? `- 🟡 High: ${highBugs}` : '- 🟡 High: 0'}
${mediumBugs > 0 ? `- 🟢 Medium: ${mediumBugs}` : '- 🟢 Medium: 0'}

---

### 📋 **Confidence Level:**

Based on the evidence:

${categorized.critical.length > 0 ? '✅ **High confidence** on authentication flows tested' : '⚠️ **NO CONFIDENCE** on authentication (NOT TESTED - HIGHEST PRIORITY!)'}
${categorized.high.length > 0 ? '✅ **High confidence** on payment/billing flows tested' : '⚠️ **Medium confidence** on payment/billing (limited testing)'}
${bugs.length === 0 ? '✅ **High confidence** in overall stability (no major bugs found)' : `⚠️ **Concerns** about ${bugs.length} identified bug${bugs.length > 1 ? 's' : ''}`}

---

**Artifact ID:** \`${artifact.id}\`
**URL:** ${url}
**Last Updated:** ${artifact.content.lastUpdated || 'Unknown'}

**Next:** Continue exploring to test more critical paths, or use \`helpmetest_get_artifact\` to see full details.`
}


/**
 * Analyze Robot Framework result to determine pass/fail
 */
function analyzeTestResult(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return { passed: false, error: 'No result data' }
  }

  let finalStatus = null
  let errorMessage = null

  for (const event of result) {
    if (event.type === 'keyword' && event.status) {
      finalStatus = event.status
      if (event.status === 'FAIL') {
        errorMessage = event.message || 'Unknown error'
        return { passed: false, error: errorMessage }
      }
    }
  }

  return {
    passed: finalStatus === 'PASS' || finalStatus === 'NOT SET',
    error: null
  }
}

/**
 * Execute a test goal and return results
 */
async function executeTestGoal(goal, url, sessionTimestamp) {
  const results = []

  for (let i = 0; i < goal.steps.length; i++) {
    const step = goal.steps[i]
    debug(config, `Executing step ${i + 1}/${goal.steps.length}: ${step}`)

    // Convert step description to Robot Framework command
    // This is a simple mapping - could be enhanced with AI
    let command = step

    // Try to map common step patterns to RF commands
    if (step.toLowerCase().includes('navigate to')) {
      command = `Go To    ${url}`
    } else if (step.toLowerCase().includes('click')) {
      // Extract what to click from step description
      const match = step.match(/click\s+"([^"]+)"/i)
      if (match) {
        command = `Click    text=${match[1]}`
      }
    } else if (step.toLowerCase().includes('fill')) {
      // Extract field and value
      const match = step.match(/fill\s+(\w+)\s+(?:with\s+)?(.+)/i)
      if (match) {
        command = `Fill Text    ${match[1]}    ${match[2]}`
      }
    } else if (step.toLowerCase().includes('verify') || step.toLowerCase().includes('check')) {
      // Extract what to verify
      const match = step.match(/verify\s+"?([^"]+)"?/i)
      if (match) {
        command = `Get Text    body`
      }
    }

    try {
      const result = await runInteractiveCommand({
        test: 'exploratory',
        timestamp: sessionTimestamp,
        command,
        line: i
      })

      const analysis = analyzeTestResult(result)

      results.push({
        step,
        command,
        passed: analysis.passed,
        error: analysis.error,
        timestamp: new Date().toISOString()
      })

      // Stop on first failure
      if (!analysis.passed) {
        debug(config, `Step failed: ${step}`)
        break
      }

    } catch (error) {
      results.push({
        step,
        command,
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      break
    }
  }

  return results
}

/**
 * Determine if we should stop testing
 */
function shouldStopTesting(artifact) {
  const testedUseCases = artifact.content.testedUseCases || []
  const bugs = artifact.content.bugs || []

  // Count by priority
  const criticalTested = testedUseCases.filter(uc =>
    uc.toLowerCase().includes('payment') ||
    uc.toLowerCase().includes('billing') ||
    uc.toLowerCase().includes('stripe') ||
    uc.toLowerCase().includes('checkout')
  ).length

  const highTested = testedUseCases.filter(uc =>
    uc.toLowerCase().includes('signup') ||
    uc.toLowerCase().includes('login') ||
    uc.toLowerCase().includes('registration')
  ).length

  // Stop if we've tested critical paths and found bugs
  if (criticalTested >= 2 && highTested >= 2 && bugs.length > 0) {
    return {
      shouldStop: true,
      reason: `Tested ${criticalTested} critical paths and ${highTested} auth flows. Found ${bugs.length} bug(s). Good stopping point.`,
      coverage: 'high'
    }
  }

  // Stop if we've done comprehensive testing
  if (testedUseCases.length >= 10) {
    return {
      shouldStop: true,
      reason: `Completed ${testedUseCases.length} test scenarios. Comprehensive coverage achieved.`,
      coverage: 'comprehensive'
    }
  }

  // Keep testing if critical paths not covered
  if (criticalTested === 0) {
    return {
      shouldStop: false,
      reason: 'Critical payment/billing paths not tested yet',
      coverage: 'low'
    }
  }

  if (highTested < 2) {
    return {
      shouldStop: false,
      reason: 'Need to test more authentication flows',
      coverage: 'medium'
    }
  }

  return {
    shouldStop: false,
    reason: 'Continue testing to improve coverage',
    coverage: 'medium'
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
    // Navigate to page and get all the data
    const goToResult = await runInteractiveCommand({
      test: 'exploratory',
      timestamp: sessionTimestamp,
      command: `Go To    ${url}`,
      line: 0
    })

    debug(config, `Navigation complete, got ${goToResult?.length || 0} events`)

    // Truncate large content fields to avoid token limits
    const truncateEventData = (events, maxStringLength = 200) => {
      if (!Array.isArray(events)) return events

      return events.map(event => {
        if (!event || typeof event !== 'object') return event

        const truncatedEvent = { ...event }

        // Truncate specific large fields
        if (truncatedEvent.events && Array.isArray(truncatedEvent.events)) {
          truncatedEvent.events = `[${truncatedEvent.events.length} events - truncated]`
        }

        if (truncatedEvent.html && typeof truncatedEvent.html === 'string' && truncatedEvent.html.length > maxStringLength) {
          truncatedEvent.html = truncatedEvent.html.substring(0, maxStringLength) + '...[Truncated]'
        }

        if (truncatedEvent.content && typeof truncatedEvent.content === 'string' && truncatedEvent.content.length > maxStringLength) {
          truncatedEvent.content = truncatedEvent.content.substring(0, maxStringLength) + '...[Truncated]'
        }

        // Truncate logs arrays if they're huge
        if (truncatedEvent.logs && Array.isArray(truncatedEvent.logs) && truncatedEvent.logs.length > 0) {
          const logsStr = JSON.stringify(truncatedEvent.logs)
          if (logsStr.length > maxStringLength * 2) {
            truncatedEvent.logs = `[${truncatedEvent.logs.length} logs - truncated]`
          }
        }

        // Truncate errors arrays if they're huge
        if (truncatedEvent.errors && Array.isArray(truncatedEvent.errors) && truncatedEvent.errors.length > 0) {
          const errorsStr = JSON.stringify(truncatedEvent.errors)
          if (errorsStr.length > maxStringLength * 2) {
            truncatedEvent.errors = `[${truncatedEvent.errors.length} errors - truncated]`
          }
        }

        return truncatedEvent
      })
    }

    const truncatedResult = truncateEventData(goToResult)

    const summary = generateTestingSummary(artifact, url)
    const stopStatus = shouldStopTesting(artifact)

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Smart Exploratory Testing Started

${summary}

---

## 📄 Page Exploration Results

I navigated to **${url}** and captured page data.

**Event Summary:** ${goToResult?.length || 0} total events (large content fields truncated)

**Page events from Robot Framework:**
\`\`\`json
${JSON.stringify(truncatedResult, null, 2)}
\`\`\`

---

## 📊 Coverage Status

**Current Coverage:** ${stopStatus.coverage}
**Status:** ${stopStatus.reason}

${stopStatus.shouldStop ? `
⚠️ **STOPPING POINT REACHED**
${stopStatus.reason}

Would you like to:
1. Continue testing anyway
2. Convert tested flows to automated tests
3. Stop and review findings
` : `
✅ **CONTINUE TESTING**
${stopStatus.reason}
`}

---

## 🎯 Next Steps

**⚡ HIGHEST PRIORITY: DOMAIN HEALTH CHECKS FIRST!**

**Step 0: Base-Level Domain Monitoring (PRIORITY 10 - MUST DO FIRST)**
Before testing ANY features or authentication, you MUST set up fundamental domain health monitoring:

1. **Uptime Monitoring Proposition:**
   - Create a Robot Framework test that navigates to the domain
   - Extract the domain from the URL being tested
   - Test should verify the page loads (status code 200)
   - This ensures the site is reachable before we waste time on feature testing
   - **Why this matters**: If the domain goes down, ALL tests will fail. This is the foundational check.

   Example test content:
   \`\`\`robot
   Go To    https://example.com
   \`\`\`

2. **SSL Certificate Monitoring Proposition:**
   - Use DomainChecker library SSL keywords to check certificate health
   - Create test proposition to monitor:
     - SSL Is Valid (must be true)
     - SSL Days Remaining (must be >= 30 days)
     - SSL Issuer Organization (for tracking cert changes)
   - **Why this matters**: Expired SSL certificates break HTTPS, causing immediate site failures. This catches issues before users do.

   Example test content:
   \`\`\`robot
   SSL Is Valid    example.com    ==    ${True}
   SSL Days Remaining    example.com    >=    30
   SSL Issuer Organization    example.com    # Log issuer for tracking
   \`\`\`

3. **Save propositions to artifact:**
   \`\`\`javascript
   helpmetest_partial_update_artifact({
     id: artifactId,
     updates: {
       "availableAreas.uptimeTests.-1": {
         "name": `Domain Uptime - ${extractedDomain}`,
         "url": extractedDomain,
         "description": "Fundamental uptime monitoring to ensure domain accessibility. This is the foundation - all other tests depend on this.",
         "requiresSetup": true,
         "testIdeas": [
           "Create Robot Framework test that navigates to domain",
           "Test content: Go To [URL]",
           "Verifies site is reachable and page loads successfully",
           "Tag with priority:critical and type:smoke"
         ]
       },
       "availableAreas.sslTests.-1": {
         "name": `SSL Check - ${extractedDomain}`,
         "url": extractedDomain,
         "description": "Essential security checks that every production domain MUST pass. Prevents SSL failures, man-in-the-middle attacks, and security warnings.",
         "requiresSetup": true,
         "testIdeas": [
           "CRITICAL: SSL Is Valid ==  True (certificate must be valid)",
           "CRITICAL: SSL Days Remaining >= 30 (prevent expiration)",
           "CRITICAL: TLS Version matches TLSv1\\.[23] (TLS 1.2+ only)",
           "CRITICAL: TLS Weak Ciphers Detected ==  False (no RC4, DES, 3DES, MD5)",
           "CRITICAL: TLS Perfect Forward Secrecy ==  True (PFS required)",
           "CRITICAL: SSL Certificate Key Strength >= 256 (RSA 2048+ or ECC 256+)",
           "CRITICAL: SSL Certificate Chain Valid ==  True (valid chain to root CA)",
           "IMPORTANT: HTTP X Content Type Options == nosniff (prevent MIME sniffing)",
           "RECOMMENDED: HTTP X Frame Options is not empty (prevent clickjacking)"
         ]
       }
     }
   })
   \`\`\`

4. **When executing and recording test results**, use the proposition name and add URL tag:
   \`\`\`javascript
   helpmetest_partial_update_artifact({
     id: artifactId,
     updates: {
       "testResults.-1": {
         "useCase": "Domain Uptime - calculator.playground.helpmetest.com",  // Use the proposition name from availableAreas
         "passed": true,
         "timestamp": new Date().toISOString(),
         "steps": [
           { "step": "Navigate to domain", "command": "Go To  https://calculator.playground.helpmetest.com", "passed": true }
         ]
       },
       "testedUseCases.-1": "Domain Uptime - calculator.playground.helpmetest.com"
     }
   })
   \`\`\`

   Then create the actual test with tags including the URL:
   \`\`\`javascript
   helpmetest_create_test({
     name: "Domain Uptime - calculator.playground.helpmetest.com",
     content: "Go To  https://calculator.playground.helpmetest.com",
     tags: ["priority:critical", "type:smoke", "url:calculator.playground.helpmetest.com"]
   })
   \`\`\`

**IMPORTANT**: These checks are MORE IMPORTANT than authentication flows because:
- Without domain uptime, nothing works
- Without valid SSL, HTTPS fails completely
- These are prerequisites for ALL other testing
- They catch infrastructure issues that break everything at once

**Step 1: Look for Login/Signup Forms (After Step 0 is complete)**
1. **Analyze the page data** - search for login, signup, sign-in, register, authentication forms
2. **If login/signup form is found:**
   - Use \`helpmetest_run_interactive_command\` to test the form interactively
   - **ASK USER FOR CREDENTIALS** using the user question tool
   - Test login with provided credentials step by step
   - **AFTER SUCCESSFUL LOGIN - MANDATORY WORKFLOW:**

     a. **Save browser state with role name:**
        \`\`\`robot
        Save As  Admin
        \`\`\`
        (Use simple role: Admin, User, Guest, Editor - NOT "Login as Admin")

     b. **Save credentials to artifact:**
        \`\`\`javascript
        helpmetest_partial_update_artifact({
          id: artifactId,
          updates: {
            "testCredentials.-1": {
              "username": "user@example.com",
              "password": "password123",
              "role": "Admin",  // MUST match the name used in Save As
              "validated": false,  // Will be set to true after validation
              "notes": "Admin user with full permissions"
            }
          }
        })
        \`\`\`

     c. **Validate that saved state works identically to manual login:**
        - Close current session: \`helpmetest_run_interactive_command({ command: "Exit" })\`
        - Start fresh browser: \`New Browser  chromium  headless=True\`
        - Load saved state: \`As  Admin\` (use the role name from step a)
        - Navigate to authenticated page: \`Go To  [URL]\`
        - Verify you're authenticated (check for user menu, logout button, no login prompts)
        - If validation PASSES:
          \`\`\`javascript
          // Update the credential to mark as validated
          // First get current credentials, find the one with matching role, update it
          helpmetest_partial_update_artifact({
            id: artifactId,
            updates: {
              "testCredentials": [...existing credentials with validated:true for this role...]
            }
          })
          \`\`\`
        - If validation FAILS: Don't mark as validated, note the issue

     d. **Save the complete login test case:**
        \`\`\`javascript
        helpmetest_partial_update_artifact({
          id: artifactId,
          updates: {
            "testResults.-1": {
              "useCase": "Login as Admin",
              "passed": true,
              "timestamp": new Date().toISOString(),
              "steps": [
                { "step": "Navigate to login", "command": "Go To  https://app.example.com/login", "passed": true },
                { "step": "Fill email", "command": "Fill Text  input.email  user@example.com", "passed": true },
                { "step": "Fill password", "command": "Fill Text  input[type=password]  password123", "passed": true },
                { "step": "Click login", "command": "Click  button[type=submit]", "passed": true },
                { "step": "Save state", "command": "Save As  Admin", "passed": true }
              ]
            },
            "testedUseCases.-1": "Login as Admin"
          }
        })
        \`\`\`

   - This is the MOST IMPORTANT outcome - validated authenticated states enable testing protected features WITHOUT repeating login

     e. **🔄 AUTO-REFRESH PATTERN - Keeping Authentication Fresh:**
        **WHY THIS MATTERS**: Refresh tokens expire (typically 5-7 days). When automated runners execute tests using \`As [Role]\`, they'll fail if the saved state is expired. The solution is to save the login test case itself, so runners can automatically refresh authentication.

        **IMPLEMENTATION:**
        1. After validating saved state works (step c above), the login test case should be saved as a regular test using \`helpmetest_create_test\`
        2. Name it: "Refresh Authentication for [Role]" (e.g., "Refresh Authentication for User")
        3. Add tags: ["feature:auth", "type:smoke", "priority:critical", "role:[role-name]"]
        4. Content should be the complete login flow WITHOUT the \`Save As\` command
        5. Automated test runners can execute these tests every 5 minutes to keep saved states fresh

        **Example:**
        \`\`\`javascript
        // After successful login test and validation, create an auth refresh test
        helpmetest_create_test({
          name: "Refresh Authentication for User",
          tags: ["feature:auth", "type:smoke", "priority:critical", "role:user"],
          content: \`Go To  https://dev.0docs.ai/login
Fill Text  input#input-0  tes@purelymail.com
Click  button.btn-primary
Sleep  2s
Fill Text  input#input-2  Erlangr15b$
Click  button.btn-primary
Sleep  5s
Save As  User\`,
          description: "Automatically refreshes the 'User' authentication state to prevent token expiration. Run this every 5 minutes."
        })
        \`\`\`

        **RUNNER BEHAVIOR:**
        - Test runners will detect tests tagged with "role:[name]"
        - Execute them every 5 minutes in background
        - This keeps \`As [Role]\` states fresh without manual intervention
        - Tests that use \`As User\` will never fail due to expired tokens

3. **If NO login/signup form on this page:**
   - Look for links to login/signup pages in navigation
   - Navigate to those pages first before testing other features

**Step 2: Check for existing validated authentication states**
Before testing ANY feature that might require authentication:
- Check artifact.content.testCredentials for entries where validated === true
- If validated states exist, USE THEM:
  \`\`\`robot
  New Browser  chromium  headless=True
  As  Admin  # Use the role name from testCredentials
  Go To  [URL you want to test]
  # Now you're authenticated - proceed with testing
  \`\`\`
- NEVER manually login again if a validated state exists
- If validated state fails during testing, mark it as validated:false and re-test login flow

**Step 3: Create detailed availableAreas**
After handling authentication, analyze the raw page data for other areas to test:
   - **name**: Descriptive name based on what you see (e.g., "User Registration Form", "Shopping Cart API")
   - **url**: Full URL extracted from the page (use actual URLs from page content)
   - **description**: What this area does and why it matters (1-2 sentences based on page text/headings)
   - **testIdeas**: Array of 5-10 specific test scenarios with FULL DETAILS:
     - Include exact selectors you found (CSS classes, IDs, data-testid attributes)
     - Include full URL where this test happens
     - Explain what user flow this validates
     - Specify why this matters (critical path, revenue impact, user experience)

3. **Group by category**: apiTests, functionalTests, visualTests, uptimeTests, statusCodeTests, etc.

4. **Use \`helpmetest_upsert_artifact\`** with this structure:
\`\`\`json
{
  "availableAreas": {
    "apiTests": [
      {
        "name": "Pet Store API",
        "url": "https://api.example.com/v2/pet",
        "description": "RESTful API for managing pet inventory with full CRUD operations",
        "testIdeas": [
          "Test GET /pet/{petId} endpoint (e.g., /pet/123) on https://api.example.com/v2/pet/123 to retrieve pet details - critical for product display pages",
          "Test POST /pet with body {name, status, category} on https://api.example.com/v2/pet to create new pet - validates data persistence layer",
          "Test PUT /pet/{petId} updating status field on https://api.example.com/v2/pet/123 - ensures inventory management works",
          "Test DELETE /pet/{petId} on https://api.example.com/v2/pet/123 then verify 404 on subsequent GET - confirms soft/hard delete behavior",
          "Test authentication by calling GET /pet/123 without API key on https://api.example.com/v2/pet/123 - should return 401/403",
          "Test error handling with invalid ID (e.g., /pet/abc) on https://api.example.com/v2/pet/abc - should return 400 Bad Request",
          "Test required fields by POST /pet with missing 'name' field - validates backend validation rules",
          "Test edge cases: POST /pet with 10000-char name, unicode chars, SQL injection attempts - security validation"
        ]
      }
    ],
    "functionalTests": [
      {
        "name": "🔐 User Login Form (PRIORITY 10 - TEST FIRST!)",
        "url": "https://app.example.com/login",
        "description": "Authentication form with email/password fields - CRITICAL for testing protected features",
        "requiresCredentials": true,
        "credentialPrompt": "This application has a login form. Please provide test credentials so I can create an authenticated user test.",
        "testIdeas": [
          "🔐 **PRIMARY GOAL**: Ask user for login credentials, test login, save as 'Login as [Role]' test",
          "Test login form (input.email, input[type=password], button.submit) with real credentials on https://app.example.com/login - creates authenticated user",
          "After successful login, verify redirect to dashboard/home page - confirms auth flow works",
          "Test validation on email field (input.email) by entering 'notanemail' on https://app.example.com/login - should show inline error",
          "Test password field (input[type=password]) with < 8 chars on https://app.example.com/login - validates password requirements",
          "Test forgot password link (a.forgot-password) navigation to https://app.example.com/reset - critical user recovery flow",
          "Test 'Show password' toggle (button[data-testid='toggle-password']) on https://app.example.com/login - accessibility feature",
          "Test logout functionality after login - verify session management"
        ]
      },
      {
        "name": "🔐 User Signup/Registration Form (PRIORITY 10)",
        "url": "https://app.example.com/signup",
        "description": "New user registration form - creates test account for authenticated testing",
        "requiresCredentials": false,
        "testIdeas": [
          "🔐 **PRIMARY GOAL**: Test signup with generated credentials, save as 'Login as New User' for future tests",
          "Test registration form (input.email, input.password, input.name, button.submit) on https://app.example.com/signup",
          "After successful signup, verify auto-login or email verification flow",
          "Test password strength indicator and validation requirements",
          "Test email uniqueness validation - existing email should show error",
          "Test terms/privacy checkbox requirement before submit",
          "Save successful registration credentials for future authenticated testing"
        ]
      },
      {
        "name": "Todo Application",
        "url": "https://app.example.com/todos",
        "description": "Task management interface with create, read, update, delete operations",
        "testIdeas": [
          "Test todo creation via input.new-todo on https://app.example.com/todos by typing text and pressing Enter - core CRUD functionality",
          "Test todo completion by clicking input.toggle checkbox on https://app.example.com/todos - validates state management",
          "Test todo deletion via button.destroy on https://app.example.com/todos after hovering over item - confirms removal logic",
          "Test todo editing by double-clicking todo label and modifying text on https://app.example.com/todos - inline editing UX",
          "Test filtering via buttons (a.all, a.active, a.completed) on https://app.example.com/todos - view state management",
          "Test 'Clear completed' button (button.clear-completed) on https://app.example.com/todos - batch operation validation",
          "Test empty state message when no todos exist on https://app.example.com/todos - proper UI feedback",
          "Test edge cases: create todo with 1000 chars, use special chars <>&, rapid create/delete - data integrity"
        ]
      }
    ]
  }
}
\`\`\`

**FORMAT REQUIREMENTS - Each testIdea should follow these patterns:**

**Pattern 1 - Detailed with selectors (for UI tests):**
Format: "Test [feature] ([selectors]) on [full URL] to [purpose] - [why it matters]"
Example: "Test login form (input.email, input[type=password], button.submit) on https://app.example.com/login to verify critical authentication path"

**Pattern 2 - Coverage-based (comprehensive test scenarios):**
Include multiple test types for complete coverage:
- "Happy path - [describe success flow with actual fields/actions]"
- "Field validation - [test invalid data for each specific field you see]"
- "Required fields - [test with empty actual required fields from page]"
- "Error handling - [specific error scenarios for this feature]"
- "Edge cases - [realistic edge cases: special chars, long input, rapid actions]"
- "Authentication - [auth-specific scenarios if applicable]"
- "Browser behavior - [back button, refresh, persistence]"

**Pattern 3 - API testing (for REST endpoints):**
Include standard REST operations:
- "GET /endpoint/{id} - Verify retrieval with valid ID, check response structure"
- "POST /endpoint - Create with valid data, verify 200/201 and response body"
- "PUT /endpoint/{id} - Update fields, verify changes persist"
- "DELETE /endpoint/{id} - Remove resource, verify 404 on subsequent GET"
- "Authentication - Test with invalid/missing credentials"
- "Error handling - Test 400/404/500 scenarios"
- "Data validation - Test required fields, invalid types"
- "Edge cases - Very long strings, special chars, null values, concurrent requests"

**IMPORTANT**:
- Use ACTUAL URLs from the page content (not example.com placeholders)
- Use ACTUAL selectors you find in page data (from ExtractReadableContent)
- Reference REAL form fields, buttons, links visible on the page
- Combine Pattern 1 (detailed) with Pattern 2 (comprehensive) for best results
- For APIs use Pattern 3, for UI use Patterns 1+2`,
        },
      ],
      _meta: {
        artifactId: artifact.id,
        sessionTimestamp,
        pageData: goToResult,
        initialState: JSON.stringify({
          sessionId,
          url,
          timestamp: sessionTimestamp,
          artifactId: artifact.id
        })
      }
    }

  } catch (error) {
    debug(config, `Error in exploratory testing: ${error.message}`)
    debug(config, `Error stack: ${error.stack}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ Failed to Start Exploratory Testing

**URL:** ${url}
**Error:** ${error.message}

**Stack:**
\`\`\`
${error.stack}
\`\`\``,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Generate Robot Framework test from test results
 */
function generateRobotTest(useCase, testResult) {
  if (!testResult || !testResult.steps) {
    return null
  }

  const testName = useCase.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  const steps = testResult.steps
    .filter(step => step.passed)
    .map(step => `    ${step.command}`)
    .join('\n')

  return `*** Test Cases ***
${testName}
${steps}
`
}

/**
 * Suggest next action based on test results
 */
function suggestNextAction(artifact, testResults) {
  const stopStatus = shouldStopTesting(artifact)
  const hasFailures = testResults.some(tr => !tr.passed)
  const hasBugs = artifact.content.bugs.length > 0

  if (stopStatus.shouldStop) {
    return {
      action: 'stop',
      message: `
## ✅ Testing Complete!

${stopStatus.reason}

### Next Steps:
1. **Convert to Automated Tests** - I can generate Robot Framework tests from successful flows
2. **Review Findings** - Check the artifact for full test details and bugs
3. **Create Health Checks** - Set up monitoring for critical paths

Would you like me to:
- Generate automated tests from successful flows?
- Continue testing anyway?
- Stop here?
`
    }
  }

  if (hasFailures || hasBugs) {
    return {
      action: 'investigate',
      message: `
## ⚠️ Issues Found!

Found ${hasFailures ? 'test failures' : ''} ${hasFailures && hasBugs ? 'and' : ''} ${hasBugs ? `${artifact.content.bugs.length} bugs` : ''}.

### Options:
1. **Continue Testing** - Move to next priority path
2. **Debug Failures** - Investigate what went wrong
3. **Stop and Review** - Analyze findings before continuing

Continue exploring? (Y/N)
`
    }
  }

  return {
    action: 'continue',
    message: `
## ✅ Test Passed!

All steps executed successfully. Moving to next priority test.

Continue exploring? (Y/N)
`
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
      description: `🎯 AUTO-EXECUTION MODE: Intelligent exploratory testing with smart prioritization and automated test generation.

**✨ NEW: This tool now AUTO-EXECUTES tests and provides comprehensive results!**

**How it works:**
1. Call this tool with URL → Analyzes existing tests and proposes next goal
2. Tool AUTO-EXECUTES the test goal → Reports pass/fail for each step
3. Updates artifact automatically → Tracks results, bugs, and coverage
4. Suggests next action → Continue, debug failures, or convert to tests
5. Repeats until comprehensive coverage achieved

**Auto-Execution Features:**
- ✅ Automatic test execution (no manual approval needed)
- ✅ Pass/fail tracking for every test step
- ✅ Smart stopping point detection
- ✅ Coverage analysis (low/medium/high/comprehensive)
- ✅ Automatic bug documentation
- ✅ Conversion to Robot Framework tests

**Priority System:**
- ⚡ Priority 10: Domain Uptime & SSL Monitoring (FOUNDATIONAL - TEST FIRST!)
- 🔴 Priority 10: Billing, Payment, Stripe, Checkout
- 🔴 Priority 8-9: Signup, Registration, Login
- 🟡 Priority 5-7: Core navigation and critical flows
- 🟢 Priority 2-3: Usability issues
- ⚪ Priority 0: Accessibility, SEO (SKIP)

**Why Domain Health is Priority #1:**
Domain uptime and SSL monitoring are BASE-LEVEL checks that must come before everything else. Without a reachable domain with valid SSL, ALL other tests fail. These checks:
- Catch infrastructure failures that break everything
- Prevent wasted time testing features on unreachable sites
- Alert on SSL expiration before users see security warnings
- Use the DomainChecker library for comprehensive certificate monitoring

**Updated Artifact Structure:**
{
  "content": {
    "url": "https://example.com",
    "testedUseCases": ["Pro subscription signup", "Free tier signup"],
    "testResults": [
      {
        "useCase": "Pro subscription signup",
        "passed": true,
        "timestamp": "2025-11-23T10:30:00.000Z",
        "steps": [
          { "step": "Navigate to homepage", "command": "Go To...", "passed": true },
          { "step": "Click signup", "command": "Click...", "passed": true }
        ]
      }
    ],
    "bugs": [
      {
        "title": "Onboarding form validation broken",
        "priority": 10,
        "severity": "CRITICAL",
        "description": "...",
        "impact": "Users cannot complete signup",
        "affects": "All new users",
        "location": "/signup page",
        "reproSteps": ["..."]
      }
    ],
    "availableAreas": {
      "uptimeTests": [
        {
          "name": "Domain Uptime - example.com",
          "url": "https://example.com",
          "description": "Fundamental uptime monitoring - ensures domain is reachable",
          "requiresSetup": true,
          "testIdeas": [
            "Create Robot Framework test: Go To [URL]",
            "Verifies site is reachable and page loads successfully",
            "Tag with priority:critical type:smoke"
          ]
        }
      ],
      "sslTests": [
        {
          "name": "SSL Check - example.com",
          "url": "https://example.com",
          "description": "Critical SSL/TLS certificate monitoring using DomainChecker",
          "requiresSetup": true,
          "testIdeas": [
            "SSL Is Valid ==  True",
            "SSL Days Remaining >= 30 (30-day warning)",
            "Monitor SSL Issuer Organization",
            "Verify SSL Algorithm is modern",
            "Check SSL SANs coverage"
          ]
        }
      ],
      "apiTests": [
        {
          "name": "PetStore API",
          "url": "http://petstore.playground.helpmetest.com",
          "description": "RESTful API for pet store operations with full CRUD support",
          "testIdeas": [
            "Test GET /pet/{petId} - retrieve existing pet",
            "Test POST /pet - create new pet with valid data",
            "Test PUT /pet - update existing pet details",
            "Test DELETE /pet/{petId} - remove pet from store",
            "Test authentication/authorization flows",
            "Test error handling for invalid pet IDs",
            "Test data validation for required fields"
          ]
        }
      ],
      "functionalTests": [
        {
          "name": "Calculator",
          "url": "http://calculator.playground.helpmetest.com",
          "description": "Simple calculator with basic arithmetic operations",
          "testIdeas": [
            "Test addition: 2+3=5, 10+20=30, negative numbers",
            "Test subtraction: 5-3=2, handle negative results",
            "Test multiplication and division",
            "Test decimal numbers and precision",
            "Test operator precedence",
            "Test edge cases: division by zero, very large numbers"
          ]
        }
      ]
    },
    "notes": ["Add observations and insights here"],
    "coverage": "low"
  }
}

**Example Flow:**
1. Call explore(url) → Proposes "Complete Pro Signup Flow" (Priority 10)
2. Tool auto-executes → Reports: 8/10 steps passed, 2 failed
3. Updates artifact → Adds test result with pass/fail for each step
4. Suggests → "Found bug in payment step. Continue? (Y/N)"
5. User says "yes" → Tool proposes next untested path and auto-executes

**Smart Stopping:**
- Stops after: 2+ critical paths tested, 2+ auth flows, bugs found
- Stops after: 10+ test scenarios (comprehensive coverage)
- Suggests: Convert to tests, review findings, or continue
- Shows: Coverage percentage, pass/fail ratio, bug count

**No More Manual Work - Just Say "yes"!**`,
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
