/**
 * MCP Refactored Methods Tests
 * Tests the refactored MCP tool structure (32 → 21 methods)
 *
 * Tests cover:
 * - Enhanced status method with options
 * - Renamed search_artifacts
 * - Merged upsert_artifact with partial update
 * - Parameter naming consistency (id vs identifier)
 */

import 'dotenv/config'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP Refactored Methods Tests', () => {
  let client
  let transport

  beforeEach(async () => {
    const serverPath = path.resolve(__dirname, '../index.js')

    transport = new StdioClientTransport({
      command: 'bun',
      args: [
        serverPath,
        'mcp',
        'HELP-b2bcd672-f7b7-4e34-b610-d236ca31ed1e',
        '--verbose'
      ],
      env: {
        ...process.env,
        HELPMETEST_DEBUG: 'true'
      }
    })

    client = new Client({
      name: 'test-client',
      version: getVersion()
    }, {
      capabilities: {}
    })

    await client.connect(transport)
  }, 15000)

  afterEach(async () => {
    if (client) {
      await client.close()
    }
  })

  describe('Removed Duplicate Methods', () => {
    test('should not have helpmetest_status_test (duplicate)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_status_test')
    })

    test('should not have helpmetest_status_health (duplicate)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_status_health')
    })

    test('should not have helpmetest_health_checks_status (duplicate)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_health_checks_status')
    })

    test('should not have helpmetest_get_test_runs (merged into status)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_get_test_runs')
    })

    test('should not have helpmetest_get_deployments (merged into status)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_get_deployments')
    })

    test('should not have helpmetest_health_check (no value)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_health_check')
    })

    test('should not have helpmetest_update (not MCP concern)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_update')
    })
  })

  describe('Removed Non-Essential Artifact Methods', () => {
    test('should not have helpmetest_get_artifact_stats', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_get_artifact_stats')
    })

    test('should not have helpmetest_get_artifact_tags', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_get_artifact_tags')
    })

    test('should not have helpmetest_get_linked_artifacts', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_get_linked_artifacts')
    })

    test('should not have helpmetest_partial_update_artifact (merged into upsert)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).not.toContain('helpmetest_partial_update_artifact')
    })
  })

  describe('Enhanced Status Method', () => {
    test('should have helpmetest_status with enhanced options', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_status')

      expect(tool).toBeDefined()
      expect(tool.inputSchema.properties).toHaveProperty('verbose')
      expect(tool.inputSchema.properties).toHaveProperty('testsOnly')
      expect(tool.inputSchema.properties).toHaveProperty('healthOnly')
      expect(tool.inputSchema.properties).toHaveProperty('testRunLimit')
      expect(tool.inputSchema.properties).toHaveProperty('includeDeployments')
    })

    test('should return tests and health checks by default', async () => {
      const result = await client.callTool({
        name: 'helpmetest_status',
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      const content = result.content[0].text
      expect(content).toContain('Tests')
      expect(content).toContain('Health Checks')
    }, 30000)

    test('should filter to tests only', async () => {
      const result = await client.callTool({
        name: 'helpmetest_status',
        arguments: { testsOnly: true }
      })

      const content = result.content[0].text
      expect(content).toContain('Tests')
      expect(content).not.toContain('Health Checks')
    }, 30000)

    test('should filter to health checks only', async () => {
      const result = await client.callTool({
        name: 'helpmetest_status',
        arguments: { healthOnly: true }
      })

      const content = result.content[0].text
      expect(content).toContain('Health')
      expect(content).not.toContain('Tests:')
    }, 30000)

    test('should include test runs when requested', async () => {
      const result = await client.callTool({
        name: 'helpmetest_status',
        arguments: { testRunLimit: 5 }
      })

      const content = result.content[0].text
      expect(content).toContain('Test Runs')
    }, 30000)

    test('should include deployments when requested', async () => {
      const result = await client.callTool({
        name: 'helpmetest_status',
        arguments: { includeDeployments: true }
      })

      const content = result.content[0].text
      expect(content).toContain('Deployments')
    }, 30000)
  })

  describe('Renamed Artifact Method', () => {
    test('should have helpmetest_search_artifacts (renamed from list_artifacts)', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)

      expect(toolNames).toContain('helpmetest_search_artifacts')
      expect(toolNames).not.toContain('helpmetest_list_artifacts')
    })

    test('should search artifacts with filters', async () => {
      const result = await client.callTool({
        name: 'helpmetest_search_artifacts',
        arguments: { type: 'PageInventory' }
      })

      expect(result).toBeDefined()
      expect(result.content[0].text).toContain('artifacts')
    }, 30000)
  })

  describe('Merged Artifact Upsert Method', () => {
    test('should have helpmetest_upsert_artifact with smart merge capability', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_upsert_artifact')

      expect(tool).toBeDefined()
      expect(tool.description).toContain('partial update')
    })

    // Full replace test
    test.skipIf(process.env.GITHUB_ACTIONS)('should perform full replace with complete object', async () => {
      const testId = `test-artifact-${Date.now()}`

      const result = await client.callTool({
        name: 'helpmetest_upsert_artifact',
        arguments: {
          id: testId,
          name: 'Test Artifact',
          type: 'ExploratoryTesting',
          content: {
            name: 'Test',
            description: 'Test artifact',
            url: 'https://example.com',
            coverage: 'discovery',
            userFlows: [],
            tasks: [],
            discoveredStates: [],
            notes: []
          }
        }
      })

      expect(result).toBeDefined()
      expect(result.content[0].text).toContain('saved')
    }, 30000)

    // Partial update test
    test.skipIf(process.env.GITHUB_ACTIONS)('should perform partial update with dot notation', async () => {
      const testId = `test-artifact-${Date.now()}`

      // First create artifact
      await client.callTool({
        name: 'helpmetest_upsert_artifact',
        arguments: {
          id: testId,
          name: 'Test Artifact',
          type: 'ExploratoryTesting',
          content: {
            name: 'Test',
            description: 'Test artifact',
            url: 'https://example.com',
            coverage: 'discovery',
            userFlows: [],
            tasks: [],
            discoveredStates: [],
            notes: []
          }
        }
      })

      // Then partial update
      const result = await client.callTool({
        name: 'helpmetest_upsert_artifact',
        arguments: {
          id: testId,
          content: {
            'coverage': 'partial',
            'notes.-1': 'New observation'
          }
        }
      })

      expect(result).toBeDefined()
      expect(result.content[0].text).toContain('updated')
    }, 30000)
  })

  describe('Parameter Naming Consistency', () => {
    test('helpmetest_run_test should use id parameter', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_run_test')

      expect(tool).toBeDefined()
      expect(tool.inputSchema.properties).toHaveProperty('id')
      expect(tool.inputSchema.properties).not.toHaveProperty('identifier')
      expect(tool.inputSchema.required).toContain('id')
    })

    test('helpmetest_delete_test should use id parameter', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_delete_test')

      expect(tool).toBeDefined()
      expect(tool.inputSchema.properties).toHaveProperty('id')
      expect(tool.inputSchema.properties).not.toHaveProperty('identifier')
      expect(tool.inputSchema.required).toContain('id')
    })

    test('helpmetest_delete_health_check should use name parameter (verified)', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_delete_health_check')

      expect(tool).toBeDefined()
      // Health checks use 'name' as their identifier (not id)
      expect(tool.inputSchema.properties).toHaveProperty('name')
      expect(tool.inputSchema.required).toContain('name')
    })
  })

  describe('Essential Methods Kept', () => {
    const essentialMethods = [
      // Status
      'helpmetest_status',

      // Tests
      'helpmetest_run_test',
      'helpmetest_upsert_test',
      'helpmetest_delete_test',
      'helpmetest_open_test',

      // Health Checks
      'helpmetest_delete_health_check',

      // Management
      'helpmetest_undo_update',
      'helpmetest_deploy',
      'helpmetest_init',

      // Interactive
      'helpmetest_run_interactive_command',

      // Documentation
      'helpmetest_keywords',
      'how_to',

      // Artifacts
      'helpmetest_search_artifacts',
      'helpmetest_get_artifact',
      'helpmetest_upsert_artifact',
      'helpmetest_delete_artifact',
      'helpmetest_get_artifact_schema',
      'helpmetest_generate_artifact',

      // Infrastructure
      'helpmetest_proxy',
      'listen_to_events',
      'send_to_ui'
    ]

    test('should have all 21 essential methods', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)

      essentialMethods.forEach(methodName => {
        expect(toolNames).toContain(methodName)
      })

      // Should have exactly 21 helpmetest/infrastructure methods
      const htMethods = toolNames.filter(n =>
        n.startsWith('helpmetest_') ||
        n === 'listen_to_events' ||
        n === 'send_to_ui' ||
        n === 'how_to'
      )
      expect(htMethods.length).toBe(21)
    })

    test('each essential method should have concise description', async () => {
      const result = await client.listTools()

      essentialMethods.forEach(methodName => {
        const tool = result.tools.find(t => t.name === methodName)
        expect(tool).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.description.length).toBeGreaterThan(0)

        // Descriptions should not have verbose AI instructions
        expect(tool.description).not.toContain('🚨 INSTRUCTION FOR AI:')
      })
    })
  })

  describe('Init Method with Tracking', () => {
    test('should have helpmetest_init method', async () => {
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_init')

      expect(tool).toBeDefined()
      expect(tool.description).toContain('Initialize')
    })

    test('should track first run (implementation check)', async () => {
      // This test checks that init tracking is mentioned in description
      const result = await client.listTools()
      const tool = result.tools.find(t => t.name === 'helpmetest_init')

      // Description should mention tracking or first-time setup
      expect(
        tool.description.includes('first') ||
        tool.description.includes('track') ||
        tool.description.includes('approval')
      ).toBe(true)
    })
  })

  describe('Total Method Count', () => {
    test('should have reduced from 32 to 21 methods', async () => {
      const result = await client.listTools()
      const toolNames = result.tools.map(t => t.name)

      // Count helpmetest methods + infrastructure methods
      const htMethods = toolNames.filter(n =>
        n.startsWith('helpmetest_') ||
        n === 'listen_to_events' ||
        n === 'send_to_ui' ||
        n === 'how_to'
      )

      // Should be 21 (down from 32)
      expect(htMethods.length).toBeLessThanOrEqual(21)
      expect(htMethods.length).toBeGreaterThanOrEqual(21)
    })
  })
})
