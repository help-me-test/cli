/**
 * Test MCP Tools
 * Provides test management and execution tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { runTestMarkdown, createTest, deleteTest, getAllTests, detectApiAndAuth } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'
import open from 'open'

/**
 * Tag system configuration - SINGLE SOURCE OF TRUTH
 */
const TAG_SYSTEM = {
  feature: {
    description: 'Feature area',
    examples: ['feature:login', 'feature:auth', 'feature:checkout'],
    required: false
  },
  type: {
    description: 'Test type',
    examples: ['type:smoke', 'type:e2e', 'type:integration', 'type:regression', 'type:experiment'],
    required: true
  },
  priority: {
    description: 'Priority level',
    examples: ['priority:critical', 'priority:high', 'priority:medium', 'priority:low'],
    required: true
  },
  status: {
    description: 'Test stability',
    examples: ['status:stable', 'status:flaky', 'status:wip'],
    required: false
  },
  platform: {
    description: 'Platform target',
    examples: ['platform:web', 'platform:mobile', 'platform:api'],
    required: false
  },
  browser: {
    description: 'Browser specific',
    examples: ['browser:chrome', 'browser:firefox', 'browser:safari'],
    required: false
  },
  component: {
    description: 'System component',
    examples: ['component:robot', 'component:database', 'component:api', 'component:app'],
    required: false
  },
  role: {
    description: 'User role',
    examples: ['role:admin', 'role:user', 'role:guest'],
    required: false
  },
  url: {
    description: 'URL/domain',
    examples: ['url:example.com', 'url:staging.example.com'],
    required: false
  }
}

const ALLOWED_TAG_CATEGORIES = Object.keys(TAG_SYSTEM)
const REQUIRED_TAG_CATEGORIES = Object.keys(TAG_SYSTEM).filter(cat => TAG_SYSTEM[cat].required)

/**
 * Validate tag format
 * @param {string} tag - Tag to validate
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateTag(tag) {
  if (!tag || typeof tag !== 'string') {
    return { valid: false, error: 'Tag must be a non-empty string' }
  }

  // Check format: category:name
  if (!tag.includes(':')) {
    return {
      valid: false,
      error: `Tag "${tag}" must use format category:name (e.g., "feature:login")`
    }
  }

  const [category, ...nameParts] = tag.split(':')
  const name = nameParts.join(':') // Allow colons in name part

  if (!category || !name) {
    return {
      valid: false,
      error: `Tag "${tag}" must have both category and name (format: category:name)`
    }
  }

  if (!ALLOWED_TAG_CATEGORIES.includes(category)) {
    return {
      valid: false,
      error: `Tag category "${category}" is not allowed. Must be one of: ${ALLOWED_TAG_CATEGORIES.join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * Validate array of tags
 * @param {string[]} tags - Tags to validate
 * @returns {Object} Validation result { valid: boolean, errors?: string[] }
 */
function validateTags(tags) {
  const errors = []

  // Tags are REQUIRED
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return {
      valid: false,
      errors: ['Tags are REQUIRED. Every test must have at least type: and priority: tags']
    }
  }

  // Validate format of each tag
  for (const tag of tags) {
    const result = validateTag(tag)
    if (!result.valid) {
      errors.push(result.error)
    }
  }

  // Check for required categories
  const tagCategories = tags.map(tag => tag.split(':')[0])
  for (const requiredCategory of REQUIRED_TAG_CATEGORIES) {
    if (!tagCategories.includes(requiredCategory)) {
      errors.push(`Missing required tag category: ${requiredCategory}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true }
}

/**
 * Generate tag documentation from TAG_SYSTEM
 */
function generateTagDocumentation() {
  const categoriesDoc = Object.entries(TAG_SYSTEM)
    .map(([category, config]) => {
      const requiredLabel = config.required ? ' **[REQUIRED]**' : ''
      const examples = config.examples.slice(0, 3).join(', ')
      return `- ${category}:${requiredLabel} ${config.description} (${examples})`
    })
    .join('\n')

  const goodExamples = Object.values(TAG_SYSTEM)
    .flatMap(config => config.examples.slice(0, 1))
    .map(ex => `✅ "${ex}"`)
    .join('\n')

  const requiredDocs = REQUIRED_TAG_CATEGORIES.length > 0
    ? `\n**IMPORTANT: Every test MUST have at least:**\n${REQUIRED_TAG_CATEGORIES.map(cat => `- One ${cat}: tag (${TAG_SYSTEM[cat].examples[0]})`).join('\n')}\n`
    : ''

  return `**Tag Convention:**
Tags MUST use format: {category}:{name}

**Allowed Tag Categories:**
${categoriesDoc}
${requiredDocs}
**Tags - Bad Examples:**
❌ "new"
❌ "fixed"
❌ "updated"
❌ "test"
❌ "login" (missing category)
❌ "temp"
❌ "asdf"

**Tags - Good Examples:**
${goodExamples}`
}

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

${generateTagDocumentation()}
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
    const markdownOutput = await runTestMarkdown(identifier)

    // Check if output indicates failure
    const hasFailures = markdownOutput.includes('❌') || markdownOutput.includes('FAIL')

    return {
      content: [
        {
          type: 'text',
          text: markdownOutput,
        },
      ],
      isError: hasFailures,
    }
  } catch (error) {
    debug(config, `Error running test: ${error.message}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ Test Execution Failed

**Identifier:** ${identifier}
**Error:** ${error.message}

**Troubleshooting:**
1. Verify the test exists using \`helpmetest_status_test\`
2. Check your API connection and credentials
3. Try running a different test to isolate the issue`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Format tests as markdown table
 * @param {Array} tests - Array of test objects
 * @param {Object} options - Formatting options
 * @returns {string} Formatted markdown table
 */
export function formatTestsAsTable(tests, options = {}) {
  const { includeHeader = true } = options

  const passedTests = tests.filter(t => t.status === 'PASS')
  const failedTests = tests.filter(t => t.status === 'FAIL')
  const otherTests = tests.filter(t => t.status !== 'PASS' && t.status !== 'FAIL')

  let output = ''

  if (includeHeader) {
    output = `## 🧪 Tests: ${passedTests.length}✅ ${failedTests.length}❌ ${otherTests.length}⚠️ (${tests.length} total)

`
  }

  output += `| Status | Test Name | ID | Duration | Tags |
|--------|-----------|-----|----------|------|
`

  // Failed tests first (most important)
  for (const test of failedTests) {
    const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : '-'
    const duration = test.duration || '-'
    const id = test.id ? `\`${test.id}\`` : '-'
    output += `| ❌ | ${test.name} | ${id} | ${duration} | ${tags} |\n`
  }

  // Passing tests
  for (const test of passedTests) {
    const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : '-'
    const duration = test.duration || '-'
    const id = test.id ? `\`${test.id}\`` : '-'
    output += `| ✅ | ${test.name} | ${id} | ${duration} | ${tags} |\n`
  }

  // Other tests
  for (const test of otherTests) {
    const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : '-'
    const duration = test.duration || '-'
    const id = test.id ? `\`${test.id}\`` : '-'
    output += `| ⚠️ | ${test.name} | ${id} | ${duration} | ${tags} |\n`
  }

  return output
}

/**
 * Handle test status tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.id] - Optional test ID to show full details for specific test
 * @param {boolean} [args.verbose] - Enable verbose output
 * @returns {Object} Test status result
 */
async function handleTestStatus(args) {
  const { id, verbose = false } = args

  debug(config, `Getting test status for MCP client${id ? ` (id: ${id})` : ''}`)

  try {
    // Always fetch with verbose=true to get content/description
    const statusData = await getFormattedStatusData({ verbose: true })

    // Filter to only include tests
    const filteredData = {
      company: statusData.company,
      total: statusData.tests.length,
      tests: statusData.tests,
      timestamp: statusData.timestamp
    }

    debug(config, `Retrieved test status data: ${filteredData.total} tests`)

    // If ID provided, show full details for that specific test
    if (id) {
      const test = filteredData.tests.find(t => t.id === id)

      if (!test) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Test Not Found

**ID:** ${id}

**Available Tests:**
${filteredData.tests.map(t => `- \`${t.id}\` - ${t.name}`).join('\n')}`,
            },
          ],
          isError: true,
        }
      }

      // Format full test details
      const statusEmoji = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️'
      const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : 'none'

      const output = `# ${statusEmoji} Test Details

**Name:** ${test.name}
**ID:** \`${test.id}\`
**Status:** ${test.status || 'unknown'}
**Last Run:** ${test.last_run || 'never'}
**Duration:** ${test.duration || 'N/A'}
**Tags:** ${tags}
${test.description ? `**Description:** ${test.description}` : ''}

## Test Content

\`\`\`robotframework
${test.content || 'No content'}
\`\`\`

## Actions

- **Run:** Use \`helpmetest_run_test\` with identifier "${id}"
- **Open:** Use \`helpmetest_open_test\` with id "${id}"
- **Update:** Use \`helpmetest_upsert_test\` with id "${id}" and fields to update (name/content/description/tags)`

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      }
    }

    // No ID provided - show table of all tests
    const output = `# 🧪 Test Status Report

${formatTestsAsTable(filteredData.tests, { includeHeader: false })}
💡 Focus on ❌ failed tests - they need immediate attention

**Tip:** Use \`id="test_id"\` parameter to see full test details including content and description`

    return {
      content: [
        {
          type: 'text',
          text: output,
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
        verbose,
        id
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ **Error Getting Test Status**

**Message:** ${error.message}
**Type:** ${error.name || 'Error'}

**Debug Information:**
\`\`\`json
${JSON.stringify(errorResponse.debug, null, 2)}
\`\`\``,
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
 * Handle upsert test tool call (create or update)
 * @param {Object} args - Tool arguments
 * @param {string} [args.id] - Test ID (required for update, omit for create)
 * @param {string} [args.name] - Test name (required for create, optional for update)
 * @param {string} [args.content] - Test content
 * @param {string} [args.description] - Test description
 * @param {Array<string>} [args.tags] - Test tags
 * @param {boolean} [args.run=true] - Run the test after successful upsert
 * @returns {Object} Upsert test result
 */
async function handleUpsertTest(args) {
  const { id, name, content, description, tags, run = true } = args

  const isCreate = !id

  debug(config, `${isCreate ? 'Creating' : 'Updating'} test with args: ${JSON.stringify(args)}`)

  // Validate tags if provided
  if (tags !== undefined) {
    const tagValidation = validateTags(tags)
    if (!tagValidation.valid) {
      return {
        content: [{
          type: 'text',
          text: `❌ Tag Validation Failed\n\n${tagValidation.errors.join('\n')}\n\nPlease fix the tags and try again.`
        }],
        isError: true
      }
    }
  }

  try {
    // Build payload - only include provided fields
    // Use "new" as id for creates (backend convention)
    const testPayload = {
      id: id || "new",
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      ...(description !== undefined && { description }),
      ...(tags !== undefined && { tags }),
    }

    const result = await createTest(testPayload)
    debug(config, `Test ${isCreate ? 'creation' : 'update'} result: ${JSON.stringify(result)}`)

    const action = isCreate ? 'Created' : 'Updated'
    const changes = []
    if (name !== undefined) changes.push('name')
    if (content !== undefined) changes.push('content')
    if (description !== undefined) changes.push('description')
    if (tags !== undefined) changes.push('tags')

    let responseText = `✅ Test ${action} Successfully

**Test Details:**
- Name: ${result.name}
- ID: ${result.id}
${description !== undefined ? `- Description: ${description}` : ''}
${tags !== undefined ? `- Tags: ${tags.join(', ')}` : ''}
${isCreate ? '' : `\n**Changed:** ${changes.join(', ')}`}`

    // Run the test if run=true
    if (run) {
      debug(config, `Running test after upsert: ${result.id}`)
      const runResult = await handleRunTest({ identifier: result.id })

      // Append test run results
      responseText += `\n\n---\n\n## 🧪 Test Run Results\n\n${runResult.content[0].text}`

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
        isError: runResult.isError,
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText + `\n\n**Next Steps:**
1. View in browser: Use 'helpmetest_open_test' with identifier "${result.id}"
2. Run manually: Use 'helpmetest_run_test' with identifier "${result.id}"`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error ${isCreate ? 'creating' : 'updating'} test: ${error.message}`)

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
      description: `Get status of all tests in the helpmetest system, or show full details for a specific test.

**Two Modes:**

1. **List Mode** (no id parameter): Shows table of all tests with status, duration, tags
2. **Detail Mode** (with id parameter): Shows FULL test details including:
   - Test name, ID, status, last run, duration, tags, description
   - Complete Robot Framework test content
   - Available actions (run, open, update, etc.)

**Use Detail Mode to:**
- View test content without executing
- Check test description
- See what Robot Framework keywords a test uses
- Verify test configuration before running

🚨 INSTRUCTION FOR AI:
- Use **Detail Mode** (\`id="test_id"\`) when you need to see test content/description without running it
- Use **List Mode** (no id) to get overview of all tests
- Always explain what you're checking and summarize results in plain language`,
      inputSchema: {
        id: z.string().optional().describe('Optional test ID to show full details for specific test (including content and description)'),
        verbose: z.boolean().optional().default(false).describe('Deprecated - content is always included when id is provided'),
      },
    },
    async (args) => {
      debug(config, `Test status tool called with args: ${JSON.stringify(args)}`)
      return await handleTestStatus(args)
    }
  )

  // Register upsert_test tool (replaces create/update/update_name/update_tags)
  server.registerTool(
    'helpmetest_upsert_test',
    {
      title: 'Help Me Test: Upsert Test',
      description: `Create or update a test. All fields except 'name' are optional. When updating, only provided fields are modified.

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
4. \`helpmetest_upsert_test\` - Create the test with your PROVEN sequence

**Usage:**
- **Create new test:** Omit 'id' (or use id="new"). Provide 'name' (required) and optional content/description/tags. Backend will auto-generate ID.
- **Update existing test:** Provide 'id' (required), 'name' (required), and any fields to update (content/description/tags).

**Backend Convention:** When id is omitted or set to "new", the backend creates a new test with an auto-generated ID.

**Security Note:** When creating tests, IDs are automatically generated and cannot be manually specified.

🚨 CRITICAL INSTRUCTION FOR AI:
1. ALWAYS explain what you're creating/updating and why
2. If the test fails after creation, DO NOT celebrate - acknowledge the failure
3. Be honest about test results - failing tests are problems, not successes
4. Guide the user through debugging if the test fails
5. Don't just say "Done" - analyze the actual results

${NAMING_CONVENTIONS}`,
      inputSchema: {
        id: z.string().optional().describe('Test ID for updates (omit or use "new" to create new test with auto-generated ID)'),
        name: z.string().describe('Test name (required)'),
        content: z.string().optional().describe('Robot Framework keywords only (no test case structure needed - just the keywords to execute)'),
        description: z.string().optional().describe('Test description'),
        tags: z.array(z.string()).optional().describe('Test tags as array of strings'),
        run: z.boolean().optional().default(true).describe('Run the test after successful upsert (default: true)'),
      },
    },
    async (args) => {
      debug(config, `Upsert test tool called with args: ${JSON.stringify(args)}`)
      return await handleUpsertTest(args)
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