/**
 * Deploy Command
 *
 * Creates a deployment update to track deployments and link them to test failures
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { colors, output } from '../utils/colors.js'
import { apiPost, detectApiAndAuth } from '../utils/api.js'
import { log, error } from '../utils/log.js'

const execAsync = promisify(exec)

/**
 * Get git commit info
 * @returns {Promise<string>} Git commit description with branch
 */
const getGitCommitInfo = async () => {
  try {
    const { stdout: hash } = await execAsync('git rev-parse --short HEAD')
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD')
    const { stdout: message } = await execAsync('git log -1 --pretty=%B')

    const commitHash = hash.trim()
    const branchName = branch.trim()
    const commitMessage = message.trim().split('\n')[0]

    return `${branchName}@${commitHash}: ${commitMessage}`
  } catch (error) {
    return null
  }
}

/**
 * Deploy command handler
 * @param {string} app - App name
 * @param {Object} options - Command options
 */
export default async function deployCommand(app, options = {}) {
  if (!app) {
    output.error('App name is required')
    output.info('Usage: helpmetest deploy <app>')
    process.exit(1)
  }

  const environment = options.env || process.env.ENV || 'dev'
  let description = options.description

  output.info(`${colors.brand('HelpMeTest')} Deployment Update`)
  output.keyValue('App', app)
  output.keyValue('Environment', environment)

  if (!description) {
    output.dim('No description provided, fetching git commit info...')
    description = await getGitCommitInfo()

    if (!description) {
      output.error('Failed to get git commit info and no description provided')
      output.info('Please provide --description or run from a git repository')
      process.exit(1)
    }

    output.keyValue('Description', description)
  } else {
    output.keyValue('Description', description)
  }

  log('')

  if (options.dryRun) {
    output.info('Dry run mode - showing what would be created:')
    output.dim(JSON.stringify({
      type: 'deployment',
      data: {
        app,
        environment,
        description
      },
      tags: [`app:${app}`, `env:${environment}`, 'type:deployment']
    }, null, 2))
    return
  }

  try {
    // Detect correct API URL and authenticate
    await detectApiAndAuth(options.verbose)

    output.info('Creating deployment update...')

    const result = await apiPost('/api/updates', {
      type: 'deployment',
      data: {
        app,
        environment,
        description
      }
    }, 'Creating deployment update', options.verbose)

    output.success('✅ Deployment update created successfully!')
    output.keyValue('Update ID', result.update.id)
    output.keyValue('Timestamp', result.update.timestamp)

    if (options.verbose) {
      log('')
      output.section('Full Update:')
      log(JSON.stringify(result.update, null, 2))
    }
  } catch (error) {
    output.error(`❌ Failed to create deployment update: ${error.message}`)

    if (options.verbose) {
      error(error)
    }

    process.exit(1)
  }
}
