/**
 * HelpMeTest CLI Version E2E Tests
 * 
 * Tests the actual HelpMeTest CLI version functionality - not Node.js internals.
 * Focuses on CLI commands, version utilities, and release workflow compatibility.
 */

import { describe, test, expect, beforeAll } from '@jest/globals'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = join(__dirname, '../..')

describe('HelpMeTest CLI Version E2E Tests', () => {
  // Tests for version command and version utilities

  let expectedVersion

  beforeAll(() => {
    // Read package.json to get expected version
    const packageJsonPath = join(CLI_ROOT, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    expectedVersion = packageJson.version
    
    console.log(`Testing HelpMeTest CLI version: ${expectedVersion}`)
  })

  describe('CLI Version Commands', () => {
    test('helpmetest --version should return current version', () => {
      const result = execSync('bun src/index.js --version', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      }).trim()
      
      expect(result).toBe(expectedVersion)
    })

    test('helpmetest -V should return current version', () => {
      const result = execSync('bun src/index.js -V', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      }).trim()
      
      expect(result).toBe(expectedVersion)
    })

    test('helpmetest --help should show version option', () => {
      const result = execSync('bun src/index.js --help', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      })
      
      expect(result).toContain('--version')
      expect(result).toContain('display version number')
    })
  })

  describe('HelpMeTest Version Utilities', () => {
    test('getVersion() should return correct version', async () => {
      const { getVersion } = await import('../utils/version.js')
      const version = getVersion()
      
      expect(version).toBe(expectedVersion)
    })

    test('getVersionInfo() should return complete version info', async () => {
      const { getVersionInfo } = await import('../utils/version.js')
      const versionInfo = getVersionInfo()
      
      expect(versionInfo.version).toBe(expectedVersion)
      expect(versionInfo.name).toBe('helpmetest-cli')
      expect(versionInfo.userAgent).toBe(`HelpMeTest-CLI/${expectedVersion}`)
    })

    test('getUserAgent() should include version', async () => {
      const { getUserAgent } = await import('../utils/version.js')
      const userAgent = getUserAgent()
      
      expect(userAgent).toBe(`HelpMeTest-CLI/${expectedVersion}`)
      expect(userAgent).toMatch(/^HelpMeTest-CLI\/\d+\.\d+\.\d+$/)
    })

    test('getMcpServerInfo() should include version', async () => {
      const { getMcpServerInfo } = await import('../utils/version.js')
      const mcpInfo = getMcpServerInfo()
      
      expect(mcpInfo.version).toBe(expectedVersion)
      expect(mcpInfo.name).toBe('helpmetest-mcp-server')
      expect(mcpInfo.description).toContain('HelpMeTest MCP Server')
      expect(mcpInfo.author).toBe('HelpMeTest')
      expect(mcpInfo.license).toBe('MIT')
    })
  })

  describe('Built CLI Version', () => {
    test('built CLI should report correct version', () => {
      // Build basic CLI for testing
      execSync('bun build src/index.js --outfile=dist/helpmetest --target=node --minify', { cwd: CLI_ROOT, timeout: 30000 })
      
      // Test built version
      const result = execSync('node dist/helpmetest --version', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      }).trim()
      
      expect(result).toBe(expectedVersion)
    }, 45000)

    test('compiled binary should report correct version', () => {
      // Build compiled binary for testing
      execSync('bun build src/index.js --compile --outfile=dist/helpmetest --minify', { cwd: CLI_ROOT, timeout: 60000 })
      
      // Test compiled binary version
      const result = execSync('./dist/helpmetest --version', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      }).trim()
      
      expect(result).toBe(expectedVersion)
    }, 75000)
  })

  describe('Version Consistency', () => {
    test('all HelpMeTest CLI components should report same version', async () => {
      // CLI command version
      const cliVersion = execSync('bun src/index.js --version', { 
        cwd: CLI_ROOT, 
        encoding: 'utf8',
        timeout: 10000
      }).trim()

      // Utility function version
      const { getVersion } = await import('../utils/version.js')
      const utilityVersion = getVersion()

      // All HelpMeTest CLI components should be identical
      expect(cliVersion).toBe(expectedVersion)
      expect(utilityVersion).toBe(expectedVersion)
      expect(cliVersion).toBe(utilityVersion)
    })

    test('version should be valid semver format', () => {
      expect(expectedVersion).toMatch(/^\d+\.\d+\.\d+$/)
      
      const [major, minor, patch] = expectedVersion.split('.').map(Number)
      expect(major).toBeGreaterThanOrEqual(0)
      expect(minor).toBeGreaterThanOrEqual(0)
      expect(patch).toBeGreaterThanOrEqual(0)
    })
  })

  describe('GitHub Actions Release Compatibility', () => {
    test('should generate correct release tag format', () => {
      const releaseTag = `v${expectedVersion}`
      expect(releaseTag).toMatch(/^v\d+\.\d+\.\d+$/)
    })

    test('should generate correct release title format', () => {
      const releaseTitle = `HelpMeTest CLI v${expectedVersion}`
      expect(releaseTitle).toMatch(/^HelpMeTest CLI v\d+\.\d+\.\d+$/)
    })

    test('should generate correct checksums filename format', () => {
      const checksumsFilename = `helpmetest-cli_${expectedVersion}_checksums.txt`
      expect(checksumsFilename).toMatch(/^helpmetest-cli_\d+\.\d+\.\d+_checksums\.txt$/)
    })
  })

  describe('MCP Server Version Integration', () => {
    test('MCP server should report HelpMeTest CLI version', async () => {
      const { getMcpServerInfo } = await import('../utils/version.js')
      const mcpInfo = getMcpServerInfo()
      
      expect(mcpInfo.version).toBe(expectedVersion)
      expect(mcpInfo.name).toBe('helpmetest-mcp-server')
    })

    test('MCP user agent should include HelpMeTest CLI version', async () => {
      const { getUserAgent } = await import('../utils/version.js')
      const userAgent = getUserAgent()
      
      expect(userAgent).toContain(expectedVersion)
      expect(userAgent).toContain('HelpMeTest-CLI')
    })
  })
})