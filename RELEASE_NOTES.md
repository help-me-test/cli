# Release Notes

## v1.23.1 (2026-01-21)

### Improvements

- **Proxy Fake Server Port**: Changed default fake server port from 3000 to 37331 to avoid conflicts with common development servers. The tutorial testing server now starts on an uncommon high-order port, eliminating port collision issues when running alongside your application.

## v1.23.0 (2026-01-21)

### New Features

- **Local Development Tunneling**: Test your localhost directly from robot tests with new `helpmetest proxy start` command. Tunnel public URLs to your local development server, enabling seamless integration testing without deploying to staging environments. Perfect for debugging production issues locally and iterating faster on features that require live testing.
- **Tunnel Management**: List all active proxy tunnels for your company with `helpmetest proxy list`, showing which domains are forwarding to which machines and ports. Maintain visibility across your team's local testing environments.
- **Tutorial Testing Server**: New `helpmetest proxy run-fake-server` launches a local demo server for learning and practicing Robot Framework tests. Great for tutorials, onboarding, and trying out testing workflows without needing a real application.

### Bug Fixes

- **Chat Message Display**: Fixed TaskList component to properly display messages below task lists in the interactive chat UI. Messages now render correctly with proper styling and spacing, improving communication clarity during interactive testing sessions.

## v1.22.1 (2026-01-18)

### Bug Fixes

- **CI Test Stability**: Fixed version test timeout in CI environment by increasing test timeout from 5s to 15s, preventing false failures in slower CI runners.
- **Repository Configuration**: Updated submodule URL to point to correct cli-code repository, fixing repository reference issues.
- **Flaky Test Skip**: Skipped flaky install script test in CI environment to improve build reliability.

## v1.21.0 (2026-01-17)

### New Features

- **Bidirectional Agent-UI Messaging**: Real-time ZMQ-based communication between AI assistants and users enables interactive workflows with immediate feedback. AI assistants can now send messages to users and receive responses during test execution, creating truly conversational testing experiences.
- **Batch MCP Tool Approval**: New init tool streamlines initial setup by triggering approval prompts for all MCP tools at once. Eliminates repetitive approval dialogs and gets you testing faster with a single "Always allow" for each tool category.
- **Idle Listening Mode**: AI assistants now wait for user messages when idle instead of ending conversations. Enables continuous back-and-forth collaboration without restarting sessions, perfect for iterative test development and debugging workflows.
- **Parallel Interactive Sessions**: Session-specific timestamp tracking allows multiple interactive debugging sessions to run simultaneously. Each session maintains its own state and can be resumed independently using timestamp parameters.
- **Network Request Debugging**: New debug parameter in interactive commands controls network request/response body visibility. When enabled, shows complete HTTP payloads for debugging API interactions and troubleshooting integration issues.
- **FakeMail Testing Documentation**: Comprehensive FakeMail documentation now auto-opens in artifacts during exploratory testing, providing ready-to-use patterns for email verification flows and temporary inbox testing.

### Improvements

- **Session Message Routing**: Room validation with session tracking prevents messages from being delivered to wrong sessions. Each interactive session gets isolated message routing for reliable multi-user and parallel session support.
- **Efficient Message Retrieval**: Replaced polling with wait-based message retrieval that blocks until messages arrive. Dramatically reduces unnecessary API calls while maintaining instant responsiveness when messages are sent.
- **Reliable Stream Processing**: Simplified error handling with increased timeout (from 30s to 180s) for stream processing, preventing premature timeouts during long-running test executions and large artifact operations.
- **Consistent AI Prompts**: Extracted shared prompt constants into reusable function ensuring AI assistants receive consistent instructions across different MCP tools. Improves response quality and reduces prompt drift.
- **Better Code Organization**: Moved keywords tool to documentation.js module for cleaner separation of concerns and easier maintenance of documentation-related functionality.
- **Enhanced Test Validation**: Improved validation guidance in exploratory and interactive testing modes helps AI assistants create more reliable tests with fewer syntax errors and better Robot Framework compliance.

### Bug Fixes

- **Interactive Status Display**: Fixed CommandNotification status display that was showing incorrect execution state during interactive sessions, now properly reflects command success/failure.
- **Session Naming Consistency**: Exploratory mode now uses room naming convention consistent with interactive mode, eliminating confusion and ensuring proper message routing across all testing workflows.
- **Tool Registration**: Fixed init tool to use _registeredTools for proper MCP tool registration instead of incorrect property access that was causing initialization failures.
- **Error Reporting**: Removed defensive error fallback that was hiding actual error messages, now lets errors surface cleanly for easier debugging and faster issue resolution.
- **Message Metadata**: Added company field to ZMQ messages for consistency with other message types, ensuring complete context is always available for message routing and filtering.

## v1.20.0 (2025-12-05)

### New Features

- **Windows Platform Support**: Full Windows support for editor detection including VS Code, Cursor, and Claude. Automatically checks both Program Files and AppData installation locations, and uses Windows-specific 'where' command for PATH detection.
- **Interactive Command Explanations**: Interactive debugging commands now require an explanation parameter, ensuring AI assistants always describe what each command does and why, providing better transparency during test development and making the testing process more understandable.
- **Existing Test Detection**: Exploratory testing now fetches and analyzes existing tests to avoid duplication. Shows relevant tests that match the URL or domain being tested, helping maintain consistent test coverage without redundant work.

### Improvements

- **Generic Exploratory Testing**: Complete rewrite removes hardcoded test scenarios and goal generation. Tool is now completely generic - AI analyzes page data and decides what to test based on actual content, making exploratory testing more flexible and intelligent.
- **Verbose Debugging by Default**: MCP command now defaults to verbose mode (verbose=true) for better out-of-the-box debugging experience. Debug information helps troubleshoot integration issues without requiring explicit flags.
- **Markdown Status Output**: Status tool responses now use compact markdown tables instead of verbose JSON, dramatically improving readability for AI assistants and making test results easier to understand at a glance.

### Bug Fixes

- **Editor Installation Check**: Removed blocking installation check that prevented MCP setup when editors weren't detected. All editor options now shown regardless of installation status, allowing users to prepare configurations for editors they'll install later.

## v1.19.2 (2025-11-28)

### Improvements

- **AI-Friendly Interactive Output**: Interactive debugging commands now return clean, structured markdown instead of overwhelming JSON. Output includes command execution status, page content, interactive elements table, browser activity (navigation, performance, network, console logs), making it dramatically easier for AI assistants to understand page state and create accurate tests.
- **Complete Console Log Visibility**: All console logs (error, warn, info, log, debug) now visible with emoji indicators and full messages - no more truncation. Helps quickly identify JavaScript errors, warnings, and debugging information during test development.
- **Precise Network Request Tracking**: All network requests now logged with millisecond-precision timestamps, HTTP status codes, methods, URLs, and durations. Status-based emojis (✅ success, ❌ client errors, 💥 server errors, 🐌 slow requests) make it easy to spot issues at a glance.
- **Full Element Text Display**: Interactive element text no longer truncated - see complete button labels, link text, and form field content. Essential for creating accurate test selectors and understanding page structure.
- **Smart Element Grouping**: Elements grouped by selector when the same selector supports multiple actions (click, hover, type), reducing visual clutter while maintaining complete information.

### Bug Fixes

- **Console Log Parsing**: Fixed array destructuring that was skipping the log level, causing console logs to not appear in output.
- **Network Event Processing**: Separated NetworkRequest event processing to prevent array length mismatches with other event types.
- **Element Text Truncation**: Removed 20-character limit on element text in interactive debugging, now shows full text for better test creation.

## v1.19.1 (2025-11-27)

### Improvements

- **Updated MCP Tools**: Refreshed MCP tool definitions to ensure compatibility with latest Claude Desktop and AI assistants.

## v1.19.0 (2025-11-26)

### New Features

- **Artifact Knowledge Base**: Added comprehensive artifact system for documenting and organizing test context. Create, update, and search artifacts like business analysis, page descriptions, API documentation, known errors, and exploratory testing results. AI assistants can now access structured domain knowledge to improve test creation and debugging.
- **Intelligent Exploratory Testing**: Complete rewrite of exploratory testing with smart priority-based workflow. Automatically identifies critical paths (authentication, payment, billing) and generates test plans. Tracks tested use cases, discovered bugs, and coverage in persistent artifacts.
- **Incremental Artifact Updates**: New partial update capability allows modifying specific artifact fields using dot notation (e.g., `testResults.-1` to append array items) without regenerating entire content, significantly reducing token usage and improving performance.

### Improvements

- **Domain Health Monitoring**: Enhanced test naming for domain uptime and SSL checks with cleaner formatting (no emojis) and URL tags for better organization. SSL and domain checks now prioritized as foundational Step 0 before other testing.
- **Authentication-First Testing**: Exploratory testing now prioritizes authentication flows (login/signup) as Priority 10, with credential collection and "Save as Authenticated User" patterns for testing protected features.
- **Optimized Event Handling**: Smart truncation of large event fields (html, content, logs) while preserving event structure and counts, preventing token limit issues while maintaining debugging context.
- **Robot Framework Boolean Syntax**: Fixed boolean comparisons to use proper two-space syntax (`==  True`, `==  False`) for reliable test execution.
- **Direct API Integration**: Replaced MCP handler calls with direct API calls in exploratory testing for better performance and simpler code flow.

### Bug Fixes

- **Interactive Session Management**: Removed premature Exit command instructions that were causing sessions to end unexpectedly. Sessions now remain active for continued iterative testing.

## v1.18.0 (2025-11-07)

### New Features

- **Enhanced Interactive Debugging**: Interactive sessions now persist across commands using timestamps, allowing you to debug complex flows step-by-step without losing context. Robot Framework streaming results are analyzed in real-time to provide immediate success/failure feedback.
- **Security-First Test Creation**: Test IDs are now automatically generated and cannot be manually specified, preventing security issues and ensuring data integrity across all test operations.

### Improvements

- **Intelligent API Authentication**: Multi-endpoint authentication automatically tries production first, then falls back to development environments, ensuring reliable connections without manual configuration.
- **Explicit Test Opening**: Opening tests now supports explicit parameters (id, name, tag) with clear error messages when multiple matches are found, eliminating ambiguity and improving user experience.
- **Better Error Analysis**: Interactive commands now extract useful content from Robot Framework results including page content, browser info, and errors, providing richer debugging information.
- **Dashboard URL Generation**: Test URLs are automatically constructed using the correct subdomain for your company, ensuring links always work regardless of environment.

## v1.17.0 (2025-11-04)

### New Features

- **Claude Desktop Integration**: Added seamless integration with Claude Desktop through .mcpb extension files. Use `helpmetest install mcp` and select "Claude Desktop" to create a one-click installation package that adds HelpMeTest MCP server directly to Claude Desktop.
- **Universal MCP Config**: New "Other (.mcp.json config)" option creates standard MCP configuration files that AI tools can automatically discover when placed in project folders. Perfect for any AI assistant that supports MCP auto-discovery.
- **Cross-Platform Claude Detection**: Improved Claude Desktop detection works reliably across macOS, Windows, and Linux using proper Node.js file system APIs instead of shell commands.

### Improvements

- **Enhanced MCP Manifest**: .mcpb files now include comprehensive metadata with proper tool descriptions, keywords, compatibility info, and detailed feature documentation for better discoverability in Claude Desktop's extension marketplace.
- **Dynamic Version Management**: MCP extension manifests automatically use the correct CLI version from `helpmetest --version`, ensuring consistency between development and compiled binary releases.
- **Better Installation UX**: Reorganized MCP installation options with Claude Desktop first, followed by Claude Code, VSCode, Cursor, and "Other" for .mcp.json config files.

### Bug Fixes

- **Fast-Fail Health Checks**: Reduced API timeout from 30s to 3s for faster health check responses and better user experience.

## v1.16.0 (2025-10-24)

### New Features

- **AI Debugging Assistant**: Added deployment timeline tool for AI assistants to help identify root causes of failures. When errors occur, AI can now automatically check if they started after a deployment and correlate them with specific releases, dramatically reducing debugging time.

### Bug Fixes

- **MCP Authentication**: Fixed authentication issue where MCP command would fail with "Invalid API token" error even when using a valid token. The token is now properly set before authentication check.
- **Installation URL**: Corrected installation script URL to use helpmetest.com instead of incorrect domain reference.

### Improvements

- **Code Quality**: Removed duplicate token configuration logic for cleaner, more maintainable codebase.

## v1.15.0 (2025-10-24)

### New Features

- **Deployment Tracking**: Added new `deploy` command to track deployments and correlate them with test failures. Create deployment updates with automatic git commit info, environment detection, and full integration with the dashboard timeline visualization.
- **Environment Auto-Detection**: Deploy command automatically detects environment from `--env` flag or `$ENV` variable, defaulting to 'dev' for seamless integration into CI/CD pipelines.
- **Git Integration**: Automatically extracts deployment description from git commit history (`branch@hash: message`) when description not provided.
- **Dry Run Mode**: Test deployment updates with `--dry-run` flag before creating them, perfect for validating CI/CD integration.

### Improvements

- **Deployment Correlation**: Link test failures to specific deployments by timestamp to quickly identify which release caused issues.

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