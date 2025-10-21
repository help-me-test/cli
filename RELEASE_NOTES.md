# Release Notes

## v1.14.3 (2025-10-21)

### Bug Fixes

- **MCP URL Detection**: Fixed critical bug where `--url` option default value was overriding detected API URL, causing MCP server to always use production instead of detected environment (slava.helpmetest.com)
- **Debug Logging**: Added debug output to trace API URL detection during global authentication

## v1.14.2 (2025-10-21)

### Bug Fixes

- **Authentication**: Fixed MCP command authentication to properly detect and use correct API URL (helpmetest.com or slava.helpmetest.com), resolving "Invalid API token" errors for valid tokens
- **Centralized Auth**: Moved authentication logic to global entry point, eliminating redundant API calls and ensuring consistent URL detection across all commands
- **Health Command**: Health command now continues gracefully on authentication failures instead of exiting, allowing basic functionality without valid credentials

## v1.14.1 (2025-10-21)

### Bug Fixes

- **MCP Delete Test Tool**: Fixed runtime error where delete test tool was calling undefined `handleDelete` function instead of `handleDeleteTest`, preventing test deletion via MCP

## v1.14.0 (2025-10-21)

### New Features

- **API Caching**: Added user info caching to reduce redundant API calls and improve performance across commands
- **Cached User Info Access**: New `getCachedUserInfo()` function allows retrieving authenticated user data without additional API requests

### Improvements

- **API Detection**: Enhanced API URL detection to always try production first and validate company information before falling back to development environment
- **Installation Feedback**: Improved MCP installation notifications with success messages and detailed error information
- **Authentication Reliability**: Installation command now properly configures API token before authentication, reducing authentication failures
- **Status Collection**: Optimized status data collection to use centralized authentication flow, eliminating duplicate API calls

## v1.13.0 (2025-10-21)

### New Features

- **Smart API Detection**: Added automatic API URL detection that intelligently switches between production and development environments on authentication failure, improving developer experience

### Improvements

- **MCP Installation Tracking**: Enhanced MCP installation notifications to include hostname information for better analytics and debugging
- **Authentication Flow**: Refactored authentication logic to provide clearer error messages and automatic environment detection
- **CPU Metrics**: Optimized CPU usage calculation to use load average instead of time-based sampling, eliminating startup delays and improving responsiveness

## v1.12.0 (2025-10-19)

### New Features

- **Test Management**: Added separate tools for updating test content, name, and tags independently, providing more granular control over test modifications
- **Naming Standards**: Implemented comprehensive naming conventions for tests and tags with clear guidelines and examples to improve test organization
- **Authentication Validation**: Added upfront authentication testing when installing MCP or starting the server, providing immediate feedback on invalid tokens

### Improvements

- **Keywords System**: Refactored keywords command to fetch data directly from API, ensuring users always have access to the latest keyword documentation
- **Error Messages**: Enhanced authentication error messages with clear guidance on how to resolve token issues
- **Code Quality**: Simplified interactive session management and API interaction patterns for better maintainability
- **API Consistency**: Standardized parameter handling in interactive command execution using object destructuring

## v1.10.4 (2025-08-31)

### Improvements

- **Testing**: Fixed test execution and reliability issues in CI environments
- **Documentation**: Removed outdated documentation to streamline project structure
- **Build System**: Simplified build process for better maintainability and faster builds
- **Scripts**: Refactored build and deployment scripts for improved organization

## v1.10.3 (2025-08-30)

### Improvements

- **Documentation**: Removed outdated documentation files and simplified README for better clarity
- **Release Process**: Enhanced version bumping process for more reliable releases

## v1.10.2 (2025-08-29)

### Bug Fixes

- **Installation**: Fixed installation script issues for better reliability
- **Release Process**: Simplified release workflow for more streamlined deployments

## v1.10.1 (2025-08-28)

### Bug Fixes

- **MCP Integration**: Fixed MCP installation process and resolved publishing issues
- **Release Process**: Corrected publishing workflow to ensure reliable deployments

## v1.10.0 (2025-08-27)

### New Features

- **CLI Installation**: Added new install command for easier CLI setup and management
- **Enhanced Help**: Improved CLI help system with better guidance and examples

### Improvements

- **API Token Handling**: Enhanced API token override functionality when presented in CLI
- **MCP Server**: Refactored MCP server implementation for better performance and reliability
- **Build System**: Fixed build issues for more stable releases

## v1.9.1 (2025-07-22)

### New Features

- **Test Browser Integration**: Added test browser opening functionality, allowing users to open tests in browser by ID, name, or tag
- **Passkey Support**: Added passkey keyword support for modern authentication testing

### Improvements

- **Test Generation**: Disabled automatic comment line stripping from generated test cases for better test readability
- **Browser Workflow**: Integrated browser opening capabilities into test creation and modification workflows

## v1.9.0 (2025-07-21)

### New Features

- **Test Runs API**: Added new API functionality to retrieve test runs with detailed error information and comprehensive filtering options
- **Enhanced Interactive Feedback**: Implemented context-aware guidance for different command types in interactive sessions

### Improvements

- **User Experience**: Added tailored next steps and suggestions based on command type in interactive sessions
- **Error Handling**: Enhanced debugging tips for failed interactive commands with specific troubleshooting guidance
- **Infrastructure**: Updated deployment workflow to automatically restart installer after publishing
- **Documentation**: Cleaned up outdated test documentation and improved code organization

## v1.8.0 (2025-07-19)

### New Features

- **Test Runs API**: Added new API functionality to retrieve test runs with detailed error information
- **Enhanced MCP Server**: Improved test modification tool with more comprehensive guidance and context-specific help
- **Interactive Command Feedback**: Added context-aware guidance for different command types in interactive sessions

### Improvements

- **User Experience**: Enhanced interactive command feedback with tailored next steps based on command type
- **Documentation**: Improved descriptions for test modification and creation tools with clearer best practices
- **Error Handling**: Added more detailed error explanations and debugging tips for failed interactive commands

## v1.7.0 (2025-07-12)

### New Features

- **Test Modification Tool**: Added new MCP tool for modifying tests, providing enhanced test management capabilities
- **Documentation Improvements**: Enhanced MCP server documentation with comprehensive examples and usage guidelines

### Improvements

- **Test Environment**: Optimized test execution in CI environments by skipping certain integration tests in GitHub Actions
- **Code Quality**: Fixed code style issues in MCP HTTP integration tests for better maintainability
- **Test Reliability**: Updated version tests to match actual help text output for more reliable testing

## v1.6.0 (2025-07-05)

### New Features

- **Self-Update Functionality**: Added CLI self-update command that downloads and runs the official installer script
- **Version Management**: Implemented dedicated version command with detailed version information display
- **Command Utilities**: Enhanced version utilities for consistent version reporting across the application

### Improvements

- **Testing**: Added comprehensive integration tests for version and update commands
- **Debug Tools**: Implemented extensive test suite for debug test tools
- **Error Handling**: Fixed incorrect test expectations in MCP interactive command tests

## v1.5.0 (2025-07-05)

### New Features

- **Multi-tenant Support**: Added user-specific subdomain handling for improved multi-tenant deployments
- **Interactive Commands**: Implemented interactive Robot Framework command functionality for better developer experience
- **Test Operations**: Added detailed explanations for test operations to improve usability

### Improvements

- **Configuration**: Enhanced subdomain support for multi-tenant URL configurations
- **Logging**: Improved debug logging capabilities in API and status data modules
- **Documentation**: Updated documentation with latest features and usage examples

### Bug Fixes

- **API Integration**: Fixed import statement for config utilities
- **MCP Server**: Resolved API import issues for getUserInfo function
- **Tests**: Updated MCP integration workflow test imports for better reliability

## v1.4.7 (2025-06-30)

### Improvements

- **Release Process**: Further enhanced release notes management and distribution
- **Documentation**: Added more comprehensive installation instructions in standalone release notes
- **Build System**: Improved build and release scripts for better maintainability

### Bug Fixes

- **Release Workflow**: Fixed GitHub token authentication in release workflows
- **Publishing**: Resolved issues with release notes synchronization between repositories
- **Documentation**: Ensured consistent formatting across all documentation channels

## v1.4.6 (2025-06-30)

### Improvements

- **Release Process**: Enhanced release notes synchronization between cli-code and cli repositories
- **Documentation**: Improved release documentation consistency across all distribution channels
- **Publishing**: Streamlined publishing workflow to ensure detailed release notes are used everywhere

### Bug Fixes

- **Release Notes**: Fixed issue where help-me-test/cli repository was getting basic release notes instead of detailed ones
- **Publishing**: Corrected release script to use comprehensive release notes from RELEASE_NOTES.md

## v1.4.5 (2025-06-30)

### Improvements

- **Container Integration**: Enhanced health check command to isolate API failures from health status
- **Error Handling**: Improved error handling to ensure container orchestrators get accurate health status
- **Documentation**: Added guidance for Kubernetes readiness probe usage in different scenarios
- **Reliability**: Updated health check logic to prevent false negatives during API outages

### Bug Fixes

- **Health Check**: Fixed issue where API failures could incorrectly report healthy services as failing
- **MCP Server**: Improved error messages for network connectivity issues
- **Documentation**: Updated container integration documentation with best practices

## v1.4.0 (2025-06-28)

### New Features

- **Resource Management**: Added commands for deleting health checks and tests with comprehensive API integration
- **Undo Functionality**: Implemented undo capability for reversible operations, allowing users to restore deleted resources
- **Dry-Run Mode**: Added preview mode for deletion operations to verify actions before execution
- **Updates Feed Integration**: Enhanced integration with the updates feed system for operation tracking

### Improvements

- **Documentation**: Expanded documentation with detailed examples for resource management operations
- **API Utilities**: Added robust API utilities for deletion and restoration operations
- **Error Handling**: Improved error handling and user feedback for resource management operations

## v1.3.1 (2025-06-25)

### Improvements

- **Documentation**: Enhanced updates feed system documentation with comprehensive examples and integration details
- **Health Check Integration**: Improved health check integration with the updates monitoring system

### Bug Fixes

- **Health Check**: Fixed integration bugs in health check monitoring functionality
- **Updates Monitoring**: Resolved issues with updates monitoring integration in the MCP server

## v1.3.0 (2025-06-25)

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