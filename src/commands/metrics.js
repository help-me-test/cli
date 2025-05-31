/**
 * Metrics Command Implementation
 * 
 * This module handles the metrics command functionality for debugging
 * and testing system metrics collection.
 */

import { output } from '../utils/colors.js'
import { config, configUtils } from '../utils/config.js'
import { collectSystemMetrics, collectBasicMetrics, displaySystemMetrics } from '../utils/metrics.js'

/**
 * Metrics command handler
 * @param {Object} options - Command options
 * @param {boolean} options.basic - Show only basic metrics
 * @param {boolean} options.json - Output in JSON format
 * @param {boolean} options.verbose - Show detailed output
 */
async function metricsCommand(options) {
  configUtils.debug('Starting metrics command')
  
  try {
    if (!options.json) {
      output.title('System Metrics Collection')
      
      if (options.verbose) {
        output.section('Collection Configuration:')
        output.keyValue('Mode', options.basic ? 'Basic' : 'Full')
        output.keyValue('Format', options.json ? 'JSON' : 'Formatted')
        output.keyValue('Debug', config.debug ? 'Enabled' : 'Disabled')
        console.log()
      }
    }
    
    // Collect metrics based on mode
    const startTime = Date.now()
    const metrics = options.basic ? await collectBasicMetrics() : await collectSystemMetrics()
    const collectionTime = Date.now() - startTime
    
    if (options.json) {
      // Output raw JSON for programmatic use
      console.log(JSON.stringify(metrics, null, 2))
    } else {
      // Display formatted metrics
      displaySystemMetrics(metrics, !options.basic)
      
      if (options.verbose && !options.json) {
        console.log()
        output.section('Collection Performance:')
        output.keyValue('Collection Time', `${collectionTime}ms`)
        output.keyValue('Metrics Count', Object.keys(metrics).length)
        
        if (metrics.error) {
          output.warning(`Collection had errors: ${metrics.error}`)
        } else {
          output.success('All metrics collected successfully')
        }
      }
    }
    
    configUtils.debug(`Metrics collection completed in ${collectionTime}ms`)
    
  } catch (error) {
    output.error(`Failed to collect metrics: ${error.message}`)
    
    if (options.verbose) {
      output.section('Error Details:')
      console.error(error)
    }
    
    process.exit(1)
  }
}

export default metricsCommand