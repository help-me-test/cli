/**
 * System Metrics Collection Utility
 * 
 * Collects system metrics including CPU usage, memory usage, disk space,
 * hostname, and IP address for health check heartbeats.
 */

import os from 'os'
import { execSync } from 'child_process'
import { output } from './colors.js'
import { debug, config, getEnvironmentConfig } from './config.js'

/**
 * Get system hostname
 * @returns {string} System hostname
 */
const getHostname = () => {
  try {
    return os.hostname()
  } catch (error) {
    debug(config, `Error getting hostname: ${error.message}`)
    return 'unknown'
  }
}

/**
 * Get primary IP address
 * @returns {string} Primary IP address
 */
const getIpAddress = () => {
  try {
    const interfaces = os.networkInterfaces()
    
    // Look for non-internal IPv4 addresses
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and IPv6 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          return iface.address
        }
      }
    }
    
    // Fallback to localhost if no external interface found
    return '127.0.0.1'
  } catch (error) {
    debug(config, `Error getting IP address: ${error.message}`)
    return '127.0.0.1'
  }
}

/**
 * Get CPU usage percentage
 * @returns {Promise<number>} CPU usage percentage (0-100)
 */
const getCpuUsage = async () => {
  try {
    // Use load average as CPU indicator on Unix systems (instant, no wait needed)
    const loadAvg = getLoadAverage()
    if (loadAvg && loadAvg.length > 0) {
      const cpus = os.cpus().length
      // Convert 1-min load average to percentage (capped at 100%)
      const usage = Math.min(100, (loadAvg[0] / cpus) * 100)
      return Math.round(usage * 100) / 100
    }

    // Fallback: return 0 instead of waiting 100ms
    return 0
  } catch (error) {
    debug(config, `Error getting CPU usage: ${error.message}`)
    return 0
  }
}

/**
 * Get CPU info for usage calculation
 * @returns {Object} CPU timing information
 */
const getCpuInfo = () => {
  const cpus = os.cpus()
  
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0
  
  for (const cpu of cpus) {
    user += cpu.times.user
    nice += cpu.times.nice
    sys += cpu.times.sys
    idle += cpu.times.idle
    irq += cpu.times.irq
  }
  
  const total = user + nice + sys + idle + irq
  
  return { idle, total }
}

/**
 * Get memory usage information
 * @returns {Object} Memory usage statistics
 */
const getMemoryUsage = () => {
  try {
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    
    const usage = {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      percentage: Math.round((usedMemory / totalMemory) * 10000) / 100, // Round to 2 decimal places
    }
    
    debug(config, `Memory usage: ${usage.percentage}% (${formatBytes(usage.used)}/${formatBytes(usage.total)})`)
    
    return usage
  } catch (error) {
    debug(config, `Error getting memory usage: ${error.message}`)
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
    }
  }
}

/**
 * Get disk usage for the current working directory
 * @returns {Object} Disk usage statistics
 */
const getDiskUsage = () => {
  try {
    let command
    let parseOutput
    
    if (process.platform === 'win32') {
      // Windows: Use wmic to get disk space
      const drive = process.cwd().charAt(0)
      command = `wmic logicaldisk where caption="${drive}:" get size,freespace /value`
      parseOutput = parseWindowsDiskOutput
    } else {
      // Unix-like systems: Use df command
      command = `df -k "${process.cwd()}"`
      parseOutput = parseUnixDiskOutput
    }
    
    const output = execSync(command, { encoding: 'utf8', timeout: 5000 })
    const usage = parseOutput(output)
    
    debug(config, `Disk usage: ${usage.percentage}% (${formatBytes(usage.used)}/${formatBytes(usage.total)})`)
    
    return usage
  } catch (error) {
    debug(config, `Error getting disk usage: ${error.message}`)
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
    }
  }
}

/**
 * Parse Windows disk output from wmic
 * @param {string} output - Command output
 * @returns {Object} Disk usage statistics
 */
const parseWindowsDiskOutput = (output) => {
  const lines = output.split('\n')
  let freeSpace = 0
  let totalSpace = 0
  
  for (const line of lines) {
    if (line.includes('FreeSpace=')) {
      freeSpace = parseInt(line.split('=')[1], 10)
    } else if (line.includes('Size=')) {
      totalSpace = parseInt(line.split('=')[1], 10)
    }
  }
  
  const usedSpace = totalSpace - freeSpace
  const percentage = totalSpace > 0 ? Math.round((usedSpace / totalSpace) * 10000) / 100 : 0
  
  return {
    total: totalSpace,
    free: freeSpace,
    used: usedSpace,
    percentage,
  }
}

/**
 * Parse Unix df output
 * @param {string} output - Command output
 * @returns {Object} Disk usage statistics
 */
const parseUnixDiskOutput = (output) => {
  const lines = output.trim().split('\n')
  
  // Skip header line, get the data line
  const dataLine = lines[lines.length - 1]
  const parts = dataLine.split(/\s+/)
  
  // df output format: Filesystem 1K-blocks Used Available Use% Mounted-on
  const totalKB = parseInt(parts[1], 10)
  const usedKB = parseInt(parts[2], 10)
  const availableKB = parseInt(parts[3], 10)
  
  // Convert from KB to bytes
  const total = totalKB * 1024
  const used = usedKB * 1024
  const free = availableKB * 1024
  
  const percentage = total > 0 ? Math.round((used / total) * 10000) / 100 : 0
  
  return {
    total,
    free,
    used,
    percentage,
  }
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Get system platform information
 * @returns {Object} Platform information
 */
const getPlatformInfo = () => {
  try {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      type: os.type(),
      version: os.version ? os.version() : undefined,
    }
  } catch (error) {
    debug(config, `Error getting platform info: ${error.message}`)
    return {
      platform: 'unknown',
      arch: 'unknown',
      release: 'unknown',
      type: 'unknown',
    }
  }
}

/**
 * Get system uptime in seconds
 * @returns {number} System uptime in seconds
 */
const getUptime = () => {
  try {
    return os.uptime()
  } catch (error) {
    debug(config, `Error getting uptime: ${error.message}`)
    return 0
  }
}

/**
 * Get load average (Unix-like systems only)
 * @returns {Array<number>|null} Load averages [1min, 5min, 15min] or null on Windows
 */
const getLoadAverage = () => {
  try {
    if (process.platform === 'win32') {
      return null // Load average not available on Windows
    }
    return os.loadavg()
  } catch (error) {
    debug(config, `Error getting load average: ${error.message}`)
    return null
  }
}

/**
 * Collect all system metrics
 * @returns {Promise<Object>} Complete system metrics
 */
const collectSystemMetrics = async () => {
  debug(config, 'Collecting system metrics...')
  
  const startTime = Date.now()
  
  try {
    // Collect all metrics
    const [cpuUsage, memoryUsage, diskUsage] = await Promise.all([
      getCpuUsage(),
      Promise.resolve(getMemoryUsage()),
      Promise.resolve(getDiskUsage()),
    ])
    
    // Get environment configuration for custom data
    const envConfig = getEnvironmentConfig(config)
    
    const metrics = {
      hostname: getHostname(),
      ip_address: getIpAddress(),
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage.percentage,
      disk_usage: diskUsage.percentage,
      platform: getPlatformInfo(),
      uptime: getUptime(),
      load_average: getLoadAverage(),
      timestamp: new Date().toISOString(),
      collection_time_ms: Date.now() - startTime,
    }
    
    // Add environment if specified
    if (envConfig.environment) {
      metrics.environment = envConfig.environment
    }
    
    // Add custom health data if any
    if (Object.keys(envConfig.customData).length > 0) {
      metrics.custom_data = envConfig.customData
    }
    
    debug(config, `Metrics collected in ${metrics.collection_time_ms}ms`)
    
    return metrics
  } catch (error) {
    debug(config, `Error collecting system metrics: ${error.message}`)
    
    // Return basic metrics even if some collection fails
    const envConfig = getEnvironmentConfig(config)
    const fallbackMetrics = {
      hostname: getHostname(),
      ip_address: getIpAddress(),
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      platform: getPlatformInfo(),
      uptime: getUptime(),
      load_average: getLoadAverage(),
      timestamp: new Date().toISOString(),
      collection_time_ms: Date.now() - startTime,
      error: error.message,
    }
    
    // Add environment if specified
    if (envConfig.environment) {
      fallbackMetrics.environment = envConfig.environment
    }
    
    // Add custom health data if any
    if (Object.keys(envConfig.customData).length > 0) {
      fallbackMetrics.custom_data = envConfig.customData
    }
    
    return fallbackMetrics
  }
}

/**
 * Display system metrics in a formatted way
 * @param {Object} metrics - System metrics object
 * @param {boolean} detailed - Show detailed information
 */
const displaySystemMetrics = (metrics, detailed = false) => {
  output.section('System Metrics:')
  
  output.keyValue('Hostname', metrics.hostname)
  output.keyValue('IP Address', metrics.ip_address)
  output.keyValue('CPU Usage', `${metrics.cpu_usage}%`)
  output.keyValue('Memory Usage', `${metrics.memory_usage}%`)
  output.keyValue('Disk Usage', `${metrics.disk_usage}%`)
  
  if (metrics.environment) {
    output.keyValue('Environment', metrics.environment)
  }
  
  if (metrics.custom_data && Object.keys(metrics.custom_data).length > 0) {
    output.section('Custom Data:')
    Object.entries(metrics.custom_data).forEach(([key, value]) => {
      output.keyValue(key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value)
    })
  }
  
  if (detailed) {
    output.section('Platform Information:')
    output.keyValue('Platform', metrics.platform.platform)
    output.keyValue('Architecture', metrics.platform.arch)
    output.keyValue('Release', metrics.platform.release)
    output.keyValue('Type', metrics.platform.type)
    
    if (metrics.platform.version) {
      output.keyValue('Version', metrics.platform.version)
    }
    
    output.section('System Status:')
    output.keyValue('Uptime', formatUptime(metrics.uptime))
    
    if (metrics.load_average) {
      output.keyValue('Load Average', `${metrics.load_average.map(l => l.toFixed(2)).join(', ')}`)
    }
    
    output.keyValue('Collection Time', `${metrics.collection_time_ms}ms`)
    output.keyValue('Timestamp', metrics.timestamp)
    
    if (metrics.error) {
      output.warning(`Collection Error: ${metrics.error}`)
    }
  }
}

/**
 * Format uptime seconds to human readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  const parts = []
  
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  
  return parts.length > 0 ? parts.join(' ') : '< 1m'
}

/**
 * Validate metrics object structure
 * @param {Object} metrics - Metrics object to validate
 * @returns {boolean} True if metrics are valid
 */
const validateMetrics = (metrics) => {
  const requiredFields = [
    'hostname',
    'ip_address',
    'cpu_usage',
    'memory_usage',
    'disk_usage',
    'timestamp',
  ]
  
  return requiredFields.every(field => {
    const hasField = field in metrics
    if (!hasField) {
      debug(config, `Missing required metric field: ${field}`)
    }
    return hasField
  })
}

/**
 * Get lightweight metrics for frequent collection
 * @returns {Promise<Object>} Basic system metrics
 */
const collectBasicMetrics = async () => {
  debug(config, 'Collecting basic metrics...')
  
  try {
    const cpuUsage = await getCpuUsage()
    const memoryUsage = getMemoryUsage()
    const diskUsage = getDiskUsage()
    const envConfig = getEnvironmentConfig(config)
    
    const metrics = {
      hostname: getHostname(),
      ip_address: getIpAddress(),
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage.percentage,
      disk_usage: diskUsage.percentage,
      timestamp: new Date().toISOString(),
    }
    
    // Add environment if specified
    if (envConfig.environment) {
      metrics.environment = envConfig.environment
    }
    
    // Add custom health data if any
    if (Object.keys(envConfig.customData).length > 0) {
      metrics.custom_data = envConfig.customData
    }
    
    return metrics
  } catch (error) {
    debug(config, `Error collecting basic metrics: ${error.message}`)
    
    const envConfig = getEnvironmentConfig(config)
    const fallbackMetrics = {
      hostname: getHostname(),
      ip_address: getIpAddress(),
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      timestamp: new Date().toISOString(),
      error: error.message,
    }
    
    // Add environment if specified
    if (envConfig.environment) {
      fallbackMetrics.environment = envConfig.environment
    }
    
    // Add custom health data if any
    if (Object.keys(envConfig.customData).length > 0) {
      fallbackMetrics.custom_data = envConfig.customData
    }
    
    return fallbackMetrics
  }
}

// Export all functions
export {
  getHostname,
  getIpAddress,
  getCpuUsage,
  getMemoryUsage,
  getDiskUsage,
  getPlatformInfo,
  getUptime,
  getLoadAverage,
  collectSystemMetrics,
  collectBasicMetrics,
  displaySystemMetrics,
  validateMetrics,
  formatBytes,
  formatUptime,
}

// Export default object for convenience
export default {
  collectSystemMetrics,
  collectBasicMetrics,
  displaySystemMetrics,
  validateMetrics,
  getHostname,
  getIpAddress,
  getCpuUsage,
  getMemoryUsage,
  getDiskUsage,
  getPlatformInfo,
  getUptime,
  getLoadAverage,
  formatBytes,
  formatUptime,
}