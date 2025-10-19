/**
 * Keywords Command
 *
 * Search and explore available Robot Framework keywords and libraries
 */

import { colors, output } from '../utils/colors.js'
import { apiGet } from '../utils/api.js'

/**
 * Search keywords and libraries
 * @param {string} searchTerm - Search term to filter results
 * @param {Object} options - Command options
 * @param {string} options.type - Type of search: 'keywords', 'libraries', or 'all'
 * @param {boolean} options.verbose - Show detailed information
 * @param {boolean} options.json - Output in JSON format
 */
export default async function keywordsCommand(searchTerm = '', options = {}) {
  const { type = 'all', verbose = false, json = false } = options

  try {
    const apiResponse = await apiGet('/api/keywords', { search: searchTerm, type })

    if (json) {
      console.log(JSON.stringify(apiResponse, null, 2))
      return
    }

    // Transform API response to match expected format
    const results = transformApiResponse(apiResponse)
    displayResults(results, searchTerm, type, verbose)

  } catch (error) {
    output.error(`Failed to search keywords: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Transform API response to match expected display format
 * @param {Object} apiResponse - API response
 * @returns {Object} Transformed results
 */
function transformApiResponse(apiResponse) {
  const results = {
    searchTerm: apiResponse.search,
    type: apiResponse.type,
    libraries: apiResponse.results.libraries || {},
    keywords: {},
    summary: {
      totalLibraries: 0,
      totalKeywords: 0,
      matchedLibraries: apiResponse.summary.libraries,
      matchedKeywords: apiResponse.summary.keywords
    }
  }

  // Transform keywords array to object keyed by name
  if (apiResponse.results.keywords) {
    for (const keyword of apiResponse.results.keywords) {
      results.keywords[keyword.name] = keyword
    }
  }

  return results
}

/**
 * Display search results
 * @param {Object} results - Search results
 * @param {string} searchTerm - Search term
 * @param {string} type - Search type
 * @param {boolean} verbose - Show detailed information
 */
function displayResults(results, searchTerm, type, verbose) {
  // Header
  if (searchTerm) {
    output.info(colors.brand('Robot Framework Keywords Search') + ' - "' + colors.highlight(searchTerm) + '"')
  } else {
    output.info(colors.brand('Robot Framework Keywords') + ' - All Available')
  }
  
  console.log(colors.dim('Search type: ' + type + ' | Libraries: ' + results.summary.matchedLibraries + '/' + results.summary.totalLibraries + ' | Keywords: ' + results.summary.matchedKeywords + '/' + results.summary.totalKeywords))
  console.log()
  
  // Display libraries
  if (Object.keys(results.libraries).length > 0) {
    console.log(colors.subtitle('📚 Libraries:'))
    console.log()
    
    for (const [libName, libData] of Object.entries(results.libraries)) {
      console.log(colors.key(libName) + ' ' + colors.dim('(v' + (libData.version || 'unknown') + ')'))
      
      if (verbose && libData.doc) {
        // Show full documentation in verbose mode
        const formattedDoc = formatDocumentation(libData.doc, true)
        if (formattedDoc) {
          console.log(formattedDoc)
        }
      }
      
      // Show keyword count
      const keywordCount = libData.keywordCount || 0
      console.log(colors.dim('  ' + keywordCount + ' keywords available'))
      
      console.log()
    }
  }
  
  // Display keywords
  if (Object.keys(results.keywords).length > 0) {
    console.log(colors.subtitle('🔧 Keywords:'))
    console.log()
    
    // Group keywords by library
    const keywordsByLibrary = {}
    for (const [keywordName, keywordData] of Object.entries(results.keywords)) {
      const libName = findKeywordLibrary(keywordName, keywordData)
      if (!keywordsByLibrary[libName]) {
        keywordsByLibrary[libName] = []
      }
      keywordsByLibrary[libName].push({ name: keywordName, data: keywordData })
    }
    
    for (const [libName, libKeywords] of Object.entries(keywordsByLibrary)) {
      if (libKeywords.length > 0) {
        console.log(colors.dim(libName + ':'))
        
        for (const { name, data } of libKeywords.slice(0, verbose ? 50 : 10)) {
          console.log('  ' + colors.key(name))
          
          if (verbose && data.doc) {
            // Show full documentation in verbose mode
            const formattedDoc = formatDocumentation(data.doc, true)
            if (formattedDoc) {
              console.log(formattedDoc)
            }
          } else if (data.shortdoc) {
            // Show short description in non-verbose mode
            console.log(colors.dim('    ' + data.shortdoc))
          }
          
          if (verbose && data.args && data.args.length > 0) {
            const argsList = data.args.map(arg => arg.repr || arg.name).join(', ')
            console.log(colors.dim('    Args: ' + argsList))
          }
        }
        
        if (libKeywords.length > (verbose ? 50 : 10)) {
          const remaining = libKeywords.length - (verbose ? 50 : 10)
          console.log(colors.dim('    ... and ' + remaining + ' more keywords'))
        }
        
        console.log()
      }
    }
  }
  
  // Summary
  if (results.summary.matchedLibraries === 0 && results.summary.matchedKeywords === 0) {
    output.warning('No results found for "' + searchTerm + '"')
    console.log()
    console.log(colors.dim('Try:'))
    console.log(colors.dim('• Using broader search terms'))
    console.log(colors.dim('• Searching for specific actions like "click", "get", "should"'))
    console.log(colors.dim('• Using --type libraries to search only libraries'))
    console.log(colors.dim('• Using --type keywords to search only keywords'))
  } else {
    console.log(colors.dim('Found ' + results.summary.matchedLibraries + ' libraries and ' + results.summary.matchedKeywords + ' keywords'))
    
    if (!verbose && (results.summary.matchedKeywords > 10 || results.summary.matchedLibraries > 5)) {
      console.log(colors.dim('Use --verbose to see more details and additional results'))
    }
  }
}

/**
 * Find which library a keyword belongs to
 * @param {string} keywordName - Keyword name
 * @param {Object} keywordData - Keyword data (may contain library info)
 * @returns {string} Library name
 */
function findKeywordLibrary(keywordName, keywordData = {}) {
  // If we have library info in the keyword data, use it
  if (keywordData.library) {
    return keywordData.library
  }
  
  // Otherwise search through libraries
  for (const [libName, libData] of Object.entries(libraries)) {
    if (libData.keywords && libData.keywords.some(kw => kw.name === keywordName)) {
      return libName
    }
  }
  return 'Unknown'
}

/**
 * Convert HTML documentation to clean, readable text for CLI display
 * @param {string} htmlDoc - HTML documentation
 * @param {boolean} verbose - Whether to show full documentation or summary
 * @returns {string} Formatted text for CLI
 */
function formatDocumentation(htmlDoc, verbose = false) {
  if (!htmlDoc) return ''
  
  // Convert HTML to clean text with proper formatting and colors
  let text = htmlDoc
    // Convert headings to colored text with newlines
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (match, content) => {
      return '\n\n' + colors.subtitle(content.trim()) + '\n'
    })
    
    // Convert paragraphs to text with spacing
    .replace(/<p[^>]*>(.*?)<\/p>/gi, (match, content) => {
      return content.trim() + '\n\n'
    })
    
    // Convert line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Convert lists with proper formatting
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, (match, content) => {
      return '  • ' + content.trim() + '\n'
    })
    
    // Convert code elements with highlighting
    .replace(/<code[^>]*>(.*?)<\/code>/gi, (match, content) => {
      return colors.highlight('`' + content.trim() + '`')
    })
    .replace(/<pre[^>]*>(.*?)<\/pre>/gi, (match, content) => {
      return '\n' + colors.dim('    ' + content.trim()) + '\n'
    })
    
    // Convert emphasis with colors
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, (match, content) => {
      return colors.key(content.trim())
    })
    .replace(/<b[^>]*>(.*?)<\/b>/gi, (match, content) => {
      return colors.key(content.trim())
    })
    .replace(/<em[^>]*>(.*?)<\/em>/gi, (match, content) => {
      return colors.dim(content.trim())
    })
    .replace(/<i[^>]*>(.*?)<\/i>/gi, (match, content) => {
      return colors.dim(content.trim())
    })
    
    // Convert links but keep text with highlighting
    .replace(/<a[^>]*>(.*?)<\/a>/gi, (match, content) => {
      return colors.highlight(content.trim())
    })
    
    // Convert tables to simple text
    .replace(/<table[^>]*>.*?<\/table>/gi, '[Table content]')
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '')
    .replace(/<td[^>]*>(.*?)<\/td>/gi, '$1 | ')
    .replace(/<th[^>]*>(.*?)<\/th>/gi, colors.key('$1') + ' | ')
    
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '') // Trim
    .replace(/ +/g, ' ') // Collapse multiple spaces
    .replace(/\n +/g, '\n') // Remove leading spaces on lines
  
  // If not verbose, get just the first few lines
  if (!verbose) {
    const lines = text.split('\n').filter(line => line.trim())
    const summary = lines.slice(0, 3).join('\n')
    if (summary.length > 300) {
      return summary.substring(0, 300) + '...'
    }
    return summary
  }
  
  // For verbose mode, indent the content for better display
  return text.split('\n').map(line => line ? '    ' + line : '').join('\n')
}