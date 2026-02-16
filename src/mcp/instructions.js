/**
 * Agent Instructions MCP Tools
 * Fetches centralized instruction prompts from the server
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { apiGet, detectApiAndAuth } from '../utils/api.js'
import { log } from '../utils/log.js'

// Cache all prompts in memory after first fetch
let promptsCache = null

/**
 * Fetch ALL instructions from server once and cache
 */
async function fetchAllInstructions() {
  if (promptsCache) {
    return promptsCache
  }

  await detectApiAndAuth()
  const response = await apiGet('/api/prompts', {}, 'Fetching all instructions', true)
  promptsCache = response
  return response
}

/**
 * Get all prompts (exported for injection)
 * Fetches static prompts + dynamic auth state section
 */
export async function getAllPrompts() {
  const cachedPrompts = await fetchAllInstructions()

  // Clone to avoid mutating cache
  const prompts = { ...cachedPrompts }

  // Fetch dynamic auth state section
  try {
    await detectApiAndAuth()
    const authStateResponse = await apiGet('/api/auth-states-prompt', {}, 'Fetching auth states', true)

    if (authStateResponse.section) {
      prompts.authentication_state_management = authStateResponse.section + cachedPrompts.authentication_state_management
    }
  } catch (e) {
    log(`[Instructions] Failed to fetch auth states: ${e.message}`)
    // Fall back to static prompt
  }

  return prompts
}

/**
 * Get how_to instructions (exported for use in other tools)
 */
export async function getHowToInstructions(args = {}) {
  try {
    const prompts = await getAllPrompts()

    // Format response based on whether specific type was requested
    if (args.type) {
      const content = prompts[args.type]
      if (!content) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Instruction type '${args.type}' not found

**Available types:**
${Object.keys(prompts).map(t => `- ${t}`).join('\n')}`,
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `# ${args.type} Instructions

${content}`,
          },
        ],
      }
    } else {
      // Return list of all available instructions
      const availableTypes = Object.keys(prompts)
      const summary = availableTypes.map(type => `- **${type}**`).join('\n')

      return {
        content: [
          {
            type: 'text',
            text: `# Available Instructions

${summary}

**Total:** ${availableTypes.length} instruction types

**To get specific instructions:** Call with \`{ "type": "<instruction_type>" }\`

**All instructions are stored centrally on the server and can be updated independently.**`,
          },
        ],
      }
    }

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Failed to Fetch Instructions

**Error:** ${error.message}

**Troubleshooting:**
1. Check server is running
2. Verify API connection
3. Ensure you have authentication

**Debug Info:**
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
 * Register instruction tools
 */
export function registerInstructionTools(server) {
  server.registerTool(
    'how_to',
    {
      title: 'Get Agent Instructions',
      description: `Fetch centralized instruction prompts for agents.

These instructions define agent behavior, workflow loops, and best practices.
Prompts are stored on the server and can be updated independently of platform code.

**⚠️ MANDATORY BEFORE CREATING TESTS:**
- test_quality_guardrails: Test quality criteria, structure, and evaluation (READ THIS FIRST)

**Available instruction types:**
- test_quality_guardrails: Mandatory test quality mechanisms and guardrails (⚠️ READ BEFORE CREATING TESTS)
- test_creation_guidance: How to create tests
- test_modification_guidance: How to modify tests
- authentication_state_management: Save/restore auth states
- interactive_command_instructions: Interactive testing workflow
- self_healing: Self-healing test monitoring loop
- browser_automation: Browser agent thinking loop
- exploratory_testing: Exploratory testing workflow
- robot_framework_syntax: Robot Framework syntax guide
- test_type_ui: UI testing guidance
- test_type_api: API testing guidance
- test_type_database: Database testing guidance
- test_type_integration: Integration testing guidance
- (and more - call without type to see all)

**Usage:**
\`\`\`json
// Get specific instruction
{ "type": "test_quality_guardrails" }

// Get all instructions
{ }
\`\`\`

**When to use:**
- BEFORE creating any test (call test_quality_guardrails)
- Starting an agent loop (self-healing, exploratory testing, etc.)
- Need guidance for test creation/modification
- Implementing platform-agnostic agent logic

**Result:**
Returns either:
- Single prompt: { type: "...", content: "..." }
- All prompts: { self_healing: "...", browser_automation: "...", ... }`,
      inputSchema: {
        type: z.string().optional().describe('Instruction type to fetch. Omit to get all instructions.'),
      },
    },
    async (args) => {
      debug(config, `Get instructions tool called: ${JSON.stringify(args)}`)
      return await getHowToInstructions(args)
    }
  )
}
