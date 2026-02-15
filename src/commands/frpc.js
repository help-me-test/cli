/**
 * frpc helper - ensures frpc binary is available using stew
 */

import { execSync } from 'child_process'
import { spawn } from 'bun'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { output } from '../utils/colors.js'

/**
 * Get path to frpc binary in helpmetest bin directory
 */
function getFrpcPath() {
  const binDir = join(homedir(), '.helpmetest', 'bin')
  const platform = process.platform
  const binaryName = platform === 'win32' ? 'frpc.exe' : 'frpc'
  return join(binDir, binaryName)
}

/**
 * Ensure frpc binary is available
 * @returns {Promise<string>} Path to frpc binary
 */
export async function ensureFrpc() {
  const binaryName = process.platform === 'win32' ? 'frpc.exe' : 'frpc'

  // Check ~/.local/bin first (where installer puts it)
  const localBinPath = join(homedir(), '.local', 'bin', binaryName)
  if (existsSync(localBinPath)) {
    return localBinPath
  }

  // Check ~/.helpmetest/bin (our fallback location)
  const frpcPath = getFrpcPath()
  if (existsSync(frpcPath)) {
    return frpcPath
  }

  // Not found, auto-install

  // Auto-install frpc using helpmetest installer
  output.info('frpc not found. Installing automatically...')

  const binDir = join(homedir(), '.helpmetest', 'bin')
  mkdirSync(binDir, { recursive: true })

  try {
    // Fetch install script
    output.info('Downloading frpc installer...')
    const response = await fetch('https://slava.helpmetest.com/install/frpc')
    if (!response.ok) {
      throw new Error(`Failed to download installer: ${response.status} ${response.statusText}`)
    }
    const installScript = await response.text()

    // Write script to temp file
    const scriptPath = join(tmpdir(), `frpc-install-${Date.now()}.sh`)
    writeFileSync(scriptPath, installScript, 'utf8')

    // Execute install script
    output.info('Installing frpc...')
    const installOutput = execSync(`bash ${scriptPath}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, OUT_DIR: binDir, DEBUG: process.env.DEBUG }
    })

    // Cleanup script
    unlinkSync(scriptPath)

    // Workaround: installer picks largest file (frps) instead of frpc
    // Check if the installed binary is actually frps and fix it
    if (existsSync(frpcPath)) {
      const testOutput = execSync(`${frpcPath} 2>&1 || true`, { encoding: 'utf8' })
      if (testOutput.includes('frps') || testOutput.includes('[frps/')) {
        output.info('⚠️  Installer installed wrong binary (frps), fetching correct one...')
        // Re-download and extract to get the correct frpc binary
        const response2 = await fetch('https://github.com/fatedier/frp/releases/download/v0.66.0/frp_0.66.0_' +
          (process.platform === 'darwin' ? 'darwin' : process.platform) + '_' +
          (process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : '386') + '.tar.gz')
        const buffer = Buffer.from(await response2.arrayBuffer())
        const tmpExtract = join(tmpdir(), `frp-extract-${Date.now()}`)
        mkdirSync(tmpExtract, { recursive: true })
        writeFileSync(join(tmpExtract, 'frp.tar.gz'), buffer)
        execSync(`cd ${tmpExtract} && tar xzf frp.tar.gz && find . -name frpc -type f -exec cp {} ${frpcPath} \\;`)
        execSync(`chmod +x ${frpcPath}`)
        execSync(`rm -rf ${tmpExtract}`)
      }
    }

    // Verify installation - check where installer put it
    // Check ~/.local/bin first (installer's preferred fallback)
    if (existsSync(localBinPath)) {
      output.info('✅ frpc installed successfully to ' + localBinPath)
      return localBinPath
    }

    // Check ~/.helpmetest/bin (our OUT_DIR)
    if (existsSync(frpcPath)) {
      output.info('✅ frpc installed successfully to ' + frpcPath)
      return frpcPath
    }

    // Not found - installation failed
    throw new Error('Installation completed but frpc not found in ~/.local/bin or ~/.helpmetest/bin')
  } catch (err) {
    output.error('Failed to auto-install frpc: ' + err.message)
    if (err.stderr) output.error('Stderr: ' + err.stderr)
    if (err.stdout) output.error('Stdout: ' + err.stdout)
    output.info('Please install manually:')
    output.info('  brew install frp  (macOS)')
    output.info('  or download from https://github.com/fatedier/frp/releases')
    process.exit(1)
  }
}

/**
 * Spawn frpc with given config
 * @param {Object} config - frpc configuration object
 * @param {Object} options - Spawn options
 * @returns {Promise<ChildProcess>} frpc process
 */
export async function spawnFrpc(config, options = {}) {
  const frpcPath = await ensureFrpc()

  // Write config to temp file
  const configPath = join(tmpdir(), `frpc-${Date.now()}.toml`)
  const configToml = generateToml(config)
  writeFileSync(configPath, configToml, 'utf8')

  // Debug: print config
  if (process.env.DEBUG) {
    console.log('Generated TOML config:')
    console.log(configToml)
    console.log('Config file:', configPath)
  }

  // Spawn frpc using Bun.spawn
  const { stdio, ...spawnOptions } = options
  const frpc = spawn([frpcPath, '-c', configPath], {
    ...spawnOptions,
    stdio: stdio ? (Array.isArray(stdio) ? stdio : [stdio, stdio, stdio]) : ['pipe', 'pipe', 'pipe']
  })

  // Cleanup config file when process exits
  frpc.exited.then(() => {
    try {
      unlinkSync(configPath)
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  return frpc
}

/**
 * Generate TOML config from JavaScript object
 * @param {Object} config - Configuration object
 * @returns {string} TOML string
 */
function generateToml(config) {
  const lines = []

  // Server configuration
  if (config.serverAddr) lines.push(`serverAddr = "${config.serverAddr}"`)
  if (config.serverPort) lines.push(`serverPort = ${config.serverPort}`)

  // Auth
  if (config.auth) {
    if (config.auth.method) lines.push(`auth.method = "${config.auth.method}"`)
    if (config.auth.token) lines.push(`auth.token = "${config.auth.token}"`)
  }

  // Log
  if (config.log) {
    if (config.log.level) lines.push(`log.level = "${config.log.level}"`)
  }

  // Transport
  if (config.transport) {
    if (config.transport.protocol) lines.push(`transport.protocol = "${config.transport.protocol}"`)
    if (config.transport.poolCount !== undefined) lines.push(`transport.poolCount = ${config.transport.poolCount}`)
  }

  lines.push('') // Empty line before proxies

  // Proxies
  if (config.proxies && config.proxies.length > 0) {
    config.proxies.forEach(proxy => {
      lines.push('[[proxies]]')
      if (proxy.name) lines.push(`name = "${proxy.name}"`)
      if (proxy.type) lines.push(`type = "${proxy.type}"`)
      if (proxy.localIP) lines.push(`localIP = "${proxy.localIP}"`)
      if (proxy.localPort) lines.push(`localPort = ${proxy.localPort}`)
      if (proxy.remotePort) lines.push(`remotePort = ${proxy.remotePort}`)
      if (proxy.customDomains) {
        lines.push(`customDomains = [${proxy.customDomains.map(d => `"${d}"`).join(', ')}]`)
      }
      if (proxy.subdomain) lines.push(`subdomain = "${proxy.subdomain}"`)
      lines.push('') // Empty line between proxies
    })
  }

  return lines.join('\n')
}
