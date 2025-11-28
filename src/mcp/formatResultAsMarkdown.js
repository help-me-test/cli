/**
 * Format interactive command result as human-readable Markdown
 * This gives the AI proper context instead of overwhelming JSON
 */

/**
 * Format keyword execution events as a markdown list
 * Only show final PASS/FAIL status, not intermediate states
 */
function formatKeywordExecution(events) {
  const keywords = events.filter(e => e.type === 'keyword' && e.status && e.status !== 'NOT SET')

  if (keywords.length === 0) return ''

  const lines = ['## 🤖 Command Execution\n']

  for (const kw of keywords) {
    const { keyword, status, elapsed_time, elapsedtime, error, message } = kw
    const time = elapsed_time || elapsedtime

    // Status icon
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚪'

    // Build line
    let kwLine = `${icon} **${keyword}**`

    if (time !== undefined && time !== null) {
      kwLine += ` _(${time.toFixed(3)}s)_`
    }

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

      // Console logs - ALL levels
      if (eventType === 'ConsoleLog') {
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
 * Main formatter - convert result array to markdown
 * @param {Array} result - Raw result from interactive command
 * @returns {string} Formatted markdown
 */
export function formatResultAsMarkdown(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return '_No result data available_'
  }

  const sections = []

  // Command execution (keywords)
  const keywordSection = formatKeywordExecution(result)
  if (keywordSection) sections.push(keywordSection)

  // Page information
  const pageSection = formatPageInfo(result)
  if (pageSection) sections.push(pageSection)

  // Interactive elements
  const elementsSection = formatInteractiveElements(result)
  if (elementsSection) sections.push(elementsSection)

  // Browser activity (OpenReplay events)
  const browserActivitySection = formatOpenReplayEvents(result)
  if (browserActivitySection) sections.push(browserActivitySection)

  if (sections.length === 0) {
    return '_No actionable information in result_'
  }

  return sections.join('\n---\n\n')
}
