import { runTest, getAllTests, displayApiError } from '../utils/api.js'
import { output, colors } from '../utils/colors.js'
import { config, debug } from '../utils/config.js'
import Table from 'cli-table3'

// Track active progress lines for in-place updates
const activeProgressLines = new Map()

// Track test execution data for table display
const testExecutionData = new Map()

// Track dynamic table state
let dynamicTableActive = false
let tableStartLine = 0
let lastTableHeight = 0
let updateTimer = null

/**
 * Create a clean table without borders and minimal padding
 * @param {Array} headers - Table headers
 * @param {Array} rows - Table rows (array of arrays)
 * @returns {string} Formatted table string
 */
function createCleanTable(headers, rows) {
  const table = new Table({
    head: headers,
    style: {
      head: ['cyan'],
      border: [],
      'padding-left': 0,
      'padding-right': 1
    },
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': ' '
    }
  })
  
  rows.forEach(row => table.push(row))
  return table.toString()
}

/**
 * Clear lines from current cursor position upward
 * @param {number} lines - Number of lines to clear
 */
function clearLines(lines) {
  for (let i = 0; i < lines; i++) {
    process.stdout.write('\x1b[1A\x1b[2K') // Move up and clear line
  }
}

/**
 * Initialize dynamic table for real-time updates
 * @param {Array} testIds - Array of test IDs that will be executed
 * @param {Map} testNames - Map of test IDs to test names
 */
function initializeDynamicTable(testIds, testNames) {
  if (testIds.length <= 1) {
    return // Don't use dynamic table for single tests
  }
  
  dynamicTableActive = true
  
  // Clear any existing data
  testExecutionData.clear()
  
  // Initialize test execution data
  testIds.forEach(testId => {
    testExecutionData.set(testId, {
      name: testNames.get(testId) || testId,
      status: 'PENDING',
      duration: '0.0s',
      currentStep: 'Waiting...',
      startTime: null
    })
  })
  
  console.log(colors.subtitle('Test Execution Progress'))
  console.log()
  
  // Draw initial table
  updateDynamicTable()
  
  // Start a simple timer to update durations for running tests
  updateTimer = setInterval(() => {
    if (dynamicTableActive) {
      updateDynamicTable()
    }
  }, 200) // Update every 200ms
}

/**
 * Handle streaming events during test execution
 * @param {Object} event - Streaming event from test execution
 * @param {boolean} verbose - Whether to show verbose output
 * @param {Map} testNames - Map of test IDs to test names
 */
const handleStreamingEvent = (event, verbose = false, testNames = new Map()) => {
  if (!event) return

  // Handle different types of streaming events
  if (typeof event === 'string') {
    if (!dynamicTableActive) {
      output.info(event)
    }
    return
  }

  if (event.type === 'start_test') {
    const testId = event.attrs?.name || 'unknown'
    const testName = testNames.get(testId) || event.attrs?.doc || testId
    
    if (dynamicTableActive) {
      // Update dynamic table
      const testData = testExecutionData.get(testId)
      if (testData) {
        testData.status = 'RUNNING'
        testData.currentStep = event.attrs?.doc || 'Starting...'
        testData.startTime = Date.now()
        updateDynamicTable()
      }
    } else {
      output.info(`🚀 Starting: ${testName}`)
      if (event.attrs?.doc && event.attrs.doc !== testName) {
        output.dim(`   ${event.attrs.doc}`)
      }
    }
  } else if (event.type === 'end_test') {
    const testId = event.attrs?.name || 'unknown'
    const testName = testNames.get(testId) || testId
    const status = event.attrs?.status
    const duration = event.attrs?.elapsed_time
    
    if (dynamicTableActive) {
      // Update dynamic table
      const testData = testExecutionData.get(testId)
      if (testData) {
        testData.status = status
        testData.duration = duration ? `${duration}s` : 'N/A'
        testData.currentStep = status === 'PASS' ? 'Completed' : 'Failed'
        updateDynamicTable()
      }
    } else {
      if (status === 'PASS') {
        output.success(`✅ ${testName} completed${duration ? ` (${duration}s)` : ''}`)
      } else if (status === 'FAIL') {
        output.error(`❌ ${testName} failed${duration ? ` (${duration}s)` : ''}`)
      } else {
        output.info(`📋 ${testName} finished with status: ${status}${duration ? ` (${duration}s)` : ''}`)
      }
    }
  } else if (event.type === 'keyword') {
    const keyword = event.keyword
    const status = event.status
    const duration = event.elapsed_time || event.elapsedtime
    
    if (dynamicTableActive) {
      // Update current step in dynamic table
      // Find which test this keyword belongs to by looking at recent start_test events
      const runningTests = Array.from(testExecutionData.entries())
        .filter(([_, data]) => data.status === 'RUNNING')
      
      if (runningTests.length > 0) {
        const [testId, testData] = runningTests[runningTests.length - 1] // Most recent running test
        if (status === 'NOT SET') {
          testData.currentStep = keyword
        } else if (status === 'PASS') {
          testData.currentStep = `✓ ${keyword}`
        } else if (status === 'FAIL') {
          testData.currentStep = `✗ ${keyword}`
        }
        updateDynamicTable()
      }
    } else {
      if (status === 'PASS') {
        // Update the progress line in place
        if (activeProgressLines.has(keyword)) {
          // Move cursor up and clear line, then write new content
          process.stdout.write('\x1b[1A\x1b[2K')
          activeProgressLines.delete(keyword)
        }
        output.success(`  ✓ ${keyword}${duration ? ` (${duration}s)` : ''}`)
      } else if (status === 'FAIL') {
        if (activeProgressLines.has(keyword)) {
          process.stdout.write('\x1b[1A\x1b[2K')
          activeProgressLines.delete(keyword)
        }
        output.error(`  ✗ ${keyword}${duration ? ` (${duration}s)` : ''}`)
      } else if (status === 'NOT SET') {
        // This is a progress line - track it for later update
        output.dim(`  ⏳ ${keyword}`)
        activeProgressLines.set(keyword, Date.now())
      } else {
        if (activeProgressLines.has(keyword)) {
          process.stdout.write('\x1b[1A\x1b[2K')
          activeProgressLines.delete(keyword)
        }
        output.info(`  📋 ${keyword}: ${status}${duration ? ` (${duration}s)` : ''}`)
      }
    }
  } else if (verbose && !dynamicTableActive) {
    // Only show verbose events when not using dynamic table
    if (event.type === 'log' || event.level === 'info') {
      const message = event.message || event.data || event.text || JSON.stringify(event)
      const timestamp = event.timestamp ? `[${new Date(event.timestamp).toLocaleTimeString()}] ` : ''
      output.dim(`${timestamp}${message}`)
    } else if (event.type === 'error' || event.level === 'error') {
      const message = event.message || event.error || event.text || JSON.stringify(event)
      const timestamp = event.timestamp ? `[${new Date(event.timestamp).toLocaleTimeString()}] ` : ''
      output.error(`${timestamp}${message}`)
    } else if (event.type === 'success' || event.level === 'success' || event.status === 'PASS') {
      const message = event.message || event.text || JSON.stringify(event)
      const timestamp = event.timestamp ? `[${new Date(event.timestamp).toLocaleTimeString()}] ` : ''
      output.success(`${timestamp}${message}`)
    } else if (event.type === 'warning' || event.level === 'warning') {
      const message = event.message || event.text || JSON.stringify(event)
      const timestamp = event.timestamp ? `[${new Date(event.timestamp).toLocaleTimeString()}] ` : ''
      output.warning(`${timestamp}${message}`)
    } else {
      // Show all other events in verbose mode
      const eventStr = JSON.stringify(event, null, 2)
      output.dim(eventStr)
    }
  }
}

/**
 * Update the dynamic table with current test execution state
 */
function updateDynamicTable() {
  if (!dynamicTableActive) return
  
  // Prepare table data
  const headers = ['Status', 'Test Name', 'Duration', 'Current Step']
  const rows = Array.from(testExecutionData.values()).map(test => {
    const statusSymbol = test.status === 'PASS' ? '✅' : 
                        test.status === 'FAIL' ? '❌' : 
                        test.status === 'RUNNING' ? '🔄' : '⏳'
    
    // Calculate live duration for running tests
    let duration = test.duration
    if (test.status === 'RUNNING' && test.startTime) {
      const elapsed = (Date.now() - test.startTime) / 1000
      duration = `${elapsed.toFixed(1)}s`
    } else if (test.status === 'PENDING' && !test.startTime) {
      // Show live elapsed time since initialization for pending tests
      duration = '0.0s'
    }
    
    return [statusSymbol, test.name, duration, test.currentStep]
  })
  
  const tableString = createCleanTable(headers, rows)
  const tableLines = tableString.split('\n')
  
  if (lastTableHeight === 0) {
    // First time drawing the table
    console.log(tableString)
    lastTableHeight = tableLines.length
  } else {
    // Update existing table by overwriting lines
    // Move cursor up to the beginning of the table
    process.stdout.write(`\x1b[${lastTableHeight}A`)
    
    // Overwrite each line
    tableLines.forEach((line, index) => {
      // Clear the line and write new content
      process.stdout.write('\x1b[2K' + line)
      if (index < tableLines.length - 1) {
        process.stdout.write('\n')
      }
    })
    
    // If new table is shorter, clear any remaining lines
    if (tableLines.length < lastTableHeight) {
      for (let i = tableLines.length; i < lastTableHeight; i++) {
        process.stdout.write('\n\x1b[2K')
      }
      // Move cursor back up to end of table
      process.stdout.write(`\x1b[${lastTableHeight - tableLines.length}A`)
    }
    
    // Position cursor at the end of the table for next output
    process.stdout.write('\n')
    
    lastTableHeight = tableLines.length
  }
}

/**
 * Finalize dynamic table and show final results
 */
function finalizeDynamicTable() {
  if (!dynamicTableActive) return
  
  dynamicTableActive = false
  
  // Clear the timer
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
  
  // Show final summary
  const results = Array.from(testExecutionData.values())
  const passCount = results.filter(r => r.status === 'PASS').length
  const failCount = results.filter(r => r.status === 'FAIL').length
  const totalTests = results.length
  
  console.log()
  if (failCount === 0) {
    output.success(`✅ All ${totalTests} tests passed`)
  } else {
    output.error(`❌ ${failCount}/${totalTests} tests failed, ${passCount} passed`)
  }
}

/**
 * Display test execution results in table format
 * @param {Array} events - All streaming events from test execution
 * @param {string} identifier - Original test identifier
 * @param {Map} testNames - Map of test IDs to test names
 */
const displayTestResults = (events, identifier, testNames) => {
  if (!events || events.length === 0) {
    output.warning('No events received from test execution')
    return
  }

  // For tag-based runs, show a table of all test results
  if (identifier.startsWith('tag:')) {
    const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)
    
    if (testResults.length > 1) {
      console.log() // Add spacing
      console.log(colors.subtitle('Test Results'))
      console.log()
      
      const rows = testResults.map(result => {
        const testId = result.attrs?.name || 'unknown'
        const testName = testNames.get(testId) || testId
        const status = result.attrs?.status || 'UNKNOWN'
        const duration = result.attrs?.elapsed_time ? `${result.attrs.elapsed_time}s` : 'N/A'
        const statusSymbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '❓'
        
        return [statusSymbol, testName, duration, status]
      })
      
      console.log(createCleanTable(['Status', 'Test Name', 'Duration', 'Result'], rows))
      
      // Summary
      const passCount = testResults.filter(e => e.attrs.status === 'PASS').length
      const failCount = testResults.filter(e => e.attrs.status === 'FAIL').length
      const totalTests = testResults.length
      
      console.log()
      if (failCount === 0) {
        output.success(`✅ All ${totalTests} tests passed`)
      } else {
        output.error(`❌ ${failCount}/${totalTests} tests failed, ${passCount} passed`)
      }
    }
  }
}

/**
 * Display final test execution summary (simplified)
 * @param {Array} events - All streaming events from test execution
 * @param {string} identifier - Original test identifier
 */
const displayTestSummary = (events, identifier) => {
  // This function is now deprecated in favor of displayTestResults
  // Keeping for backward compatibility but it does nothing
  return
}

/**
 * Run a test by name, tag, or ID
 * @param {string} identifier - Test identifier (name, tag:tagname, or ID)
 * @param {Object} options - Command options
 */
export const runTestCommand = async (identifier, options = {}) => {
  let finalStatus = null
  
  try {
    debug(config, `Running test with identifier: ${identifier}`)
    
    // Fetch all tests to create ID-to-name mapping
    const allTests = await getAllTests()
    const testNames = new Map()
    allTests.forEach(test => {
      if (test.id && test.name) {
        testNames.set(test.id, test.name)
      }
    })
    
    // Determine which tests will be executed for dynamic table initialization
    let testIds = []
    if (identifier.startsWith('tag:')) {
      const tag = identifier.substring(4)
      testIds = allTests
        .filter(test => test.tags && test.tags.includes(tag))
        .map(test => test.id)
      output.info(`🚀 Running tests with tag: ${tag}`)
    } else if (identifier.length >= 15 && !identifier.includes(' ')) {
      // Running by ID - show the actual test name if we have it
      const testName = testNames.get(identifier) || identifier
      testIds = [identifier]
      output.info(`🚀 Running test: ${testName}`)
    } else {
      // Running by name - find the test ID
      const matchingTest = allTests.find(test => 
        test.name === identifier || test.doc === identifier
      )
      if (matchingTest) {
        testIds = [matchingTest.id]
      }
      output.info(`🚀 Running test: ${identifier}`)
    }
    
    console.log() // Add spacing before test execution
    
    // Initialize dynamic table for multi-test runs
    if (testIds.length > 1) {
      initializeDynamicTable(testIds, testNames)
    }
    
    // Execute the test with real-time streaming
    const events = await runTest(identifier, (event) => {
      handleStreamingEvent(event, options.verbose, testNames)
      
      // Track final status for exit code
      if (event && ((event.type === 'end_test' || event.type === 'end_suite') && event.attrs?.status)) {
        finalStatus = event.attrs.status
      } else if (event && (event.type === 'result' || event.status)) {
        finalStatus = event.status
      }
    })
    
    // Finalize dynamic table or display static results
    if (dynamicTableActive) {
      finalizeDynamicTable()
    } else {
      displayTestResults(events, identifier, testNames)
    }
    
    // Determine final status if not captured during streaming
    if (!finalStatus && events.length > 0) {
      const resultEvent = events.find(e => 
        (e.type === 'end_test' || e.type === 'end_suite') && e.attrs?.status
      ) || events.find(e => e.type === 'result' || e.status)
      finalStatus = resultEvent?.attrs?.status || resultEvent?.status
    }
    
    // Exit with appropriate code based on test result (no redundant message)
    if (finalStatus === 'FAIL') {
      process.exit(1)
    } else if (finalStatus === 'PASS') {
      process.exit(0)
    } else {
      process.exit(0)
    }
    
  } catch (error) {
    if (error.name === 'ApiError') {
      displayApiError(error, options.verbose)
      
      // Provide helpful suggestions for common errors
      if (error.message.includes('Test not found')) {
        output.section('Available tests:')
        try {
          const tests = await getAllTests()
          if (tests && tests.length > 0) {
            tests.slice(0, 10).forEach(test => {
              output.info(`  • ${test.name || test.id} ${test.doc ? `- ${test.doc}` : ''}`)
            })
            if (tests.length > 10) {
              output.info(`  ... and ${tests.length - 10} more tests`)
            }
          } else {
            output.info('No tests found')
          }
        } catch (listError) {
          debug(config, `Failed to list tests: ${listError.message}`)
        }
      }
    } else {
      output.error(`Unexpected error: ${error.message}`)
      if (options.verbose) {
        console.error(error.stack)
      }
    }
    
    process.exit(1)
  }
}

/**
 * List all available tests
 * @param {Object} options - Command options
 */
export const listTestsCommand = async (options = {}) => {
  try {
    debug(config, 'Fetching all tests')
    
    const tests = await getAllTests()
    
    if (!tests || tests.length === 0) {
      output.info('No tests found')
      return
    }
    
    console.log(colors.subtitle(`Available Tests (${tests.length})`))
    console.log()
    
    // Prepare table data
    const headers = options.verbose 
      ? ['Name', 'Description', 'Tags', 'ID']
      : ['Name', 'Description', 'Tags']
    
    const rows = tests.map(test => {
      const name = test.name || test.id
      const description = (test.doc || test.description || '').substring(0, 50) + 
                         ((test.doc || test.description || '').length > 50 ? '...' : '')
      const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : ''
      
      if (options.verbose) {
        return [name, description, tags, test.id || '']
      } else {
        return [name, description, tags]
      }
    })
    
    console.log(createCleanTable(headers, rows))
    
    if (!options.verbose) {
      console.log()
      output.info('Use --verbose to see full descriptions and IDs')
    }
    
  } catch (error) {
    if (error.name === 'ApiError') {
      displayApiError(error, options.verbose)
    } else {
      output.error(`Unexpected error: ${error.message}`)
      if (options.verbose) {
        console.error(error.stack)
      }
    }
    
    process.exit(1)
  }
}

export default {
  runTestCommand,
  listTestsCommand,
}