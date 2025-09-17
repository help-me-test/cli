/**
 * Test MCP Tools
 * Provides test management and execution tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { getAllTests, runTest, createTest, deleteTest } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'
import open from 'open'

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
  const { name, testData, description, tags, id } = args
  
  debug(config, `Creating test with name: ${name}`)
  
  try {
    const testPayload = {
      ...(id && { id }),
      name,
      ...(description && { description }),
      ...(tags && { tags }),
      testData: testData || ''
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

**Next Steps:**
1. Run the test: Use 'helpmetest_run_test' with identifier "${result.id || name}"
2. View in browser: Use 'helpmetest_open_test' with identifier "${result.id || name}"
3. Modify if needed: Use 'helpmetest_modify_test' with test ID "${result.id}"

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
 * Handle open test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.identifier - Test ID, name, or tag to open
 * @param {string} [args.runId] - Optional specific run ID
 * @returns {Object} Open test result
 */
async function handleOpenTest(args) {
  const { identifier, runId } = args
  
  debug(config, `Opening test in browser: ${identifier}${runId ? ` (run: ${runId})` : ''}`)
  
  try {
    // Construct the URL based on whether we have a runId or not
    let url
    if (runId) {
      url = `${config.uiBaseUrl}/test-runs/${runId}`
    } else {
      // For test identifier, we need to resolve it to get the actual test page
      // This is a simplified approach - might need adjustment based on your UI routing
      url = `${config.uiBaseUrl}/tests?search=${encodeURIComponent(identifier)}`
    }
    
    // Open the URL in the default browser
    await open(url)
    
    const response = {
      success: true,
      identifier,
      runId: runId || null,
      url,
      timestamp: new Date().toISOString(),
      message: "Test opened in browser successfully"
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `🌐 Test Opened in Browser

**Identifier:** ${identifier}
${runId ? `**Run ID:** ${runId}` : ''}
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
      identifier,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        uiBaseUrl: config.uiBaseUrl,
        runId: runId || null
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
   - Use \`Exit\` when you have a COMPLETE WORKING sequence
4. \`helpmetest_create_test\` - Create the test with your PROVEN sequence

**Direct Usage (NOT RECOMMENDED):**
You can create tests directly if you're confident in the Robot Framework syntax and element selectors, but this often leads to failing tests that need debugging anyway.

Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched).

🚨 CRITICAL INSTRUCTION FOR AI: 
1. ALWAYS explain what test you're creating and why
2. If the test fails after creation, DO NOT celebrate - acknowledge the failure
3. Be honest about test results - failing tests are problems, not successes
4. Guide the user through debugging if the test fails
5. Don't just say "Done" - analyze the actual results`,
      inputSchema: {
        name: z.string().describe('Test name (required)'),
        testData: z.string().optional().describe('Robot Framework keywords only (no test case structure needed - just the keywords to execute)'),
        description: z.string().optional().describe('Test description (optional)'),
        tags: z.array(z.string()).optional().describe('Test tags as array of strings (optional)'),
        id: z.string().optional().describe('Test ID (optional - will auto-generate if not provided)'),
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

  // Register open_test tool
  server.registerTool(
    'helpmetest_open_test',
    {
      title: 'Help Me Test: Open Test Tool',
      description: `Open a test in the browser by test ID, name, or tag. This tool opens the test page where you can view test details, execution history, and run the test manually.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user which test you're opening and why. After opening, confirm that the browser was opened successfully or report any errors. Don't just say "Done".`,
      inputSchema: {
        identifier: z.string().describe('Test ID, name, or tag (with tag: prefix) to open in browser'),
        runId: z.string().optional().describe('Optional specific run ID to open (if you want to view a specific test execution)'),
      },
    },
    async (args) => {
      debug(config, `Open test tool called with args: ${JSON.stringify(args)}`)
      return await handleOpenTest(args)
    }
  )
}