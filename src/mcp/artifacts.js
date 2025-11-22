/**
 * Artifacts MCP Tools
 * Provides CRUD operations for knowledge artifacts
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { apiGet, apiPost, apiDelete, detectApiAndAuth } from '../utils/api.js'

/**
 * Valid artifact types
 */
const ARTIFACT_TYPES = [
  'business-analysis',
  'sitemap',
  'trd',
  'page-description',
  'page-analysis',
  'user-personas',
  'api-documentation',
  'known-errors',
  'tickets',
  'exploratory-testing'
]

/**
 * List artifacts with optional filters
 */
export async function listArtifacts(args) {
  const { type, tags, search, matchAll } = args

  await detectApiAndAuth()

  const params = new URLSearchParams()
  if (type) params.append('type', type)
  if (tags) {
    if (Array.isArray(tags)) {
      params.append('tags', tags.join(','))
    } else {
      params.append('tags', tags)
    }
  }
  if (search) params.append('search', search)
  if (matchAll !== undefined) params.append('matchAll', matchAll)

  const queryString = params.toString()
  const url = `/api/artifacts${queryString ? `?${queryString}` : ''}`

  debug(config, `Listing artifacts: ${url}`)

  const data = await apiGet(url)

  return {
    content: [
      {
        type: 'text',
        text: `📦 Artifacts

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Get a specific artifact by ID
 */
export async function getArtifact(args) {
  const { id, includeLinked } = args

  await detectApiAndAuth()

  const params = new URLSearchParams()
  if (includeLinked) params.append('includeLinked', 'true')

  const queryString = params.toString()
  const url = `/api/artifacts/${id}${queryString ? `?${queryString}` : ''}`

  debug(config, `Getting artifact: ${id}`)

  const data = await apiGet(url)

  return {
    content: [
      {
        type: 'text',
        text: `📦 Artifact: ${id}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Create or update an artifact
 */
export async function upsertArtifact(args) {
  const { id, name, type, content, tags } = args

  await detectApiAndAuth()

  debug(config, `Upserting artifact: ${id}`)

  const payload = {
    id,
    name,
    type,
    content: typeof content === 'string' ? JSON.parse(content) : content,
    tags: tags || []
  }

  const data = await apiPost('/api/artifacts', payload)

  return {
    content: [
      {
        type: 'text',
        text: `✅ Artifact ${id} saved

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Delete an artifact
 */
async function deleteArtifact(args) {
  const { id } = args

  await detectApiAndAuth()

  debug(config, `Deleting artifact: ${id}`)

  const data = await apiDelete(`/api/artifacts/${id}`)

  return {
    content: [
      {
        type: 'text',
        text: `🗑️ Artifact ${id} deleted

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Get artifact statistics
 */
async function getArtifactStats(args) {
  await detectApiAndAuth()

  debug(config, 'Getting artifact statistics')

  const data = await apiGet('/api/artifacts/stats')

  return {
    content: [
      {
        type: 'text',
        text: `📊 Artifact Statistics

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Get linked artifacts
 */
async function getLinkedArtifacts(args) {
  const { id } = args

  await detectApiAndAuth()

  debug(config, `Getting linked artifacts for: ${id}`)

  const data = await apiGet(`/api/artifacts/${id}/linked`)

  return {
    content: [
      {
        type: 'text',
        text: `🔗 Linked Artifacts for ${id}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Get all available tags
 */
async function getArtifactTags(args) {
  await detectApiAndAuth()

  debug(config, 'Getting artifact tags')

  const data = await apiGet('/api/artifacts/tags')

  return {
    content: [
      {
        type: 'text',
        text: `🏷️ Artifact Tags

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Generate artifact content using AI
 */
async function generateArtifact(args) {
  const { type, params } = args

  await detectApiAndAuth()

  debug(config, `Generating ${type} artifact with params: ${JSON.stringify(params)}`)

  const payload = {
    type,
    params
  }

  const data = await apiPost('/api/artifacts/generate', payload)

  return {
    content: [
      {
        type: 'text',
        text: `🤖 Generated ${type}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``
      }
    ]
  }
}

/**
 * Register artifact tools with the MCP server
 */
export function registerArtifactTools(server) {
  // List artifacts
  server.tool(
    'helpmetest_list_artifacts',
    'List all artifacts with optional filters (type, tags, search). Use this to browse the knowledge base.',
    {
      type: z.enum(ARTIFACT_TYPES).optional().describe('Filter by artifact type'),
      tags: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by tags (comma-separated string or array)'),
      search: z.string().optional().describe('Search term to filter artifacts by name, content, or tags'),
      matchAll: z.boolean().optional().describe('If true with tags filter, artifact must have ALL tags; if false, ANY tag')
    },
    listArtifacts
  )

  // Get artifact
  server.tool(
    'helpmetest_get_artifact',
    'Get a specific artifact by ID. Optionally include linked artifacts with similar tags.',
    {
      id: z.string().describe('Artifact ID'),
      includeLinked: z.boolean().optional().describe('Include linked artifacts with similar tags')
    },
    getArtifact
  )

  // Create/update artifact
  server.tool(
    'helpmetest_upsert_artifact',
    'Create a new artifact or update an existing one. Artifacts are knowledge base items that can help with test writing and debugging.',
    {
      id: z.string().describe('Unique artifact ID (e.g., "login-page-selectors")'),
      name: z.string().describe('Human-readable artifact name'),
      type: z.enum(ARTIFACT_TYPES).describe('Artifact type: business-analysis, sitemap, trd, page-description, page-analysis, user-personas, api-documentation, known-errors, tickets'),
      content: z.union([z.string(), z.any()]).describe('Artifact content as JSON object or JSON string'),
      tags: z.array(z.string()).optional().describe('Tags for categorization and linking (e.g., ["page:login", "feature:auth"])')
    },
    upsertArtifact
  )

  // Delete artifact
  server.tool(
    'helpmetest_delete_artifact',
    'Delete an artifact by ID. This operation is tracked in the updates feed and may be undoable.',
    {
      id: z.string().describe('Artifact ID to delete')
    },
    deleteArtifact
  )

  // Get statistics
  server.tool(
    'helpmetest_get_artifact_stats',
    'Get statistics about artifacts including total count, counts by type, and tag usage.',
    {},
    getArtifactStats
  )

  // Get linked artifacts
  server.tool(
    'helpmetest_get_linked_artifacts',
    'Get artifacts linked to a specific artifact (artifacts with overlapping tags).',
    {
      id: z.string().describe('Source artifact ID')
    },
    getLinkedArtifacts
  )

  // Get all tags
  server.tool(
    'helpmetest_get_artifact_tags',
    'Get all available tags used across artifacts.',
    {},
    getArtifactTags
  )

  // Generate artifact
  server.tool(
    'helpmetest_generate_artifact',
    'Generate artifact content using AI. Pass type and params object with type-specific parameters. Example: type="business-analysis" params={"url":"https://example.com"}',
    {
      type: z.string().describe('Artifact type to generate (e.g., business-analysis, sitemap, page-analysis)'),
      params: z.record(z.any()).describe('Parameters for generation (type-specific, e.g., {"url": "https://example.com"})')
    },
    generateArtifact
  )
}
