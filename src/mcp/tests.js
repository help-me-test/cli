/**
 * Test MCP Tools
 * Provides test management and execution tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runTest, createTest, deleteTest, getAllTests, detectApiAndAuth } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'
import open from 'open'

/**
 * Naming conventions for tests and tags
 */
const NAMING_CONVENTIONS = `
**Test Names - Bad Examples:**
❌ "Fixed Login Test"
❌ "Updated Login Test"
❌ "New Login Test"
❌ "Login Test (Fixed)"
❌ "Login - Updated"
❌ "test_login_user"
❌ "LoginTestCase"

**Test Names - Good Examples:**
✅ "Login Flow"
✅ "User Registration"
✅ "Add Item to Cart"
✅ "Checkout Process"
✅ "Password Reset"
✅ "Search Products"

**Tag Convention:**
Tags MUST use format: {category}:{name}

**Allowed Tag Categories:**
- feature: Feature area (feature:login, feature:checkout, feature:search)
- type: Test type (type:smoke, type:regression, type:e2e, type:integration)
- priority: Test priority (priority:critical, priority:high, priority:medium, priority:low)
- status: Test status (status:flaky, status:wip, status:stable)
- platform: Platform specific (platform:web, platform:mobile, platform:api)
- browser: Browser specific (browser:chrome, browser:firefox, browser:safari)

**Tags - Bad Examples:**
❌ "new"
❌ "fixed"
❌ "updated"
❌ "test"
❌ "login" (missing category)
❌ "temp"
❌ "asdf"

**Tags - Good Examples:**
✅ "feature:login"
✅ "feature:checkout"
✅ "type:smoke"
✅ "type:regression"
✅ "priority:critical"
✅ "status:stable"
✅ "platform:web"
✅ "browser:chrome"
`

/**
 * Handle run test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.identifier - Test name, tag, or ID to run
 * @returns {Object} Test run result
 */
async function handleRunTest(args) {
  const { identifier } = args
  
  debug(config, `Running test with identifier: ${identifier}`)
  
  try {
    // Collect all events from the test run
    const events = []
    
    await runTest(identifier, (event) => {
      if (event) {
        events.push(event)
      }
    })
    
    // Process events to extract meaningful results
    const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)
    const keywordEvents = events.filter(e => e.type === 'keyword')
    
    // Build response with test execution data
    const response = {
      identifier,
      timestamp: new Date().toISOString(),
      totalEvents: events.length,
      testResults: testResults.map(result => ({
        testId: result.attrs?.name || 'unknown',
        status: result.attrs?.status || 'UNKNOWN',
        duration: result.attrs?.elapsed_time ? `${result.attrs.elapsed_time}s` : 'N/A',
        message: result.attrs?.doc || ''
      })),
      keywords: keywordEvents.map(kw => ({
        keyword: kw.keyword,
        status: kw.status,
        duration: kw.elapsed_time || kw.elapsedtime || null
      })),
      allEvents: events // Include all raw events for debugging
    }
    
    // Determine overall success
    const hasFailures = testResults.some(r => r.status === 'FAIL')
    response.success = !hasFailures && testResults.length > 0
    
    // Create user-friendly explanation
    const explanation = createTestRunExplanation(response, identifier)
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
        },
      ],
      isError: hasFailures,
    }
  } catch (error) {
    debug(config, `Error running test: ${error.message}`)
    
    const errorResponse = {
      error: true,
      identifier,
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
 * Create explanation for test run results
 * @param {Object} response - Test run response data
 * @param {string} identifier - Test identifier
 * @returns {string} Human-readable explanation
 */
function createTestRunExplanation(response, identifier) {
  const { success, testResults, keywords, totalEvents } = response
  
  let explanation = `🧪 Test Execution Results for "${identifier}"\n\n`
  
  if (testResults.length === 0) {
    explanation += `❌ No test results found. This could mean:\n`
    explanation += `• Test "${identifier}" doesn't exist\n`
    explanation += `• Test execution failed to start\n`
    explanation += `• Test identifier is incorrect\n\n`
    explanation += `Raw event data (${totalEvents} events):\n`
    explanation += `\`\`\`json\n${JSON.stringify(response, null, 2)}\`\`\`\n`
    return explanation
  }

  // Overall status
  if (success) {
    explanation += `✅ Test execution PASSED\n\n`
  } else {
    explanation += `❌ Test execution FAILED\n\n`
  }

  // Test results summary
  explanation += `📊 Test Results:\n`
  testResults.forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : '❌'
    explanation += `${index + 1}. ${statusIcon} ${result.testId} (${result.status}) - ${result.duration}\n`
    if (result.message) {
      explanation += `   📝 ${result.message}\n`
    }
  })

  // Keywords summary
  if (keywords.length > 0) {
    explanation += `\n🔧 Keywords Executed:\n`
    keywords.slice(0, 10).forEach((kw, index) => { // Limit to first 10 keywords
      const statusIcon = kw.status === 'PASS' ? '✅' : kw.status === 'FAIL' ? '❌' : '⏸️'
      const duration = kw.duration ? ` (${kw.duration}s)` : ''
      explanation += `${index + 1}. ${statusIcon} ${kw.keyword}${duration}\n`
    })
    if (keywords.length > 10) {
      explanation += `   ... and ${keywords.length - 10} more keywords\n`
    }
  }

  // Next steps
  explanation += `\n📋 Next Steps:\n`
  if (success) {
    explanation += `• Test completed successfully - no action needed\n`
    explanation += `• You can view the full test details in the browser using the 'helpmetest_open_test' command\n`
  } else {
    explanation += `• Review failed keywords above for debugging\n`
    explanation += `• Check test logs for detailed error messages\n`
    explanation += `• Consider using 'helpmetest_run_interactive_command' to debug step by step\n`
    explanation += `• You can view the full test details in the browser using the 'helpmetest_open_test' command\n`
  }

  explanation += `\n🔍 Raw Data (for debugging):\n`
  explanation += `\`\`\`json\n${JSON.stringify(response, null, 2)}\`\`\`\n`

  return explanation
}

/**
 * Handle test status tool call
 * @param {Object} args - Tool arguments
 * @param {boolean} [args.verbose] - Enable verbose output
 * @returns {Object} Test status result
 */
async function handleTestStatus(args) {
  const { verbose = false } = args
  
  debug(config, 'Getting test status for MCP client')
  
  try {
    const statusData = await getFormattedStatusData({ verbose })
    
    // Filter to only include tests
    const filteredData = {
      company: statusData.company,
      total: statusData.tests.length,
      tests: statusData.tests,
      timestamp: statusData.timestamp
    }
    
    debug(config, `Retrieved test status data: ${filteredData.total} tests`)
    
    return {
      content: [
        {
          type: 'text',
          text: `🧪 HelpMeTest Tests Status

Raw Test Data:
\`\`\`json
${JSON.stringify(filteredData, null, 2)}
\`\`\`

🚨 CRITICAL AI INSTRUCTION: 
1. CAREFULLY analyze the raw test data above
2. BE HONEST about test statuses - don't assume tests are passing
3. Look for actual status indicators like "PASS"/"FAIL" in the recent runs
4. Focus on what the data actually shows, not assumptions

### Analysis Requirements:
1. Count total tests accurately from the data
2. Check recent run status for each test if available
3. Identify any failing tests specifically by name/ID
4. Report any issues that need immediate attention
5. Provide honest assessment of test suite health

The raw data contains all the information you need - analyze it carefully and be honest about what you find.`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting test status: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null,
        verbose
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
 * Handle create test tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} Create test result
 */
async function handleCreateTest(args) {
  const { name, content, description, tags } = args
  
  debug(config, `Creating test with name: ${name}`)
  
  try {
    // Always use "new" as ID to force auto-generation for security
    const testPayload = {
      id: "new",
      name,
      ...(description && { description }),
      ...(tags && { tags }),
      content: content || ''
    }
    
    const result = await createTest(testPayload)
    debug(config, `Test creation result: ${JSON.stringify(result)}`)
    
    // Build success response
    const response = {
      success: true,
      test: result,
      timestamp: new Date().toISOString(),
      message: "Test created successfully",
      nextSteps: [
        "You can run this test using the 'helpmetest_run_test' command",
        "You can open this test in your browser using the 'helpmetest_open_test' command",
        "You can modify this test using the 'helpmetest_modify_test' command"
      ]
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Test Created Successfully

**Test Details:**
- Name: ${name}
        - ID: ${result.id || 'Auto-generated'}
${description ? `- Description: ${description}` : ''}
${tags ? `- Tags: ${tags.join(', ')}` : ''}

**Security Note:** Test ID is auto-generated for security purposes.

**Next Steps:**
1. Run the test: Use 'helpmetest_run_test' with identifier "${result.id || name}"
2. View in browser: Use 'helpmetest_open_test' with identifier "${result.id || name}"
3. Update if needed:
   - Fix test content: 'helpmetest_update_test'
   - Rename test: 'helpmetest_update_test_name'
   - Change tags: 'helpmetest_update_test_tags'

**Raw Response:**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error creating test: ${error.message}`)
    
    const errorResponse = {
      error: true,
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
          text: `❌ Test Creation Failed

**Error Details:**
${error.message}

**Debug Information:**
\`\`\`json
${JSON.stringify(errorResponse, null, 2)}
\`\`\`

**Troubleshooting:**
1. Check if the test name is unique
2. Verify your API connection and credentials
3. Ensure the test data contains valid Robot Framework keywords
4. Try using the 'helpmetest_run_interactive_command' to test your keywords first`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle delete test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.identifier - Test ID, name, or tag to delete
 * @returns {Object} Delete test result
 */
async function handleDeleteTest(args) {
  const { identifier } = args
  
  debug(config, `Deleting test with identifier: ${identifier}`)
  
  try {
    const result = await deleteTest(identifier)
    debug(config, `Test deletion result: ${JSON.stringify(result)}`)
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Test Deleted Successfully

**Deleted:** ${identifier}

**Note:** This operation can be undone using the 'helpmetest_undo_update' command if the deletion was made in error.

**Raw Response:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error deleting test: ${error.message}`)
    
    const errorResponse = {
      error: true,
      identifier,
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
 * Handle modify test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.id - Test ID to modify
 * @param {string} [args.name] - New test name
 * @param {string} [args.content] - New test content
 * @param {string} [args.description] - New description
 * @param {Array<string>} [args.tags] - New tags
 * @returns {Object} Modify test result
 */
async function handleModifyTest(args) {
  const { id, name, content, description, tags } = args

  debug(config, `Modifying test with ID: ${id}`)

  try {
    // Build the update payload - only include fields that are provided
    const updateData = { id }

    if (name !== undefined) updateData.name = name
    if (content !== undefined) updateData.content = content
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags

    const result = await createTest(updateData)
    debug(config, `Test modification result: ${JSON.stringify(result)}`)

    // Determine what was changed
    const changes = []
    if (name !== undefined) changes.push('name')
    if (content !== undefined) changes.push('content')
    if (description !== undefined) changes.push('description')
    if (tags !== undefined) changes.push('tags')

    return {
      content: [
        {
          type: 'text',
          text: `✅ Test Updated Successfully

**Changed:** ${changes.join(', ')}

**Test Details:**
- Name: ${result.name}
- ID: ${result.id}
${description ? `- Description: ${description}` : ''}
${tags ? `- Tags: ${tags.join(', ')}` : ''}

**Next Steps:**
1. Run the test to verify changes: Use 'helpmetest_run_test' with identifier "${result.id}"
2. View in browser: Use 'helpmetest_open_test' with identifier "${result.id}"

**Raw Response:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error modifying test: ${error.message}`)

    const errorResponse = {
      error: true,
      id,
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
 * Handle open test tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.id] - Test ID for direct access
 * @param {string} [args.name] - Test name for search
 * @param {string} [args.tag] - Test tag for search
 * @param {string} [args.runIdDate] - Optional test run date
 * @returns {Object} Open test result
 */
async function handleOpenTest(args) {
  const { id, runIdDate, name, tag, identifier, runId } = args
  
  debug(config, `Opening test in browser with args: ${JSON.stringify(args)}`)
  
  try {
    // Get cached user info with dashboard URL
    const userInfo = await detectApiAndAuth()
    const dashboardBaseUrl = userInfo.dashboardBaseUrl
    
    let url
    // Handle backwards compatibility with old 'identifier' parameter  
    const testId = id || identifier
    
    debug(config, `testId set to: ${testId}`)
    debug(config, `id: ${id}, identifier: ${identifier}`)
    
    // 1. If we have an ID (from id parameter or identifier for backwards compatibility), use it directly
    if (testId) {
      const runDate = runIdDate || runId // Support both new and old parameter names
      if (runDate) {
        // Open specific test run: id + runDate
        url = `${dashboardBaseUrl}/test/${testId}/${runDate}`
      } else {
        // Open test page: just id
        url = `${dashboardBaseUrl}/test/${testId}`
      }
    }
    // 2. If we have a name, search for it
    else if (name) {
      try {
        const tests = await getAllTests()
        const matchingTest = tests.find(test => test.name === name)
        
        if (matchingTest) {
          const foundId = matchingTest.id
          const runDate = runIdDate || runId
          if (runDate) {
            url = `${dashboardBaseUrl}/test/${foundId}/${runDate}`
          } else {
            url = `${dashboardBaseUrl}/test/${foundId}`
          }
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Test Not Found by Name

**Name searched:** "${name}"

**Available Tests:**
${tests.map(test => `
**ID:** \`${test.id}\`
**Name:** ${test.name}
**Tags:** ${test.tags?.join(', ') || 'none'}
`).join('\n')}

**Next Steps:** Use the exact test ID with 'helpmetest_open_test'`,
              },
            ],
            isError: true,
          }
        }
      } catch (error) {
        throw new Error(`Failed to search tests by name: ${error.message}`)
      }
    }
    // 3. If we have a tag, search for it
    else if (tag) {
      try {
        const tests = await getAllTests()
        const matchingTests = tests.filter(test => 
          test.tags && test.tags.some(t => t === tag)
        )
        
        if (matchingTests.length === 1) {
          const foundId = matchingTests[0].id
          const runDate = runIdDate || runId
          if (runDate) {
            url = `${dashboardBaseUrl}/test/${foundId}/${runDate}`
          } else {
            url = `${dashboardBaseUrl}/test/${foundId}`
          }
        } else if (matchingTests.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ No Tests Found with Tag

**Tag searched:** "${tag}"

**Available Tests with Tags:**
${tests.filter(t => t.tags?.length > 0).map(test => `
**ID:** \`${test.id}\`
**Name:** ${test.name}
**Tags:** ${test.tags.join(', ')}
`).join('\n')}

**Next Steps:** Use a different tag or the exact test ID`,
              },
            ],
            isError: true,
          }
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Multiple Tests Found with Tag

**Tag searched:** "${tag}"
**Found ${matchingTests.length} tests:**

${matchingTests.map(test => `
**ID:** \`${test.id}\`
**Name:** ${test.name}
**Tags:** ${test.tags.join(', ')}
`).join('\n')}

**Next Steps:** Use the exact test ID for the test you want to open`,
              },
            ],
            isError: true,
          }
        }
      } catch (error) {
        throw new Error(`Failed to search tests by tag: ${error.message}`)
      }
    }
    // 4. For backwards compatibility, try to parse identifier as name/tag if it's not a direct ID
    else if (identifier && !testId) {
      // First try as direct ID
      if (/^[a-z0-9]{18}$/.test(identifier)) {
        const foundId = identifier
        const runDate = runIdDate || runId
        if (runDate) {
          url = `${dashboardBaseUrl}/test/${foundId}/${runDate}`
        } else {
          url = `${dashboardBaseUrl}/test/${foundId}`
        }
      }
      // Try as tag if it starts with "tag:"
      else if (identifier.startsWith('tag:')) {
        const tagValue = identifier.substring(4)
        try {
          const tests = await getAllTests()
          const matchingTests = tests.filter(test => 
            test.tags && test.tags.some(t => t === tagValue)
          )
          
          if (matchingTests.length === 1) {
            const foundId = matchingTests[0].id
            const runDate = runIdDate || runId
            if (runDate) {
              url = `${dashboardBaseUrl}/test/${foundId}/${runDate}`
            } else {
              url = `${dashboardBaseUrl}/test/${foundId}`
            }
          } else {
            throw new Error(`Found ${matchingTests.length} tests with tag "${tagValue}"`)
          }
        } catch (error) {
          throw new Error(`Failed to search by tag: ${error.message}`)
        }
      }
      // Try as name
      else {
        try {
          const tests = await getAllTests()
          const matchingTest = tests.find(test => test.name === identifier)
          
          if (matchingTest) {
            const foundId = matchingTest.id
            const runDate = runIdDate || runId
            if (runDate) {
              url = `${dashboardBaseUrl}/test/${foundId}/${runDate}`
            } else {
              url = `${dashboardBaseUrl}/test/${foundId}`
            }
          } else {
            throw new Error(`No test found with name "${identifier}"`)
          }
        } catch (error) {
          throw new Error(`Failed to search by name: ${error.message}`)
        }
      }
    }
    // 4. No parameters provided
    else {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Missing Required Parameter

**Usage:** Provide one of these parameters:
- **id**: Test ID (e.g., "nrwm2kgy66ar2nt0camren")
- **name**: Test name (e.g., "Login Flow")  
- **tag**: Test tag (e.g., "feature:login")

**Optional:**
- **runIdDate**: Specific run date (e.g., "2025-11-04T11:54:05.000Z")

**Examples:**
- Open test: \`id="nrwm2kgy66ar2nt0camren"\`
- Open test run: \`id="nrwm2kgy66ar2nt0camren"\`, \`runIdDate="2025-11-04T11:54:05.000Z"\`
- Search by name: \`name="Login Flow"\`
- Search by tag: \`tag="feature:login"\``,
          },
        ],
        isError: true,
      }
    }
    
    // Open the URL in the default browser
    await open(url)
    
    const response = {
      success: true,
      testId: id || identifier,
      runIdDate: runIdDate || runId || null,
      url,
      timestamp: new Date().toISOString(),
      message: "Test opened in browser successfully"
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `🌐 Test Opened in Browser

**Test ID:** ${id || identifier}
${runIdDate ? `**Run Date:** ${runIdDate}` : ''}
**URL:** ${url}

The test page should now be open in your default browser where you can:
- View test details and execution history
- Run the test manually
- Edit test configuration
- Download test reports

**Raw Response:**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\``,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error opening test: ${error.message}`)
    
    const errorResponse = {
      error: true,
      testId: id || identifier || name || tag,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiBaseUrl: config.apiBaseUrl,
        runIdDate: runIdDate || runId || null
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
 * Register test-related MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerTestTools(server) {
  // Register run_test tool
  server.registerTool(
    'helpmetest_run_test',
    {
      title: 'Help Me Test: Run Test Tool',
      description: `Run a test by name, tag, or ID. After execution, provides a detailed explanation of what happened, including test results, keyword execution status, and next steps for debugging if needed.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user which test you're running and why. After getting results, describe what happened during the test execution - whether it passed or failed, what steps were executed, and what the results mean. Don't just say "Done".`,
      inputSchema: {
        identifier: z.string().describe('Test name, tag (tag:tagname), or ID to run'),
      },
    },
    async (args) => {
      debug(config, `Run test tool called with args: ${JSON.stringify(args)}`)
      return await handleRunTest(args)
    }
  )

  // Register status_test tool
  server.registerTool(
    'helpmetest_status_test',
    {
      title: 'Help Me Test: Test Status Tool',
      description: `Get status of all tests in the helpmetest system. When verbose=true, includes full test content and descriptions.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user what you're checking. After getting results, summarize the test statuses in plain language - tell them how many tests passed/failed, which ones need attention, etc. Don't just say "Done".`,
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with full test content, descriptions, and execution details'),
      },
    },
    async (args) => {
      debug(config, `Test status tool called with args: ${JSON.stringify(args)}`)
      return await handleTestStatus(args)
    }
  )

  // Register create_test tool
  server.registerTool(
    'helpmetest_create_test',
    {
      title: 'Help Me Test: Create Test Tool',
      description: `Create a new test with Robot Framework keywords.

🚨 **STOP: DO NOT USE THIS TOOL WITHOUT INTERACTIVE TESTING FIRST**

⛔ **MANDATORY REQUIREMENT: Interactive Development First**

You MUST use interactive development before creating tests. This is not optional.

**Why Interactive Development is MANDATORY:**
- **Element Discovery**: Find correct selectors that actually work on the page
- **Timing Issues**: Identify when waits are needed for dynamic content
- **Error Prevention**: Catch issues before they become failing tests
- **Faster Debugging**: Get immediate feedback on each step
- **Avoid Wasted Time**: Don't create tests that immediately fail

**MANDATORY Workflow - DO NOT SKIP:**
1. \`helpmetest_status_test\` - Check existing tests for patterns
2. \`helpmetest_keywords search="relevant_topic"\` - Find the right Robot Framework commands
3. \`helpmetest_run_interactive_command\` - Test EVERY step interactively:
   - Start with navigation: \`Go To https://example.com\`
   - Test interactions: \`Click button\`, \`Fill Text input value\`
   - Verify results: \`Get Text h1\`, \`Should Contain text\`
   - Build up your complete flow step by step
   - VERIFY each step works before moving to next
   - Continue testing until you have a COMPLETE WORKING sequence
4. \`helpmetest_create_test\` - Create the test with your PROVEN sequence

**Direct Usage (NOT RECOMMENDED):**
You can create tests directly if you're confident in the Robot Framework syntax and element selectors, but this often leads to failing tests that need debugging anyway.

Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched).

**Security Note:** Test IDs are automatically generated and cannot be manually specified to prevent security issues and ensure data integrity.

🚨 CRITICAL INSTRUCTION FOR AI:
1. ALWAYS explain what test you're creating and why
2. If the test fails after creation, DO NOT celebrate - acknowledge the failure
3. Be honest about test results - failing tests are problems, not successes
4. Guide the user through debugging if the test fails
5. Don't just say "Done" - analyze the actual results
6. To update an existing test, use:
   - helpmetest_update_test (fix content)
   - helpmetest_update_test_name (rename)
   - helpmetest_update_test_tags (change tags)

${NAMING_CONVENTIONS}`,
      inputSchema: {
        name: z.string().describe('Test name (required)'),
        content: z.string().optional().describe('Robot Framework keywords only (no test case structure needed - just the keywords to execute)'),
        description: z.string().optional().describe('Test description (optional)'),
        tags: z.array(z.string()).optional().describe('Test tags as array of strings (optional)'),
      },
    },
    async (args) => {
      debug(config, `Create test tool called with args: ${JSON.stringify(args)}`)
      return await handleCreateTest(args)
    }
  )

  // Register delete_test tool
  server.registerTool(
    'helpmetest_delete_test',
    {
      title: 'Help Me Test: Delete Test Tool',
      description: `Delete a test by ID, name, or tag. This operation can be undone using the undo_update tool if the update is revertable.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user which test you're deleting and why. After deletion, confirm what was deleted and mention that it can be undone if needed. Don't just say "Done".`,
      inputSchema: {
        identifier: z.string().describe('Test ID, name, or tag (with tag: prefix) to delete'),
      },
    },
    async (args) => {
      debug(config, `Delete test tool called with args: ${JSON.stringify(args)}`)
      return await handleDeleteTest(args)
    }
  )

  // Register update_test tool (content only)
  server.registerTool(
    'helpmetest_update_test',
    {
      title: 'Help Me Test: Update Test Content',
      description: `Update test content (Robot Framework keywords). Use this when fixing test logic or steps.

🚨 INSTRUCTION FOR AI: This tool ONLY updates test content. It does NOT change name, tags, or description. Use this when user asks to "fix the test" or modify test steps.`,
      inputSchema: {
        id: z.string().describe('Test ID (required)'),
        content: z.string().describe('New test content - Robot Framework keywords (required)'),
      },
    },
    async (args) => {
      debug(config, `Update test content tool called with args: ${JSON.stringify(args)}`)
      return await handleModifyTest(args)
    }
  )

  // Register update_test_name tool
  server.registerTool(
    'helpmetest_update_test_name',
    {
      title: 'Help Me Test: Update Test Name',
      description: `Update test name only. Use this ONLY when user explicitly asks to rename a test.

${NAMING_CONVENTIONS}`,
      inputSchema: {
        id: z.string().describe('Test ID (required)'),
        name: z.string().describe('New test name (required)'),
      },
    },
    async (args) => {
      debug(config, `Update test name tool called with args: ${JSON.stringify(args)}`)
      return await handleModifyTest(args)
    }
  )

  // Register update_test_tags tool
  server.registerTool(
    'helpmetest_update_test_tags',
    {
      title: 'Help Me Test: Update Test Tags',
      description: `Update test tags only. Use this when user asks to add, remove, or change test tags.

${NAMING_CONVENTIONS}`,
      inputSchema: {
        id: z.string().describe('Test ID (required)'),
        tags: z.array(z.string()).describe('New test tags - must follow category:name format (required)'),
      },
    },
    async (args) => {
      debug(config, `Update test tags tool called with args: ${JSON.stringify(args)}`)
      return await handleModifyTest(args)
    }
  )

  // Register open_test tool
  server.registerTool(
    'helpmetest_open_test',
    {
      title: 'Help Me Test: Open Test Tool',
      description: `Open a test in the browser using explicit parameters. Provide exactly one of: id, name, or tag.

**Usage Examples:**
- Open test by ID: \`id="nrwm2kgy66ar2nt0camren"\`
- Open test run: \`id="nrwm2kgy66ar2nt0camren"\`, \`runIdDate="2025-11-04T11:54:05.000Z"\`
- Search by name: \`name="Login Flow"\`
- Search by tag: \`tag="feature:login"\`

🚨 INSTRUCTION FOR AI: Use explicit parameters (id, name, or tag) - never guess what type of identifier you have. If you get multiple results, pick the specific ID you want.`,
      inputSchema: {
        id: z.string().optional().describe('Test ID (e.g., "nrwm2kgy66ar2nt0camren") - use this for direct test access'),
        name: z.string().optional().describe('Test name (e.g., "Login Flow") - will search for exact name match'),
        tag: z.string().optional().describe('Test tag (e.g., "feature:login") - will search for tests with this tag'),
        runIdDate: z.string().optional().describe('Test run date (e.g., "2025-11-04T11:54:05.000Z") - use with id to open specific run'),
      },
    },
    async (args) => {
      debug(config, `Open test tool called with args: ${JSON.stringify(args)}`)
      return await handleOpenTest(args)
    }
  )
}