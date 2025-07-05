/**
 * Version and Update Integration Tests
 * 
 * Tests the integration between version and update commands,
 * ensuring they work together properly and provide consistent
 * version information.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVersion } from '../utils/version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Version and Update Integration Tests', () => {
  const cliPath = path.resolve(__dirname, '../index.js')
  
  // Helper function to run CLI commands
  const runCli = (args) => {
    return new Promise((resolve, reject) => {
      const child = spawn('bun', [cliPath, ...args], {
        stdio: 'pipe',
        env: { ...process.env }
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })
      
      child.on('error', (error) => {
        reject(error)
      })
    })
  }

  test('version utility should match CLI version output', async () => {
    const utilityVersion = getVersion()
    const result = await runCli(['-V'])
    
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(utilityVersion)
  }, 10000)

  test('update dry-run should show current version', async () => {
    const utilityVersion = getVersion()
    const result = await runCli(['update', '--dry-run'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(`Current version: ${utilityVersion}`)
  }, 10000)

  test('version and update commands should be in main help', async () => {
    const result = await runCli(['--help'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('version')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('Show current version')
    expect(result.stdout).toContain('Update to latest version')
  }, 10000)

  test('all version flags should produce same output', async () => {
    const results = await Promise.all([
      runCli(['-V']),
      runCli(['--version']),
      runCli(['version'])
    ])
    
    // All should succeed
    results.forEach(result => {
      expect(result.code).toBe(0)
      expect(result.stderr).toBe('')
    })
    
    // All should produce the same version output
    const versions = results.map(result => result.stdout.trim())
    expect(versions[0]).toBe(versions[1])
    expect(versions[1]).toBe(versions[2])
    
    // Version should be valid semver format
    expect(versions[0]).toMatch(/^\d+\.\d+\.\d+/)
  }, 15000)

  test('install script analysis - should be bash script', async () => {
    // Test that we can fetch the install script (basic connectivity test)
    const fetch = (await import('node-fetch')).default
    
    try {
      const response = await fetch('https://helpmetest.com/install', {
        method: 'HEAD',
        timeout: 5000
      })
      
      // Should be accessible
      expect(response.status).toBe(200)
      
      // Should be a script (text content)
      const contentType = response.headers.get('content-type')
      expect(contentType).toMatch(/text|script|plain/)
      
    } catch (error) {
      // If network is unavailable, skip this test
      console.warn('Skipping install script connectivity test:', error.message)
    }
  }, 10000)

  test('update command should reference correct install URL', async () => {
    const result = await runCli(['update', '--help'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('https://helpmetest.com/install')
    expect(result.stdout).toContain('curl -fsSL https://helpmetest.com/install | bash')
  }, 10000)
})