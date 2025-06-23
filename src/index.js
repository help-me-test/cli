#!/usr/bin/env node

/**
 * HelpMeTest CLI - Main entry point
 * 
 * This is the main CLI application that provides health check monitoring
 * functionality for the HelpMeTest platform.
 */

// Load environment variables from .env file
import 'dotenv/config'

import { Command } from 'commander'
import healthCommand from './commands/health.js'
import statusCommand from './commands/status.js'
import metricsCommand from './commands/metrics.js'
import mcpCommand from './commands/mcp.js'
import keywordsCommand from './commands/keywords.js'
import { runTestCommand, listTestsCommand } from './commands/test.js'
import { colors, output } from './utils/colors.js'
import packageJson from '../package.json' with { type: 'json' }

const program = new Command()

program
  .name(colors.brand('helpmetest'))
  .description(colors.dim('HelpMeTest CLI tool for health check monitoring'))
  .version(packageJson.version)

// Register the health command
program
  .command('health')
  .description('Send health check heartbeats or view status of existing health checks')
  .argument('[name]', 'Unique identifier for this health check')
  .argument('[grace_period]', 'Time to wait before marking as down (e.g., 30s, 5m, 2h, 1d)')
  .argument('[command...]', 'Optional command to execute. The health check will use its exit code and execution time.')
  .option('--from-timer <timer>', 'Parse grace period from systemd timer file')
  .option('--dry-run', 'Show what would be sent without actually sending')
  .option('--verbose', 'Show detailed output')
  .addHelpText('after', `
${colors.subtitle('Detailed Examples:')}

${colors.dim('Basic Usage:')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"database-backup"')} ${colors.argument('"5m"')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"api-server"')} ${colors.argument('"30s"')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"web-app"')} ${colors.argument('"1h"')}

${colors.dim('With Environment Variables:')}
  ${colors.dim('$')} ${colors.highlight('ENV=production')} ${colors.command('helpmetest health')} ${colors.argument('"web-app"')} ${colors.argument('"1m"')}
  ${colors.dim('$')} ${colors.highlight('HELPMETEST_VERSION=1.2.3')} ${colors.command('helpmetest health')} ${colors.argument('"app"')} ${colors.argument('"2m"')}

${colors.dim('Systemd Timer Integration:')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"backup-service"')} ${colors.option('--from-timer backup.timer')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"cleanup-job"')} ${colors.option('--from-timer /etc/systemd/system/cleanup.timer')}

${colors.dim('Testing and Debugging:')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"test-service"')} ${colors.argument('"1m"')} ${colors.option('--dry-run')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"debug-app"')} ${colors.argument('"30s"')} ${colors.option('--verbose')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"test"')} ${colors.argument('"1m"')} ${colors.option('--dry-run --verbose')}

${colors.subtitle('Grace Period Formats:')}
  ${colors.key('30s')}     30 seconds
  ${colors.key('5m')}      5 minutes  
  ${colors.key('2h')}      2 hours
  ${colors.key('1d')}      1 day
  ${colors.key('15min')}   15 minutes (systemd format)
  ${colors.key('1.5h')}    1.5 hours

${colors.subtitle('Integration Examples:')}

${colors.dim('Cron Job (Database Backup):')}
  ${colors.dim('# /usr/local/bin/backup-db.sh')}
  ${colors.dim('#!/bin/bash')}
  ${colors.command('pg_dump mydb > /backups/db-$(date +%Y%m%d).sql')} ${colors.dim('&&')} \\
  ${colors.command('helpmetest health')} ${colors.argument('"database-backup"')} ${colors.argument('"25h"')}
  ${colors.dim('')}
  ${colors.dim('# Crontab entry')}
  ${colors.dim('0 2 * * *')} ${colors.command('/usr/local/bin/backup-db.sh')}

${colors.dim('Docker Healthcheck (Web App):')}
  ${colors.dim('HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\\\')}
  ${colors.dim('  CMD')} ${colors.command('curl -f http://localhost:3000/health')} ${colors.dim('&&')} \\
  ${colors.dim('      ')}${colors.command('helpmetest health')} ${colors.argument('"webapp-container"')} ${colors.argument('"2m"')} ${colors.dim('|| exit 1')}

${colors.dim('Kubernetes Liveness Probe (API Service):')}
  ${colors.dim('livenessProbe:')}
  ${colors.dim('  exec:')}
  ${colors.dim('    command:')}
  ${colors.dim('    - /bin/sh')}
  ${colors.dim('    - -c')}
  ${colors.dim('    - "curl -f http://127.0.0.1:8080/api/health && helpmetest health api-service 3m"')}
  ${colors.dim('  initialDelaySeconds: 30')}
  ${colors.dim('  periodSeconds: 60')}

${colors.dim('Systemd Service (Redis Monitor):')}
  ${colors.dim('[Service]')}
  ${colors.dim('ExecStartPost=/bin/bash -c "')}${colors.command('redis-cli ping')} ${colors.dim('| grep -q PONG &&')} \\
  ${colors.dim('                            ')}${colors.command('helpmetest health')} ${colors.argument('redis-service')} ${colors.argument('5m')}"

${colors.dim('Application Health Checks:')}
  ${colors.dim('$')} ${colors.command('curl -f https://api.example.com/health')} ${colors.dim('&&')} ${colors.command('helpmetest health')} ${colors.argument('"api-endpoint"')} ${colors.argument('"5m"')}
  ${colors.dim('$')} ${colors.command('systemctl is-active --quiet nginx')} ${colors.dim('&&')} ${colors.command('helpmetest health')} ${colors.argument('"nginx-service"')} ${colors.argument('"3m"')}
  ${colors.dim('$')} ${colors.command('nc -z localhost 5432')} ${colors.dim('&&')} ${colors.command('helpmetest health')} ${colors.argument('"postgres-connection"')} ${colors.argument('"2m"')}
`)
  .action(healthCommand)

// Register the status command
program
  .command('status')
  .description('Show status of all checks in the system')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Show detailed information including system metrics')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest status')}                      ${colors.dim('# Show current health check status')}
  ${colors.dim('$')} ${colors.command('helpmetest status')} ${colors.option('--json')}             ${colors.dim('# Output in JSON format')}
  ${colors.dim('$')} ${colors.command('helpmetest status')} ${colors.option('--verbose')}          ${colors.dim('# Show detailed information')}
  ${colors.dim('$')} ${colors.command('helpmetest status')} ${colors.option('--json --verbose')}   ${colors.dim('# JSON with all details')}
`)
  .action(statusCommand)

// Register the metrics command
program
  .command('metrics')
  .description('Display system metrics for debugging and testing')
  .option('--basic', 'Show only basic metrics (hostname, IP, CPU, memory)')
  .option('--json', 'Output metrics in JSON format')
  .option('--verbose', 'Show detailed collection information')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')}                    ${colors.dim('# Show all metrics in human-readable format')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--basic')}           ${colors.dim('# Show only essential metrics')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--json')}            ${colors.dim('# Output in JSON format')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--json --basic')}    ${colors.dim('# JSON output with basic metrics only')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--verbose')}         ${colors.dim('# Show detailed collection information')}

${colors.subtitle('Use Cases:')}
  ${colors.dim('•')} Debug health check data before sending
  ${colors.dim('•')} Verify system metrics collection
  ${colors.dim('•')} Test environment variable detection
  ${colors.dim('•')} Validate custom HELPMETEST_* variables
  ${colors.dim('•')} Monitor system resource usage
`)
  .action(metricsCommand)

// Register the keywords command
program
  .command('keywords')
  .description('Search and explore available Robot Framework keywords and libraries')
  .argument('[search]', 'Search term to filter keywords and libraries')
  .option('-t, --type <type>', 'Search type: keywords, libraries, or all', 'all')
  .option('--verbose', 'Show detailed information including documentation and parameters')
  .option('--json', 'Output results in JSON format')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')}                        ${colors.dim('# List all available keywords and libraries')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.argument('browser')}              ${colors.dim('# Search for browser-related keywords')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.argument('should')}               ${colors.dim('# Find assertion keywords')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.argument('click')} ${colors.option('--verbose')}      ${colors.dim('# Detailed info about click keywords')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.option('--type libraries')}       ${colors.dim('# Show only libraries')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.option('--type keywords')}        ${colors.dim('# Show only keywords')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.argument('api')} ${colors.option('--json')}           ${colors.dim('# JSON output for API keywords')}

${colors.subtitle('Search Types:')}
  ${colors.key('all')}         Search both keywords and libraries (default)
  ${colors.key('keywords')}    Search only Robot Framework keywords
  ${colors.key('libraries')}   Search only Robot Framework libraries

${colors.subtitle('Available Libraries:')}
  ${colors.dim('•')} ${colors.key('BuiltIn')}         Core Robot Framework keywords (assertions, variables, control flow)
  ${colors.dim('•')} ${colors.key('Browser')}         Web browser automation keywords (click, type, wait, navigate)
  ${colors.dim('•')} ${colors.key('RequestsLibrary')} HTTP/REST API testing keywords (GET, POST, status checks)

${colors.subtitle('Common Search Terms:')}
  ${colors.dim('•')} ${colors.highlight('should')}        Find assertion keywords (Should Be Equal, Should Contain, etc.)
  ${colors.dim('•')} ${colors.highlight('click')}         Find click-related keywords for UI automation
  ${colors.dim('•')} ${colors.highlight('get')}           Find keywords that retrieve information
  ${colors.dim('•')} ${colors.highlight('wait')}          Find timing and synchronization keywords
  ${colors.dim('•')} ${colors.highlight('log')}           Find logging and debugging keywords
  ${colors.dim('•')} ${colors.highlight('browser')}       Find web browser automation keywords
  ${colors.dim('•')} ${colors.highlight('api')}           Find HTTP/API testing keywords

${colors.subtitle('Output Information:')}
  ${colors.dim('•')} Keyword names and short descriptions
  ${colors.dim('•')} Library organization and keyword counts
  ${colors.dim('•')} Parameter information (with --verbose)
  ${colors.dim('•')} Full documentation text (with --verbose)
  ${colors.dim('•')} Clean, readable format without source paths

${colors.subtitle('Use Cases:')}
  ${colors.dim('•')} Discover available Robot Framework functionality
  ${colors.dim('•')} Find the right keywords for test automation tasks
  ${colors.dim('•')} Learn about library capabilities and organization
  ${colors.dim('•')} Get parameter information for keyword usage
  ${colors.dim('•')} Export keyword information for documentation
`)
  .action(async (search, options) => {
    await keywordsCommand(search, options)
  })

// Register the MCP command
program
  .command('mcp')
  .description('Start MCP (Model Context Protocol) server for AI integration')
  .argument('[token]', 'HelpMeTest API token (required)')
  .option('-u, --url <url>', 'HelpMeTest API base URL (optional)', 'https://helpmetest.com')
  .option('--sse', 'Use HTTP Server-Sent Events transport instead of stdio')
  .option('-p, --port <number>', 'Port for SSE transport', '31337')
  .option('-v, --verbose', 'Enable verbose logging')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest mcp')} ${colors.argument('HELP-abc123...')}                    ${colors.dim('# Start with stdio transport')}
  ${colors.dim('$')} ${colors.command('helpmetest mcp')} ${colors.argument('HELP-abc123...')} ${colors.option('--sse')}             ${colors.dim('# Use SSE transport')}
  ${colors.dim('$')} ${colors.command('helpmetest mcp')} ${colors.argument('HELP-abc123...')} ${colors.option('-u https://slava.helpmetest.com')} ${colors.dim('# Custom API URL')}
  ${colors.dim('$')} ${colors.command('helpmetest mcp')} ${colors.argument('HELP-abc123...')} ${colors.option('--verbose')}         ${colors.dim('# Enable verbose logging')}
  ${colors.dim('$')} ${colors.command('helpmetest mcp')} ${colors.argument('HELP-abc123...')} ${colors.option('--sse --port 8080')} ${colors.dim('# SSE on custom port')}

${colors.subtitle('Environment Variables (Alternative):')}
  ${colors.dim('You can also use environment variables instead of command line arguments:')}
  ${colors.dim('$')} ${colors.highlight('HELPMETEST_API_TOKEN=HELP-abc123...')} ${colors.command('helpmetest mcp')}
  ${colors.dim('$')} ${colors.highlight('HELPMETEST_API_TOKEN=HELP-abc123... HELPMETEST_API_URL=https://slava.helpmetest.com')} ${colors.command('helpmetest mcp')}

${colors.subtitle('Transport Types:')}
  ${colors.key('stdio')}    Standard input/output (for AI clients like Claude Desktop) - Default
  ${colors.key('sse')}      HTTP Server-Sent Events (for web-based integrations)

${colors.subtitle('Available Tools:')}
  ${colors.dim('•')} ${colors.key('health_check')}         Perform health checks on URLs
  ${colors.dim('•')} ${colors.key('system_status')}        Get system metrics and status
  ${colors.dim('•')} ${colors.key('health_checks_status')} Get status of all health checks
  ${colors.dim('•')} ${colors.key('run_test')}             Run a test by name, tag, or ID
  ${colors.dim('•')} ${colors.key('list_tests')}           List all available tests
  ${colors.dim('•')} ${colors.key('keywords')}             Search Robot Framework keywords and libraries

${colors.subtitle('Integration:')}
  ${colors.dim('Add to Claude Desktop config.json:')}
  ${colors.dim('{')}
  ${colors.dim('  "mcpServers": {')}
  ${colors.dim('    "helpmetest": {')}
  ${colors.dim('      "command": "helpmetest",')}
  ${colors.dim('      "args": ["mcp", "HELP-your-token-here"]')}
  ${colors.dim('    }')}
  ${colors.dim('  }')}
  ${colors.dim('}')}
`)
  .action(mcpCommand)

// Register the test command with subcommands
const testCommand = program
  .command('test')
  .description('Run tests or list available tests')

// Test run subcommand
testCommand
  .command('run')
  .description('Run a test by name, tag, or ID')
  .argument('<identifier>', 'Test name, tag (tag:tagname), or ID to run')
  .option('--verbose', 'Show detailed output')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('"My Test Name"')}         ${colors.dim('# Run test by name')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('tag:smoke')}              ${colors.dim('# Run all tests with "smoke" tag')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('abc123def456...')}        ${colors.dim('# Run test by ID')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('"API Test"')} ${colors.option('--verbose')}  ${colors.dim('# Run with detailed output')}

${colors.subtitle('Test Identifiers:')}
  ${colors.key('Name')}     Test name as shown in the web interface
  ${colors.key('Tag')}      Use ${colors.highlight('tag:tagname')} to run all tests with a specific tag
  ${colors.key('ID')}       Unique test identifier (long alphanumeric string)

${colors.subtitle('Output:')}
  ${colors.dim('•')} Test execution status (PASS/FAIL)
  ${colors.dim('•')} Execution time and duration
  ${colors.dim('•')} Streaming log output during execution
  ${colors.dim('•')} Exit code reflects test result (0=pass, 1=fail)
`)
  .action(async (identifier, options) => {
    await runTestCommand(identifier, options)
  })

// Test list subcommand
testCommand
  .command('list')
  .description('List all available tests')
  .option('--verbose', 'Show detailed information including descriptions and IDs')
  .addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest test list')}                    ${colors.dim('# List all available tests')}
  ${colors.dim('$')} ${colors.command('helpmetest test list')} ${colors.option('--verbose')}         ${colors.dim('# List tests with descriptions and IDs')}
`)
  .action(async (options) => {
    await listTestsCommand(options)
  })

// Default test command action (show help)
testCommand
  .action(() => {
    testCommand.outputHelp()
    process.exit(1)
  })

// Add global help examples
program.addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest health')}                         ${colors.dim('# Show status of all health checks')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"database-backup"')} ${colors.argument('"5m"')}  ${colors.dim('# Send heartbeat for specific check')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"api-server"')} ${colors.argument('"30s"')}      ${colors.dim('# Send heartbeat with 30s grace period')}
  ${colors.dim('$')} ${colors.highlight('ENV=production')} ${colors.command('helpmetest health')} ${colors.argument('"web-app"')} ${colors.argument('"1m"')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"backup-service"')} ${colors.option('--from-timer backup.timer')}
  ${colors.dim('$')} ${colors.command('helpmetest test list')}                    ${colors.dim('# List all available tests')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('"My Test"')}               ${colors.dim('# Run a specific test')}
  ${colors.dim('$')} ${colors.command('helpmetest test run')} ${colors.argument('tag:smoke')}              ${colors.dim('# Run tests with smoke tag')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.argument('browser')}                ${colors.dim('# Search Robot Framework keywords')}
  ${colors.dim('$')} ${colors.command('helpmetest keywords')} ${colors.option('--type libraries')}         ${colors.dim('# List available libraries')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--verbose')}
  ${colors.dim('$')} ${colors.command('helpmetest metrics')} ${colors.option('--json')} ${colors.option('--basic')}

${colors.subtitle('Environment Variables:')}
  ${colors.key('HELPMETEST_API_TOKEN')}    ${colors.error('Required.')} Your HelpMeTest API token
  ${colors.key('ENV')}                     ${colors.dim('Optional.')} Environment identifier (dev, staging, prod)
  ${colors.key('HELPMETEST_*')}            ${colors.dim('Optional.')} Custom data (any env var starting with HELPMETEST_)

${colors.subtitle('Use Cases:')}
  ${colors.dim('•')} Cron jobs and scheduled tasks
  ${colors.dim('•')} Docker container health checks
  ${colors.dim('•')} Kubernetes liveness probes
  ${colors.dim('•')} Systemd service monitoring
  ${colors.dim('•')} Web application availability monitoring

${colors.subtitle('More Information:')}
  ${colors.url('https://helpmetest.com/docs/healthchecks')}
`)

// Handle unknown commands
program.on('command:*', function (operands) {
  output.error(`Unknown command: ${colors.highlight(operands[0])}`)
  console.error(colors.dim('See --help for a list of available commands.'))
  process.exit(1)
})

// Parse command line arguments
program.parse()

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp()
  process.exit(0)
}