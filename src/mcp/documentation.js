/**
 * Documentation MCP Tools
 * Provides access to Robot Framework keywords and library documentation
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { apiGet } from '../utils/api.js'

/**
 * Convert HTML documentation to markdown
 * @param {string} html - HTML documentation
 * @returns {string} Clean markdown
 */
function htmlToMarkdown(html) {
  if (!html) return ''

  return html
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<table[^>]*>.*?<\/table>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/**
 * Format keyword arguments as markdown table
 * @param {Array} args - Keyword arguments
 * @returns {string} Markdown table
 */
function formatArgsTable(args) {
  if (!args || args.length === 0) return ''

  const lines = [
    '| Argument | Type | Required | Description |',
    '|----------|------|----------|-------------|'
  ]

  for (const arg of args) {
    const name = arg.name || '-'
    const type = arg.type?.name || arg.type?.typedoc || '-'
    const required = arg.required ? 'Yes' : 'No'
    const desc = 'N/A'

    lines.push(`| ${name} | ${type} | ${required} | ${desc} |`)
  }

  return lines.join('\n')
}

/**
 * Format keywords response as markdown
 * @param {Object} response - API response
 * @param {number} limit - Number of detailed results to show
 * @param {number} offset - Offset for pagination
 * @returns {string} Formatted markdown
 */
function formatKeywordsAsMarkdown(response, limit = 5, offset = 0) {
  const lines = []

  lines.push(`# Robot Framework Keywords\n`)
  lines.push(`**Search:** ${response.search || 'all'}`)
  lines.push(`**Type:** ${response.type}`)
  lines.push(`**Found:** ${response.summary.keywords} keywords, ${response.summary.libraries} libraries\n`)

  if (response.results.libraries && Object.keys(response.results.libraries).length > 0) {
    lines.push(`## Libraries\n`)
    for (const [libName, libData] of Object.entries(response.results.libraries)) {
      lines.push(`### ${libName}`)
      if (libData.doc) {
        lines.push(htmlToMarkdown(libData.doc).substring(0, 300))
      }
      lines.push('')
    }
  }

  if (response.results.keywords && response.results.keywords.length > 0) {
    const allKeywords = response.results.keywords
    const detailedKeywords = allKeywords.slice(offset, offset + limit)
    const remainingKeywords = allKeywords.slice(offset + limit)

    lines.push(`## Keywords (showing ${offset + 1}-${offset + detailedKeywords.length} of ${allKeywords.length})\n`)

    // Show detailed info for limited keywords
    for (const keyword of detailedKeywords) {
      lines.push(`### ${keyword.name}`)
      lines.push(`**Library:** ${keyword.library || 'Unknown'}\n`)

      if (keyword.doc) {
        const doc = htmlToMarkdown(keyword.doc)
        const shortDoc = doc.length > 500 ? doc.substring(0, 500) + '...' : doc
        lines.push(shortDoc)
        lines.push('')
      }

      if (keyword.args && keyword.args.length > 0) {
        lines.push(`**Arguments:**\n`)
        lines.push(formatArgsTable(keyword.args))
        lines.push('')
      }
    }

    // List remaining keywords by name
    if (remainingKeywords.length > 0) {
      lines.push(`\n## Other Keywords\n`)
      for (const keyword of remainingKeywords) {
        lines.push(`- **${keyword.name}** _(${keyword.library || 'Unknown'})_`)
      }
      lines.push(`\n_Use limit and offset parameters to see details for other keywords_`)
    }
  }

  return lines.join('\n')
}

/**
 * Handle keywords tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.search] - Search term to filter keywords/libraries
 * @param {string} [args.type] - Type of documentation to search
 * @param {number} [args.limit] - Number of detailed results to show
 * @param {number} [args.offset] - Offset for pagination
 * @returns {Object} Keywords result
 */
async function handleKeywords(args) {
  const { search, type = 'all', limit = 5, offset = 0 } = args

  debug(config, `Searching keywords with: search="${search}", type="${type}", limit=${limit}, offset=${offset}`)

  try {
    const response = await apiGet('/api/keywords', { search, type })
    const markdown = formatKeywordsAsMarkdown(response, limit, offset)

    return {
      content: [
        {
          type: 'text',
          text: markdown,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error searching keywords: ${error.message}`)

    const errorResponse = {
      error: true,
      search,
      type,
      message: error.message,
      timestamp: new Date().toISOString()
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
 * Register documentation-related MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerDocumentationTools(server) {
  server.registerTool(
    'helpmetest_keywords',
    {
      title: 'Help Me Test: Keywords Documentation Tool',
      description: 'Search Robot Framework keywords and library documentation. Returns detailed information about available commands and usage.',
      inputSchema: {
        search: z.string().optional().describe('Search term to filter keywords/libraries (optional - if not provided, returns all)'),
        type: z.enum(['keywords', 'libraries', 'all']).optional().default('all').describe('Type of documentation to search: keywords, libraries, or all'),
        limit: z.number().optional().default(5).describe('Number of detailed keyword results to show (default: 5)'),
        offset: z.number().optional().default(0).describe('Offset for pagination (default: 0)'),
      },
    },
    async (args) => {
      debug(config, `Keywords tool called with args: ${JSON.stringify(args)}`)
      return await handleKeywords(args)
    }
  )
}
