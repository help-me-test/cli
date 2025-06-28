# Release Notes

## v1.4.0 (2024-06-29)

### New Features

- **Resource Management**: Added commands for deleting health checks and tests with comprehensive API integration
- **Undo Functionality**: Implemented undo capability for reversible operations, allowing users to restore deleted resources
- **Dry-Run Mode**: Added preview mode for deletion operations to verify actions before execution
- **Updates Feed Integration**: Enhanced integration with the updates feed system for operation tracking

### Improvements

- **Documentation**: Expanded documentation with detailed examples for resource management operations
- **API Utilities**: Added robust API utilities for deletion and restoration operations
- **Error Handling**: Improved error handling and user feedback for resource management operations

## v1.3.1 (2024-06-26)

### Improvements

- **Documentation**: Enhanced updates feed system documentation with comprehensive examples and integration details
- **Health Check Integration**: Improved health check integration with the updates monitoring system

### Bug Fixes

- **Health Check**: Fixed integration bugs in health check monitoring functionality
- **Updates Monitoring**: Resolved issues with updates monitoring integration in the MCP server

## v1.3.0 (2024-06-25)

### New Features

- **Updates API Integration**: Added support for the updates API endpoints, enabling real-time monitoring of system updates
- **MCP Server Enhancement**: Extended MCP server capabilities to handle updates monitoring integration

### Bug Fixes

- **MCP Server**: Fixed issues with updates monitoring integration in the MCP server
- **Keywords Command**: Improved reliability of the keywords command with updates system

## v1.2.0 (2024-06-XX)

### New Features

- **Enhanced MCP Server**: Significantly improved MCP server implementation with better functionality and performance
- **Command Structure**: Redesigned CLI command structure with more intuitive organization and help text
- **Ramda Integration**: Added Ramda.js library for more functional programming capabilities

### Improvements

- **Status Command**: Completely revamped status command with better data handling and presentation
- **Documentation**: Comprehensive updates to installation, usage, and MCP documentation
- **Release Process**: Unified release script for both manual and GitHub Actions workflows
- **Build System**: Streamlined build and release scripts for better maintainability

## v1.1.3 (2024-06-XX)

### Improvements

- **Command Structure**: Enhanced status command with dedicated subcommands for tests and health checks
- **MCP Integration**: Improved MCP tools with better descriptions and documentation
- **Output Formatting**: Refined JSON output handling for better consistency
- **Code Quality**: Refactored status data handling for improved maintainability

### Bug Fixes

- **Parameter Handling**: Fixed parameter handling in status command and related functions
- **JSON Output**: Corrected JSON output filtering for test and health subcommands

## v1.1.2 (2024-06-XX)

### Improvements

- **Release Process**: Unified release script for both manual and GitHub Actions workflows
- **Documentation**: Enhanced release notes generation with consistent formatting
- **Build**: Fixed template handling for cross-platform installation instructions

## v1.1.1 (2024-06-XX)

### Improvements

- **Installation**: Added one-line curl installation method for easier setup
- **Documentation**: Updated installation instructions in release notes

## v1.1.0 (2024-06-XX)

### New Features

- **Keywords Command**: Added new keywords command with MCP integration for searching and exploring Robot Framework keywords
- **Test Execution**: Added test execution command allowing users to run tests directly from the CLI
- **MCP Integration**: Comprehensive improvements to Model Context Protocol integration
  - Enhanced test management capabilities
  - Better status reporting and formatting
  - Improved error handling and user feedback

### Improvements

- **Output Formatting**: Improved test execution output formatting with better time display
- **Dynamic Tables**: Enhanced table rendering for status and test results
- **CI Integration**: Added test skipping functionality in CI environments for faster builds
- **Documentation**: Updated documentation to reflect new commands and features

### Bug Fixes

- Fixed status command output formatting and data display
- Improved error handling in MCP server communication
- Enhanced reliability of test execution in various environments

## v1.0.4 (Previous Release)

Initial public release with basic health check and status functionality.