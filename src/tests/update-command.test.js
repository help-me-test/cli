/**
 * Update Command Tests
 * 
 * Tests the update command functionality including dry-run mode
 * and verbose output. Does not test actual updates to avoid
 * modifying the system during tests.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Update Command Tests', () => {
  const cliPath = path.resolve(__dirname, '../index.js')
  
  // Helper function to run CLI commands
  const runCli = (args, timeout = 10000) => {
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
      
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('Command timed out'))
      }, timeout)
      
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code, stdout, stderr })
      })
      
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
  }

  test('should show update help', async () => {
    const result = await runCli(['update', '--help'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Update HelpMeTest CLI to the latest version')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--verbose')
    expect(result.stdout).toContain('Examples:')
    expect(result.stdout).toContain('https://helpmetest.com/install')
    expect(result.stdout).toContain('Requirements:')
    expect(result.stdout).toContain('curl')
    expect(result.stdout).toContain('bash')
    expect(result.stderr).toBe('')
  }, 10000)

  test('should show dry-run output', async () => {
    const result = await runCli(['update', '--dry-run'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('HelpMeTest CLI')
    expect(result.stdout).toContain('Update')
    expect(result.stdout).toContain('Current version:')
    expect(result.stdout).toContain('Dry run mode')
    expect(result.stdout).toContain('curl -fsSL https://helpmetest.com/install | bash')
    expect(result.stdout).toContain('official HelpMeTest installer script')
    expect(result.stderr).toBe('')
  }, 10000)

  test('should show verbose dry-run output', async () => {
    const result = await runCli(['update', '--dry-run', '--verbose'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('HelpMeTest CLI')
    expect(result.stdout).toContain('Update')
    expect(result.stdout).toContain('Current version:')
    expect(result.stdout).toContain('Dry run mode')
    expect(result.stdout).toContain('curl -fsSL https://helpmetest.com/install | bash')
    expect(result.stdout).toContain('official HelpMeTest installer script')
    expect(result.stderr).toBe('')
  }, 10000)

  // Note: We don't test actual updates as that would modify the system
  // and potentially break the test environment. The dry-run tests above
  // verify that the command structure and help text are correct.

  test('update command should be available in help', async () => {
    const result = await runCli(['--help'])
    
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('Update to latest version')
  }, 10000)
})