/**
 * Version Command Tests
 * 
 * Tests the version command functionality including both the command
 * and the -V/--version flags.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import packageJson from '../../package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Version Command Tests', () => {
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

  test('should show version with -V flag', async () => {
    const result = await runCli(['-V'])
    
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(packageJson.version)
    expect(result.stderr).toBe('')
  }, 10000)

  test('should show version with --version flag', async () => {
    const result = await runCli(['--version'])
    
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(packageJson.version)
    expect(result.stderr).toBe('')
  }, 10000)

  test('should show version with version command', async () => {
    const result = await runCli(['version'])
    
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe(packageJson.version)
    expect(result.stderr).toBe('')
  }, 10000)

  test('should show detailed version with version --verbose', async () => {
    const result = await runCli(['version', '--verbose'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(packageJson.version)
    expect(result.stdout).toContain(packageJson.name)
    expect(result.stdout).toContain('helpmetest.com')
    expect(result.stdout).toContain('github.com')
    expect(result.stderr).toBe('')
  }, 10000)

  test('should handle version command help', async () => {
    const result = await runCli(['version', '--help'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Show version information')
    expect(result.stdout).toContain('--verbose')
    expect(result.stdout).toContain('Examples:')
    expect(result.stderr).toBe('')
  }, 10000)

  test('version should match package.json', () => {
    // Ensure the version in package.json is valid semver
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(packageJson.name).toBe('helpmetest-cli')
  })
})