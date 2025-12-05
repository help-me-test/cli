/** SCOUT exploratory cycle for reference
 * https://scoutqa.ai/
Toggle Chat Panel
Preview
Report
Rerun
Hi Scout, help me to test https://scoutqa.ai/.
I'll help you test https://scoutqa.ai/. Based on the router context, this is an AI-powered testing companion platform. Let me create a structured plan to thoroughly test the key areas, especially focusing on AI/automation app functionality.


Update todos 5 tasks
Completed
Open URL https://scoutqa.ai/
Completed
Tool execution screenshot
Now let me check for console errors and network issues:


Check console messages
Completed
Check network requests
Completed
Let me now test the main URL input functionality and examine the key CTAs:


Update todos 1 of 5 completed
Completed
Type https://example.com into URL input textbox
Completed
Tool execution screenshot
Click Start Scouting button
Completed
Tool execution screenshot
I can see the form has been submitted and is showing "Opening the session..." with animated dots. Let me wait a bit and check if it redirects or shows results:


Evaluate script
Completed
Great! The app successfully navigated to a testing session page. I can see:

It's now testing https://example.com/
There's a crawl that completed
The interface shows tabs for "Preview" and "Report"
There's a chat interface and summary panel
Let me explore the Report tab and see what kind of testing results it provides:


Click Report tab
Completed
Tool execution screenshot
Excellent! I can see that Scout is actively running an AI-powered testing session. It has:

Created a structured task list (5 tasks)
Is currently running "Open URL" action
Shows the progress of each task with visual indicators
Has an AI assistant providing contextual analysis
Let me wait for the testing to complete and check the chat panel:


Click Toggle Chat Panel button
Completed
Tool execution screenshot
I can see the chat panel has been toggled and the layout shows the tasks panel more prominently. Let me try the Preview tab to see how the AI testing results are presented:


Click Preview tab
Completed
Tool execution screenshot
Let me now test the authentication flow by going to the sign-up area:


Update todos 3 of 5 completed
Completed
Open URL https://scoutqa.ai/
Completed
Tool execution screenshot
Click Login / Sign Up button
Completed
Tool execution screenshot
Perfect! I found the login/signup modal. Let me test the email signup flow:


Type scoutqa.ai+019ad543-d42a-75a0-ae01-310e8cda628f@execution.scoutqa.cc into Email textbox
Completed
Tool execution screenshot
Click Send magic link button
Completed
Tool execution screenshot
Great! The email magic link was sent successfully. Let me check the emails:


Excellent! Let me follow the magic link:


Open URL https://scoutqa.ai/api/auth/magic-link/verify?token=aJPRVfKEiANHZeLhDBMFcjUAveePgFYv&callbackURL=%2Foverview&errorCallbackURL=%2Fauth%2Ferror
Completed
Tool execution screenshot
Perfect! The magic link authentication worked and I'm now logged in to the overview page. Let me wait for the page to fully load:


Evaluate script
Completed
Excellent! The onboarding process redirected me to set up the first project. I can see it's step 1 of 2. Let me complete this onboarding flow:


Type https://example.com into Application URL textbox
Completed
Tool execution screenshot
Click Continue button
Completed
Tool execution screenshot
Great! Now I'm on step 2 of 2. I can see that Scout automatically filled in "Example Domain" as the project name. Let me add a description and complete the setup:


Type Testing Scout's AI quality companion features on a sample domain into Project description textbox
Completed
Tool execution screenshot
Click Create project button
Completed
Tool execution screenshot
Perfect! The project is being created. I can see the button shows "Creating project…" with a loading state. Let me wait for it to complete:


Evaluate script
Completed
Fantastic! The onboarding completed successfully and I'm now in the main project execution view. I can see:

Project Created: "Example Domain" project at https://example.com/
Execution Started: Scout has already initiated testing with a conversation
UI Elements: Preview/Report tabs, chat panel, timer showing 59:49
Status: Shows "Crawl Completed"
AI Response: Scout is providing comprehensive testing plan
Now let me check the final performance and accessibility aspects:


Update todos 4 of 5 completed
Completed
Navigate back
Completed
Tool execution screenshot
Let me navigate to the main homepage:


Open URL https://scoutqa.ai/
Completed
Tool execution screenshot
Now let me check for accessibility and SEO issues, and test keyboard navigation:


Press key Tab
Completed
Tool execution screenshot
Good! I can see keyboard focus is working - the user button is now focused. Let me check some additional keyboard navigation and examine key issues:


Press key Tab
Completed
Tool execution screenshot
Perfect! The focus moved to the URL input textbox. Let me now identify any issues I've found during testing:


Update todos 5 of 5 completed
Completed
Now let me report the key issues I discovered during my testing:


Close the page
Completed
Tool execution screenshot
Test Summary for Scout QA - AI Quality Companion

I've completed a comprehensive test of https://scoutqa.ai/, focusing on the AI-powered testing platform's core functionality. Here's what I discovered:

✅ Successfully Tested Features

🎯 Core AI Testing Flow

URL Input & Analysis: Successfully tested the main URL submission (https://example.com)
AI Testing Session: Scout automatically initiated comprehensive testing with structured task lists
Real-time Progress: Watched Scout execute 5 testing tasks with visual progress indicators
AI Reporting: Generated contextual analysis and recommendations in chat interface
🔐 Authentication & Onboarding

Magic Link Auth: Successfully tested email-based magic link authentication
Smooth Onboarding: Two-step project setup with auto-filled project names
Project Creation: Completed full project creation flow for "Example Domain"
⚡ Performance & Usability

Fast Load Times: Homepage loads quickly with proper resource optimization
Responsive Design: Clean, professional interface with proper spacing
Keyboard Navigation: Tab navigation works correctly through form elements
Visual Feedback: Loading states and progress indicators function properly
🔍 Key Findings

Strengths:

Intuitive user experience with clear CTAs
Robust AI testing automation with structured output
Seamless magic link authentication
Professional design with good accessibility basics
Proper error handling during form submissions
Areas for Improvement:

WebSocket Connectivity: Intermittent AWS Bedrock connection failures
Resource Loading: Some Google static resources failing (404s)
Widget Conflicts: Duplicate Usersnap widget initialization
📊 Issues Identified

3 Medium/Low severity issues logged for performance optimization
No critical security or accessibility blockers found
All primary user flows completed successfully
🎯 Recommendations

Monitor AWS Bedrock connections for AI reliability
Clean up resource loading to reduce network noise
Optimize third-party widget loading to prevent duplicates
Overall Assessment: Scout demonstrates solid AI-powered testing capabilities with a polished user experience. The core functionality works reliably, making it suitable for teams seeking automated quality assurance with AI insights.


So what can you do about it?
Great question! As Scout's AI testing companion, I can help you address these issues in several ways:

🛠️ Immediate Actions I Can Take

1. Deep Technical Analysis

I can run more targeted tests to:

Trace WebSocket failures: Monitor the exact failure patterns and timing
Network performance audit: Analyze all failed requests and their impact
Load testing simulation: Test under different conditions to isolate issues
2. Comprehensive Bug Documentation

I can provide:

Detailed reproduction steps with exact URLs and conditions
Browser compatibility testing across different environments
Performance metrics with specific timing data
Screenshots and video evidence of issues
3. Code-Level Investigation

I can:

Inspect network requests to identify root causes
Analyze JavaScript errors in detail with stack traces
Check resource loading order and dependencies
Test edge cases that might reveal underlying problems
🔧 What I'd Recommend Next

For the WebSocket Issues:

bash


# I can help you test:
- Connection retry logic
- Fallback mechanisms when AWS Bedrock is unavailable  
- User experience during connection failures
- Error message clarity for users
For Resource Loading:

bash


# I can audit:
- Which Google resources are actually needed
- CDN configuration and fallbacks
- Impact on page load performance
- Alternative resource hosting options
For Widget Conflicts:

bash


# I can check:
- Loading sequence of third-party scripts
- Duplicate initialization points
- Performance impact of multiple instances
- Cleanup and prevention strategies
🚀 Actionable Next Steps

Want me to:

Run targeted performance tests on specific problem areas?
Create detailed bug reports with technical specifications?
Test proposed fixes if your team has solutions ready?
Monitor the issues over time to track frequency and impact?
Test competitor solutions to benchmark best practices?
Or would you prefer I:

Focus on a specific issue that's most critical to your users?
Test different scenarios (mobile, slow connections, etc.)?
Help prioritize which fixes would have the biggest impact?
What would be most valuable for your team right now? I can dive deeper into any of these areas and provide actionable insights your developers can use immediately.




Initializing...
Scout successfully tested the AI-powered testing platform at scoutqa.ai, completing all core user flows including URL submission, AI testing automation, magic link authentication, and project onboarding. The testing revealed three minor performance issues: WebSocket connection failures to AWS Bedrock, duplicate Usersnap widget initialization, and failed Google static resource requests, but no critical blockers were found. The platform demonstrates solid AI testing capabilities with reliable functionality
Tasks

Navigate to site and analyze homepage structure & console issues
Test navigation, CTAs, and core user flows
Examine AI testing features and automation workflows
Check authentication, signup, and user onboarding
Validate performance, accessibility, and SEO elements
Issues

WebSocket connection failures to AWS Bedrock
PERFORMANCE
Multiple WebSocket connection errors to 'wss://bedrock-agentcore.us-east-1.amazonaws.com/browser-streams/aws...' appear in console during AI testing operations. This could impact real-time AI functionality and user experience during testing sessions.
Duplicate Usersnap widget initialization
PERFORMANCE
Console warning shows 'Multiple instances of jukebox were added to this page' at https://resources.usersnap.com/wi..., suggesting duplicate initialization of the Usersnap feedback widget.
Failed Google static resource requests
PERFORMANCE
Several 404 errors for Google static resources (t0.gstatic.com) during page load. While these don't break core functionality, they create unnecessary network noise.

 * 
 */

/**
 * Exploratory Testing MCP Tools
 * Smart, prioritized exploration that finds real bugs
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runInteractiveCommand, detectApiAndAuth } from '../utils/api.js'
import { formatResultAsMarkdown } from './formatResultAsMarkdown.js'
import { openSessionInBrowser } from './interactive.js'

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
        test: 'interactive',
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
 * Check existing tests to avoid duplicating work
 * Returns relevant existing tests that match the URL/domain
 */
async function getExistingTests(url) {
  const { apiGet } = await import('../utils/api.js')

  try {
    const hostname = new URL(url).hostname
    const urlPath = new URL(url).pathname

    // Get all tests
    const data = await apiGet('/api/tests')
    const tests = data.tests || []

    // Find tests that match this URL/domain
    const relevantTests = tests.filter(test => {
      const tags = test.tags || []
      const testName = test.name?.toLowerCase() || ''
      const testContent = test.content?.toLowerCase() || ''

      // Match by URL/domain tags
      const tagMatch = tags.some(tag =>
        tag.includes(hostname) ||
        tag.includes('url:' + hostname) ||
        tag.includes('domain:' + hostname)
      )

      // Match by URL in test content
      const contentMatch = testContent.includes(hostname)

      // Match by URL in test name
      const nameMatch = testName.includes(hostname.replace(/\./g, ' '))

      // Extract feature/platform indicators from URL
      // e.g., calculator.playground.helpmetest.com → "calculator"
      const urlFeature = hostname.split('.')[0]

      // Match by feature tag (e.g., feature:calculator)
      const featureMatch = urlFeature && tags.some(tag =>
        tag.includes('feature:' + urlFeature) ||
        tag.includes('component:' + urlFeature) ||
        tag.includes('platform:' + urlFeature)
      )

      return tagMatch || contentMatch || nameMatch || featureMatch
    })

    debug(config, `Found ${relevantTests.length} existing tests for ${hostname}`)

    return relevantTests.map(t => ({
      name: t.name,
      tags: t.tags,
      content: t.content,
      description: t.description
    }))
  } catch (error) {
    debug(config, `Error fetching existing tests: ${error.message}`)
    return []
  }
}

/**
 * Generate exploratory testing instructions - completely generic
 */
function generateExploratoryInstructions(artifact, existingTests, url) {
  const artifactId = artifact?.id || `exploratory-${url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`

  return `## 🎯 Exploratory Testing Workflow

**Your Task:** Analyze the page and propose the most valuable test to run next.

**Critical Workflow (Follow Exactly):**

### Step 0: Analyze Page and Create Artifact Scaffolding (FIRST TIME ONLY)

**IMPORTANT:** Only do this step if artifact's \`availableAreas\` is empty or missing!

0. **Analyze the page data** below and populate the artifact with test areas:

   **Data Sources:**
   - **Interactive Elements table** - clickable buttons, form inputs, links with selectors and text
   - **Page Content** - readable text showing what the page is about
   - **Network Requests** - API calls revealing backend functionality
   - **Console Logs** - runtime information about the page

   **Your Task:** Look at the data and identify test areas. Use \`helpmetest_partial_update_artifact\` to populate.

   **Example (e-commerce site):**
   \`\`\`javascript
   helpmetest_partial_update_artifact({
     id: "exploratory-https---shop-example-com",
     updates: {
       "availableAreas": {
         "authentication": [
           {
             "name": "User Login",
             "selector": "[data-testid='login-button']",
             "priority": 9,
             "testIdeas": ["Click login button", "Fill credentials", "Verify dashboard access"]
           }
         ],
         "checkout": [
           {
             "name": "Purchase Flow",
             "selector": "[data-testid='checkout-btn']",
             "priority": 8,
             "testIdeas": ["Add item to cart", "Proceed to checkout", "Fill payment info", "Complete purchase"]
           }
         ],
         "productBrowsing": [
           {
             "name": "Product Search",
             "selector": "input[type='search']",
             "priority": 5,
             "testIdeas": ["Search for product", "Verify results", "Test filters"]
           }
         ],
         "notes": [
           "Found login and signup buttons - auth is testable",
           "Checkout button visible - payment flow is available",
           "Search bar present - product discovery can be tested"
         ]
       }
     }
   })
   \`\`\`

   **Priority Scale:**
   - **9-10**: Authentication, Payment, Billing, Checkout
   - **5-7**: Core features, Search, Forms
   - **3-4**: Navigation, Links
   - **0-2**: Accessibility, SEO (skip these)

   **After populating:** Open artifact in browser using URL at bottom, then proceed to Step 1.

### Step 1-5: Propose Test
1. **Analyze** the page data below - what elements, forms, buttons exist?
2. **Check** what's already tested in artifact - avoid duplication
3. **Check** existing permanent tests - don't recreate what exists
4. **Propose** next test area with priority and reasoning (use availableAreas from artifact as guide)
5. **Wait** for user approval ("continue", "yes", "ok")

### Step 6: Execute Test Interactively

**CRITICAL: What Makes a REAL Test Case**

A test case is NOT just clicking buttons. A test case:
- **Has a clear user goal** - what is the user trying to accomplish?
- **Tests complete workflow** - not just navigation, but the ENTIRE user journey
- **Verifies the expected result** - did the user achieve their goal?
- **Has measurable success criteria** - how do you know it worked?

**Examples of FAKE vs REAL tests:**

❌ **FAKE TEST (Navigation Smoke):**
\`\`\`
Goal: Click login button
Steps:
1. Navigate to homepage
2. Click "Log In" button
3. Verify URL changed to /sign-in
Result: Button navigates somewhere
\`\`\`
**Why this is FAKE:** No user goal, no meaningful verification, no complete workflow

✅ **REAL TEST (User Login):**
\`\`\`
Goal: User successfully logs into their account with valid credentials
Steps:
1. Navigate to homepage
2. Click "Log In" button
3. Enter email: user@example.com
4. Enter password: ValidPass123
5. Click "Sign In" button
6. Verify user dashboard appears
7. Verify user name/email is displayed
8. Verify logout button is present
Result: User successfully authenticated and sees their account
\`\`\`
**Why this is REAL:** Clear user goal, complete workflow, meaningful verification of success

**CRITICAL RULES:**

1. **Define the user goal BEFORE starting**
   - What is the user trying to accomplish?
   - What should happen if everything works?
   - How will you know it succeeded?

2. **If you CANNOT complete the full workflow, ASK THE USER**
   - ❌ DON'T record partial flows as "tests"
   - ❌ DON'T pretend navigation is verification
   - ✅ DO ask: "I can test up to the OAuth page, but cannot proceed without credentials. Should I:
     a) Record this as 'Navigation to OAuth' (not a real test)
     b) Stop here and wait for credentials
     c) Document this limitation in notes"

3. **Test execution:**
   - Run each command one by one using \`helpmetest_run_interactive_command\`
   - Observe results after each step
   - **If command fails due to wrong keyword or syntax:** IMMEDIATELY use \`helpmetest_keywords\` to find correct syntax
   - **Every test goal MUST be verified** - if goal was "User logs in", you MUST verify dashboard/account visible
   - **Test without complete verification is NOT A TEST** - it's exploratory navigation at best
   - **If you hit a blocker (no credentials, external service, etc.):** STOP and ASK USER what to do

4. **When you encounter blockers:**
   - OAuth/external auth without real credentials
   - Payment forms requiring real card
   - Email verification requiring real inbox
   - SMS/2FA requiring real phone

   **STOP and ASK:** "I've reached [blocker]. I cannot complete the full user workflow without [what's needed]. Options:
   1. Provide test credentials/data
   2. Document this limitation and move to next test
   3. Record partial flow with clear note this is NOT a complete test"

### Step 7: Record Results (MANDATORY)
7. **Record** results to artifact using \`helpmetest_partial_update_artifact\`

   **IMPORTANT:** Always update artifact after completing interactive testing!

   **CRITICAL:** Record the ACTUAL commands that were executed interactively
   - Copy exact command syntax from interactive execution
   - Don't manually write commands - use what actually worked
   - Don't invent commands or make up syntax - record reality
   - If unsure about command syntax, use \`helpmetest_keywords\` to search for correct usage and examples

   **Example (Login Flow):**
   \`\`\`javascript
   helpmetest_partial_update_artifact({
     id: "${artifactId}",
     updates: {
       "testedUseCases.-1": "Login with valid credentials",
       "testResults.-1": {
         useCase: "Login with valid credentials",
         passed: true,
         timestamp: new Date().toISOString(),
         steps: [
           { step: "Navigate to login page", command: "Go To https://example.com/login", passed: true },
           { step: "Enter username", command: "Fill Text input#username  testuser", passed: true },
           { step: "Enter password", command: "Fill Text input#password  validpass123", passed: true },
           { step: "Click login button", command: "Click button[type='submit']", passed: true },
           { step: "Verify redirect to dashboard", command: "Get Url  ==  https://example.com/dashboard", passed: true }
         ]
       },
       "coverage": "low"  // or "medium", "high", "comprehensive"
     }
   })
   \`\`\`

   **If test found bugs:**
   \`\`\`javascript
   helpmetest_partial_update_artifact({
     id: "${artifactId}",
     updates: {
       "bugs.-1": {
         title: "Login fails with valid credentials",
         priority: 10,
         severity: "CRITICAL",
         description: "Login button click does not redirect to dashboard",
         impact: "Users cannot access the application",
         affects: "All users",
         location: "/login page",
         reproSteps: ["Navigate to /login", "Enter valid credentials", "Click login", "Observe: stays on login page"]
       }
     }
   })
   \`\`\`

### Step 7.5: Verify Recorded Commands (MANDATORY)
7.5. **Create and run temporary test** to verify recorded commands actually work

   **Why:** Artifact should only contain working, verified test flows

   **Process:**
   \`\`\`javascript
   // 1. Create temporary test with recorded commands
   helpmetest_create_test({
     name: "TEMP - Verify <UseCase>",
     description: "Temporary test to verify recorded commands",
     tags: ["temp", "verification"],
     content: "<commands-from-artifact>"
   })

   // 2. Run the test
   helpmetest_run_test({ identifier: "<test-id>" })

   // 3. If test passes: Delete temp test, recorded commands are good
   helpmetest_delete_test({ identifier: "<test-id>" })

   // 4. If test fails: Fix commands, update artifact, run again
   \`\`\`

   **If verification fails:**
   - Debug what's wrong (spacing, selectors, assertions)
   - Fix the commands
   - Update artifact with corrected commands
   - Run verification again until it passes

### Step 8: Create Permanent Test (OPTIONAL - ASK USER FIRST)
8. **Ask user:** "Should I save this as a permanent test?"

   **"Save As" Behavior:**
   - Recording to artifact = progress tracking (always happens)
   - Creating permanent test = reusable test for CI/CD (optional)

   **When to ask:**
   - After successful test execution
   - User might want multiple variations (e.g., "Login - Valid", "Login - Invalid", "Login - Empty Fields")

   **If user says YES:**
   \`\`\`javascript
   helpmetest_create_test({
     name: "Login - Valid Credentials",
     description: "Tests successful login with valid username and password",
     tags: ["feature:auth", "type:smoke", "priority:critical"],
     content: "Go To https://example.com/login\\nFill Text input#username  testuser\\n..."
   })
   \`\`\`

   **CRITICAL - After creating test:**
   \`\`\`javascript
   // Immediately run the test you just created to verify it works
   helpmetest_run_test({ identifier: "<test-id-from-create-response>" })
   \`\`\`

   **If test fails:**
   - Debug the issue (wrong selector, timing, etc.)
   - Fix using \`helpmetest_update_test\`
   - Run again to verify fix works
   - Repeat until test passes

   **If user says NO or doesn't respond:** Skip test creation, results already saved to artifact.

   **DO NOT create tests automatically!** Recording to artifact is mandatory, but test creation is optional.

### Step 9: Loop
9. **Loop** back to step 1 - propose next test area

---

## 🎯 Priority Guide

- **Priority 10**: Foundation (domain uptime, SSL certificates)
- **Priority 9**: Authentication (login, signup, registration)
- **Priority 8**: Payments/billing/checkout
- **Priority 7**: Core user workflows
- **Priority 5**: Navigation and interactions
- **Priority 3**: Usability features

---

## 🔍 What to Look For

- Missing uptime test? → Propose: "Test domain is reachable"
- Missing SSL test (HTTPS)? → Propose: "Validate SSL certificate"
- See login/signup forms? → Propose: "Test authentication flow"
- See payment/checkout? → Propose: "Test payment process"
- See interactive elements? → Propose: "Test [specific feature]"

---

## 📦 Artifact Information

**Artifact ID:** \`${artifactId}\`
**Purpose:** Tracks all exploratory testing results, bugs found, and coverage
**Updates:** Use \`helpmetest_partial_update_artifact\` after EVERY test execution`
}

/**
 * Update artifact with test results
 */
async function updateArtifactWithResults(artifactId, goal, results) {
  const { apiPut } = await import('../utils/api.js')

  const allPassed = results.every(r => r.passed)

  // Update using partial update API
  const updates = {
    'testResults.-1': {
      useCase: goal.name,
      passed: allPassed,
      timestamp: new Date().toISOString(),
      steps: results
    },
    'testedUseCases.-1': goal.name
  }

  // If test failed, record as bug
  if (!allPassed) {
    const failedStep = results.find(r => !r.passed)
    updates['bugs.-1'] = {
      title: `${goal.name} failed`,
      priority: goal.priority,
      severity: goal.priority >= 10 ? 'CRITICAL' : goal.priority >= 8 ? 'HIGH' : 'MEDIUM',
      description: `Test goal "${goal.name}" failed at step: ${failedStep.step}`,
      impact: `${goal.description}`,
      location: failedStep.command,
      reproSteps: results.map(r => `${r.passed ? '✅' : '❌'} ${r.step}: ${r.command}`)
    }
  }

  await apiPut(`/api/artifacts/${artifactId}/content`, updates)
}

/**
 * Handle explore tool call
 */
async function handleExplore(args) {
  const { url, session_state } = args

  debug(config, `Exploratory testing tool called for: ${url}`)

  try {
    const userInfo = await detectApiAndAuth()
    const sessionTimestamp = userInfo.interactiveTimestamp
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
    // Open browser automatically on first exploratory session
    openSessionInBrowser(userInfo.dashboardBaseUrl, sessionTimestamp)

    // Navigate to page and get all the data
    const goToResult = await runInteractiveCommand({
      test: 'interactive',
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

    // Fetch existing tests to avoid duplication
    const existingTests = await getExistingTests(url)
    debug(config, `Found ${existingTests.length} existing tests for this URL`)

    // AI will analyze page and populate artifact with test areas
    // This happens in Step 0 of the workflow (see instructions below)

    // REMOVED: Auto-execution of test goals
    // The tool should be generic - AI will analyze page data and decide what to test
    // No hardcoded "Domain Uptime" or "SSL Check" logic here

    // Format the page data as markdown for better readability
    const formattedPageData = formatResultAsMarkdown(goToResult)

    // Generate exploratory instructions
    const instructions = generateExploratoryInstructions(artifact, existingTests, url)

    const summary = generateTestingSummary(artifact, url)
    const stopStatus = shouldStopTesting(artifact)

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Exploratory Testing - Session Started

${instructions}

---

${summary}

---

## 📚 Existing Tests

${existingTests.length > 0 ?
  existingTests.map(t => `- **${t.name}** [${t.tags?.join(', ')}]`).join('\n') :
  'No existing tests found for this URL.'}

---

## 📋 Page Data

${formattedPageData}

---

## 📊 Artifact Status

**Coverage:** ${stopStatus.coverage}
**Tested Use Cases:** ${artifact.content.testedUseCases?.length || 0}
**Bugs Found:** ${artifact.content.bugs?.length || 0}

**Artifact Link:** [${userInfo.dashboardBaseUrl}/artifacts/${artifact.id}](${userInfo.dashboardBaseUrl}/artifacts/${artifact.id})

---

## ✅ Ready

Analyze the data above, propose the next test area, and wait for approval.`,
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
      title: 'Help Me Test: Exploratory Testing',
      description: `Systematic exploratory testing tool for web applications.

**Purpose:**
Analyze a URL, propose test areas based on priority, execute tests interactively, and track results in an artifact.

**Workflow:**
1. Analyzes page structure and existing tests
2. Proposes next test area based on priority (authentication > payment > core features)
3. Waits for user approval
4. Executes test interactively with step-by-step verification
5. Records results to artifact (test outcomes, bugs, coverage)
6. Repeats until adequate coverage achieved

**What This Tool Does:**
- Opens browser to interactive session for manual testing
- Navigates to URL and analyzes page elements
- Proposes test areas based on business risk
- Executes Robot Framework commands interactively
- Tracks test results, bugs, and coverage in artifact
- Verifies recorded commands work before saving

**What This Tool Does NOT Do:**
- Does not execute tests automatically
- Does not make assumptions about user workflows
- Does not record incomplete tests as "passing"
- Does not proceed past blockers without asking user

**Test Case Requirements:**
A valid test case must have:
1. Clear user goal (what the user is trying to accomplish)
2. Complete workflow (from start to finish)
3. Meaningful verification (did the goal succeed?)
4. Measurable success criteria (how you know it worked)

Navigation smoke tests ("click button, check URL") are NOT valid test cases.

**Priority System:**
- Priority 10: Authentication (signup, login, registration)
- Priority 9: Payment/billing/checkout flows
- Priority 7: Core user workflows
- Priority 5: Navigation and interactions
- Priority 3: Usability features
- Priority 0: Accessibility, SEO (skip)

**Blockers:**
When encountering blockers (OAuth without credentials, payment forms, email verification):
- STOP execution
- ASK user for credentials or guidance
- DO NOT record partial flows as complete tests
- Document limitation in artifact notes

**Artifact Structure:**
Tracks all exploratory testing in structured JSON:
- testedUseCases: List of completed test scenarios
- testResults: Detailed pass/fail results for each test
- bugs: Identified issues with priority and reproduction steps
- availableAreas: Test areas discovered on page (populated by AI analysis)
- notes: Observations and limitations
- coverage: Overall test coverage level (low/medium/high)`,
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
