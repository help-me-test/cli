import fs from 'fs'

const logFile = '/tmp/mcp-debug.log'

export const log = (message) => {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}\n`
  try {
    fs.appendFileSync(logFile, line)
  } catch (e) {
    // Ignore write errors
  }
}

export const clearLog = () => {
  try {
    fs.writeFileSync(logFile, '')
  } catch (e) {
    // Ignore
  }
}
