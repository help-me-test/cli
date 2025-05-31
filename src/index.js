#!/usr/bin/env node

/**
 * HelpMeTest CLI - Main entry point
 * 
 * This is the main CLI application that provides health check monitoring
 * functionality for the HelpMeTest platform.
 */

import { Command } from 'commander'
import healthCommand from './commands/health.js'
import metricsCommand from './commands/metrics.js'
import { colors, output } from './utils/colors.js'
import packageJson from '../package.json' with { type: 'json' }

const program = new Command()

// Configure the main program
program
  .name(colors.brand('helpmetest'))
  .description(colors.dim('HelpMeTest CLI tool for health check monitoring'))
  .version(packageJson.version)

// Register the health command
program
  .command('health')
  .description('Send a health check heartbeat to HelpMeTest monitoring')
  .argument('<name>', 'Unique identifier for this health check')
  .argument('<grace_period>', 'Time to wait before marking as down (e.g., 30s, 5m, 2h, 1d)')
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

// Add global help examples
program.addHelpText('after', `
${colors.subtitle('Examples:')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"database-backup"')} ${colors.argument('"5m"')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"api-server"')} ${colors.argument('"30s"')}
  ${colors.dim('$')} ${colors.highlight('ENV=production')} ${colors.command('helpmetest health')} ${colors.argument('"web-app"')} ${colors.argument('"1m"')}
  ${colors.dim('$')} ${colors.command('helpmetest health')} ${colors.argument('"backup-service"')} ${colors.option('--from-timer backup.timer')}
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