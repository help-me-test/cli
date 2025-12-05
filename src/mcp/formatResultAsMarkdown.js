/**
 * Format Robot Framework execution results as human-readable Markdown
 * Works for both interactive commands and test runs
 * This gives the AI proper context instead of overwhelming JSON
 */

/**
 * Format test execution results (end_test events)
 * @param {Array} events - Array of events
 * @returns {string} Formatted test results or empty string
 */
function formatTestResults(events) {
  const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)

  if (testResults.length === 0) return ''

  const lines = ['## 🧪 Test Results\n']

  // Determine overall status
  const hasFailures = testResults.some(r => r.attrs.status === 'FAIL')
  const overallStatus = hasFailures ? '❌ FAILED' : '✅ PASSED'

  lines.push(`**Overall Status:** ${overallStatus}\n`)

  // List each test result
  for (const result of testResults) {
    const { status, name, elapsed_time, elapsedtime, doc, message } = result.attrs || {}
    const time = elapsed_time || elapsedtime
    const icon = status === 'PASS' ? '✅' : '❌'

    let testLine = `${icon} **${name || 'Unknown Test'}**`

    if (time !== undefined && time !== null) {
      testLine += ` _(${time}s)_`
    }

    if (status) {
      testLine += ` - ${status}`
    }

    lines.push(testLine)

    if (doc) {
      lines.push(`  > ${doc}`)
    }

    // Show error message for failed tests
    if (status === 'FAIL' && message) {
      lines.push(`  > ⚠️ **Error:** ${message}`)
    }

    lines.push('')
  }

  return lines.join('\n') + '\n'
}

/**
 * Format keyword execution events as a markdown list
 * Only show final PASS/FAIL status, not intermediate states
 */
function formatKeywordExecution(events, isTestRun = false) {
  const keywords = events.filter(e => e.type === 'keyword' && e.status && e.status !== 'NOT SET')

  if (keywords.length === 0) return ''

  const title = isTestRun ? '## 🔧 Keywords Executed' : '## 🤖 Command Execution'
  const lines = [title + '\n']

  // Show all keywords for both interactive and test runs
  for (const kw of keywords) {
    const { keyword, status, elapsed_time, elapsedtime, error, message } = kw
    const time = elapsed_time || elapsedtime

    // Status icon
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚪'

    // Build line: icon time keyword
    const timeStr = (time !== undefined && time !== null) ? `${time.toFixed(3)}s ` : ''
    const kwLine = `${icon} ${timeStr}${keyword}`

    lines.push(kwLine)

    // Add error details if failed
    if (status === 'FAIL' && (error || message)) {
      const errorMsg = error || message
      lines.push(`  > ⚠️ ${errorMsg}\n`)
    }
  }

  return lines.join('\n') + '\n'
}

/**
 * Format page information with actual content
 */
function formatPageInfo(events) {
  const browserInfo = events.find(e => e.type === 'GetAllTabsInfo')
  const readableContent = events.find(e => e.type === 'ExtractReadableContent')

  if (!browserInfo && !readableContent) return ''

  const lines = ['## 🌐 Current Page\n']

  if (browserInfo?.browser_catalog) {
    const activeBrowser = browserInfo.browser_catalog.find(b => b.activeBrowser)
    const activeContext = activeBrowser?.contexts?.find(c => c.id === activeBrowser.activeContext)
    const activePage = activeContext?.pages?.find(p => p.id === activeContext.activePage)

    if (activePage) {
      lines.push(`**Title:** ${activePage.title}`)
      lines.push(`**URL:** ${activePage.url}\n`)
    }
  }

  if (readableContent?.content) {
    lines.push('**Content:**\n')
    lines.push(readableContent.content)
    lines.push('')
  }

  return lines.join('\n') + '\n'
}

/**
 * Format interactive elements - grouped by selector
 */
function formatInteractiveElements(events) {
  const findElements = events.find(e => e.type === 'FindInteractableElements')

  if (!findElements?.list) return ''

  const { list } = findElements

  // Group elements by selector
  const elementMap = new Map()

  const processElements = (action, elements) => {
    if (!elements?.length) return
    for (const el of elements) {
      const selector = el.selectors?.[0] || el.selectors || '-'
      const text = el.text || ''

      if (!elementMap.has(selector)) {
        elementMap.set(selector, { actions: [], text })
      }
      elementMap.get(selector).actions.push(action)
    }
  }

  processElements('Click', list.click)
  processElements('Hover', list.hover)
  processElements('Type', list.type)
  processElements('Select', list.select)
  processElements('Check', list.check)
  processElements('Radio', list.radio)

  if (elementMap.size === 0) return ''

  const lines = ['## 🎯 Interactive Elements\n']
  lines.push('| Actions | Selector | Text |')
  lines.push('|---------|----------|------|')

  for (const [selector, { actions, text }] of elementMap) {
    const actionStr = actions.join(', ')
    lines.push(`| ${actionStr} | \`${selector}\` | ${text} |`)
  }

  return lines.join('\n') + '\n'
}

/**
 * Format OpenReplay events - navigation, performance, errors, network
 */
function formatOpenReplayEvents(events) {
  const openReplay = events.find(e => e.type === 'OpenReplayEvents')

  if (!openReplay?.events) return ''

  const sections = {
    navigation: [],
    performance: [],
    network: [],
    console: [],
    debug: [], // Debug info
  }

  for (const [timestamp, eventList] of Object.entries(openReplay.events)) {
    for (const event of eventList) {
      if (!Array.isArray(event)) continue

      const [eventType, ...args] = event
      const time = new Date(timestamp).toLocaleTimeString()

      // Page navigation
      if (eventType === 'SetPageLocation') {
        const [url, referrer, , title] = args
        sections.navigation.push(`- **${time}** - Navigated to: ${title || url}`)
      }

      // Performance metrics
      if (eventType === 'PageLoadTiming') {
        const [, , , , , , , domContentLoaded] = args
        sections.performance.push(`- **Page Load:** DOM ready in ${domContentLoaded}ms`)
      }

      if (eventType === 'WebVitals') {
        const [metric, value] = args
        sections.performance.push(`- **${metric}:** ${value}ms`)
      }

      // Console logs - ALL levels (handle both string 'ConsoleLog' and numeric type 22)
      if (eventType === 'ConsoleLog' || eventType === 22) {
        const [level, message] = args
        sections.debug.push(`ConsoleLog: level="${level}"`)

        // Strip ANSI color codes (%c)
        const cleanMessage = message?.replace(/%c/g, '') || ''

        // Map level to emoji
        const emoji = {
          'error': '❌',
          'warn': '⚠️',
          'info': 'ℹ️',
          'log': '📝',
          'debug': '🐛'
        }[level] || '📋'

        sections.console.push(`${emoji} ${cleanMessage}`)
      }
    }
  }

  // Process NetworkRequest events separately (they have different structure)
  let networkRequestCount = 0
  for (const [timestamp, eventList] of Object.entries(openReplay.events)) {
    for (const event of eventList) {
      if (!Array.isArray(event)) continue

      const [eventType, ...args] = event

      // Only process NetworkRequest events here
      if (eventType !== 'NetworkRequest') continue

      networkRequestCount++

      sections.debug.push(`NetworkRequest #${networkRequestCount}: argsLen=${args.length}, args=${JSON.stringify(args.slice(0, 3))}`)

      // args = [requestType, method, url, requestData, responseData, status, timestamp, duration, size]
      const [requestType, method, url, requestData, responseData, status, reqTimestamp, duration] = args

      // Convert status to number if it's a string
      const statusCode = typeof status === 'string' ? parseInt(status, 10) : status
      const durationMs = typeof duration === 'string' ? parseFloat(duration) : duration

      sections.debug.push(`  Parsed: method=${method}, url=${url?.substring(0, 30)}, status=${statusCode}, duration=${durationMs}ms`)

      // Format timestamp with milliseconds
      const date = new Date(parseInt(reqTimestamp))
      const time = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + date.getMilliseconds().toString().padStart(3, '0')

      // All requests with status-based emoji
      let emoji = '✅'
      if (statusCode >= 500) emoji = '💥'
      else if (statusCode >= 400) emoji = '❌'
      else if (statusCode >= 300) emoji = '🔄'
      else if (durationMs > 2000) emoji = '🐌'

      const durationStr = durationMs ? ` (${(durationMs/1000).toFixed(2)}s)` : ''
      sections.network.push(`${emoji} **${time}** **${statusCode}** ${method} ${url}${durationStr}`)
      sections.debug.push(`  ✓ Added to network logs`)
    }
  }

  sections.debug.push(`Total NetworkRequests: ${networkRequestCount}, Network issues: ${sections.network.length}`)

  const output = []

  // Navigation section
  if (sections.navigation.length > 0) {
    output.push('### 🧭 Page Navigation\n')
    output.push(sections.navigation.join('\n'))
    output.push('')
  }

  // Performance section
  if (sections.performance.length > 0) {
    output.push('### ⚡ Performance\n')
    output.push(sections.performance.join('\n'))
    output.push('')
  }

  // Network requests
  if (sections.network.length > 0) {
    output.push('### 🌐 Network Requests\n')
    output.push(sections.network.join('\n'))
    output.push('')
  }

  // Console logs
  if (sections.console.length > 0) {
    output.push('### 📋 Console Logs\n')
    output.push(sections.console.join('\n'))
    output.push('')
  }

  // Debug info - hidden for now
  // if (sections.debug.length > 0) {
  //   output.push('### 🐛 Debug Info\n')
  //   output.push('```')
  //   output.push(sections.debug.join('\n'))
  //   output.push('```')
  //   output.push('')
  // }

  if (output.length === 0) return ''

  return '## 📊 Browser Activity\n\n' + output.join('\n')
}

/**
 * Format next steps based on test results
 * @param {Array} events - Array of events
 * @returns {string} Next steps or empty string
 */
function formatNextSteps(events) {
  const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)

  if (testResults.length === 0) return ''

  const hasFailures = testResults.some(r => r.attrs.status === 'FAIL')
  const lines = ['## 📋 Next Steps\n']

  if (hasFailures) {
    lines.push('• Review failed keywords above for debugging')
    lines.push('• Check test logs for detailed error messages')
    lines.push('• Consider using `helpmetest_run_interactive_command` to debug step by step')
    lines.push('• View full test details in browser using `helpmetest_open_test`')
  } else {
    lines.push('• Test completed successfully - no action needed')
    lines.push('• View full test details in browser using `helpmetest_open_test`')
  }

  return lines.join('\n') + '\n'
}

/**
 * Main formatter - convert result array to markdown
 * Works for both interactive commands and test runs
 * @param {Array} result - Raw result from interactive command or test run
 * @param {Object} options - Formatting options
 * @param {string} options.identifier - Test identifier (for test runs)
 * @returns {string} Formatted markdown
 */
export function formatResultAsMarkdown(result, options = {}) {
  if (!Array.isArray(result) || result.length === 0) {
    return `## 🔍 Raw Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
  }

  const { identifier } = options

  // Detect if this is a test run (has end_test events)
  const isTestRun = result.some(e => e.type === 'end_test')

  const sections = []

  // Add header for test runs
  if (isTestRun && identifier) {
    sections.push(`# 🧪 Test Execution: ${identifier}\n`)
  }

  // Test results (for test runs only)
  const testResultsSection = formatTestResults(result)
  if (testResultsSection) sections.push(testResultsSection)

  // Keyword execution
  const keywordSection = formatKeywordExecution(result, isTestRun)
  if (keywordSection) sections.push(keywordSection)

  // Page information (usually not relevant for test runs, but include if present)
  const pageSection = formatPageInfo(result)
  if (pageSection) sections.push(pageSection)

  // Interactive elements (usually not relevant for test runs, but include if present)
  const elementsSection = formatInteractiveElements(result)
  if (elementsSection) sections.push(elementsSection)

  // Browser activity (OpenReplay events)
  const browserActivitySection = formatOpenReplayEvents(result)
  if (browserActivitySection) sections.push(browserActivitySection)

  // Next steps (for test runs only)
  const nextStepsSection = formatNextSteps(result)
  if (nextStepsSection) sections.push(nextStepsSection)

  // If no sections were formatted, return raw JSON instead of useless message
  if (sections.length === 0) {
    return `## 🔍 Raw Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
  }

  return sections.join('\n---\n\n')
}
