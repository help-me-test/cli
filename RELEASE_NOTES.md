# Release Notes

## v1.33.0 (2026-02-26)

### New Features

- **Browser-Based Authentication**: Added `helpmetest login` command for easy browser-based authentication. Instead of manually copying API tokens, simply run `helpmetest login` and the CLI opens your browser to authenticate. After signing in, your credentials are automatically saved and ready to use.
- **Logout Command**: Added `helpmetest logout` to remove saved authentication credentials from `~/.helpmetest/config.json`.

### Security Improvements

- **Session Security**: CLI login sessions are now server-generated instead of client-generated, preventing session hijacking attacks. Sessions are validated and tracked with state management (pending → completed → consumed) to ensure one-time use.

### Bug Fixes

- **Status Command Output**: Fixed "undefined" appearing in `helpmetest status` output when displaying tests and health checks. The log function now properly handles empty calls.

### Improvements

- **Better Error Messages**: Commands now direct users to run `helpmetest login` when authentication fails, making it clearer how to resolve auth issues.
- **Automatic Auth Handling**: Removed redundant configuration validation checks - authentication is now handled automatically when making API calls.

## v1.32.1 (2026-02-23)

### Bug Fixes

- **Health Check URL Parsing**: Fixed health check command failing with `GET localhost:port/path` syntax. The URL parser now correctly handles hostname:port combinations with paths (e.g., `GET localhost:9000/health`), resolving 120-second timeouts in Kubernetes liveness probes.

## v1.32.0 (2026-02-23)

### New Features

- **JSON Output Mode**: Added `--json` flag to `helpmetest test` command for streaming raw JSON events. This enables integration with other tools and scripts that need programmatic access to test execution data. Use `helpmetest test <test-name> --json` to get machine-readable output with all test events including start, keywords, and completion status.

### Bug Fixes

- **Test Completion Display**: Fixed issue where test completion status (✅ passed/❌ failed) was not displayed when tests completed. The CLI now properly handles both `end_test` and `end_suite` events to show final test results.
- **Variable Assignment Progress**: Fixed duplicate progress lines appearing for Robot Framework variable assignments (e.g., `${results}= Get Elements`). Variable assignment wrappers are now filtered out to show only actual keyword execution.

### Improvements

- **Stream Parsing**: Improved JSON event stream parsing to handle single objects per chunk instead of attempting newline-based splitting. This eliminates parse errors and ensures all events are properly processed.
- **Timer Cleanup**: Added proper cleanup of progress timers before process exit to prevent lingering timers in edge cases.
- **Exit Codes**: Enhanced exit code handling to properly detect final test status from both `end_test` and `end_suite` events, ensuring correct exit codes (0 for pass, 1 for fail) in all scenarios.

## v1.31.0 (2026-02-22)

### New Features

- **Interactive Skill Selection**: Added interactive agent selection when installing skills. Users can now choose which agent directories to install skills to, with preferences saved to `~/.helpmetest/agent-preferences.json` for future use.
- **Canonical Skill Location**: Refactored skill installation to use `.agents/skills` as the single source of truth with symlinks to other agent directories. This eliminates duplicate indexing and ensures all agents reference the same skill definitions.

### Bug Fixes

- **Validation Error Documentation**: Fixed keyword documentation display when validation errors occur in interactive mode. Users now see helpful documentation immediately when encountering validation issues.
- **Test Selector Validation**: Fixed # selector validation logic to properly handle test identifiers in various MCP operations.
- **Auth Caching**: Improved authentication caching to prevent unnecessary re-authentication during MCP server operations.

### Improvements

- **Stream Processing**: Simplified stream reading in API utilities to match frontend pattern, improving reliability of test result streaming.
- **Output Formatting**: Removed markdown formatting from MCP output to ensure clean, consistent display across different agent interfaces.
- **Code Cleanup**: Removed unused imports and dead code paths from MCP command handlers.

## v1.30.0 (2026-02-21)

### New Features

- **Claude Code MCP Integration**: MCP server now uses local scope when running in Claude Code, ensuring proper security context and .mcp.json configuration. This enables seamless integration with Claude Code's MCP client without manual configuration.

### Improvements

- **Simplified Test Tags**: Removed strict tag validation in favor of documentation-driven approach. Tests now only require `priority:` tag instead of both `type:` and `priority:`. This reduces friction when creating tests and eliminates sync issues between validation code and documentation. Tag categories simplified to: `project`, `role`, `feature`, `priority`, `url`.
- **Test Status Display**: Fixed inconsistent test run display formatting to ensure consistent output across different views.
- **Single Source of Truth**: Tag schema validation moved entirely to AI prompts, eliminating duplicate validation logic and ensuring documentation always matches behavior.

### Breaking Changes

None - tag schema changes are backwards compatible (less restrictive, not more).

## v1.29.8 (2026-02-21)

### Improvements

- **Test Coverage**: Added comprehensive integration tests for authentication fallback logic. Tests verify multi-environment token handling, prod-to-dev fallback when no company association exists, URL construction, and include specific regression tests for the v1.29.7 bug fix. All tests use real API calls without mocking.

## v1.29.7 (2026-02-21)

### Bug Fixes

- **Authentication Fallback**: Fixed authentication detection to continue trying endpoints when token is valid but has no company association. Previously, if a token existed in production without a company, it would stop there instead of trying dev environment. Now correctly falls back through all configured endpoints (prod → dev) until finding one with company association, ensuring tokens work across environments.

## v1.29.6 (2026-02-21)

### Bug Fixes

- **Authentication Error Handling**: Fixed `detectApiAndAuth` to never throw errors. Now returns partial user info with warnings when company is missing or all endpoints fail, allowing `-V` flag and health commands to work without valid authentication.
- **Debug Logging**: Fixed missing `debug` function import in config utilities, eliminating runtime errors during health check operations.

## v1.29.5 (2026-02-19)

### Bug Fixes

- **Test Suite**: Fixed health checks filtering test to correctly validate section headers instead of matching test names.

### Improvements

- **Release Process**: Simplified publish script to mirror releases from private to public repository instead of duplicating asset uploads.
- **CI/CD**: Restored GitHub Actions workflow for automated testing and releases.

## v1.29.4 (2026-02-18)

### Bug Fixes

- **CI/CD Output Formatting**: Fixed test command output when piped or redirected (e.g., `helpmetest test | cat`, `> file`, CI/CD pipelines). Tests now stream clean sequential output without cursor positioning escape codes or "NOT RUN" noise, making logs readable and automation-friendly.
- **Real-time Streaming**: Fixed stdout buffering in non-TTY environments to ensure test progress appears in real-time when piped, not just after completion.

### Improvements

- **Smart TTY Detection**: Automatically disables dynamic tables and in-place progress updates when output is piped or redirected, while preserving interactive features in terminal mode.
- **Debug Logging**: Added debug output for test execution status tracking to help troubleshoot test result issues.

## v1.29.3 (2026-02-18)

### Bug Fixes

- **Test ID Validation**: Fixed critical bug where MCP tool sent literal "new" as test ID when ID was undefined, causing tests to be created with ID "new" instead of requiring explicit IDs. Backend requires stable URL-safe identifiers - no auto-generation logic exists.

### Improvements

- **Code Quality**: Replaced conditional spread pattern with proper ramda `reject(isNil)` for cleaner object filtering when building test payloads.
- **Logging System**: Unified debug logging with company-specific log files, replaced console.* calls with proper log/error/debug functions throughout CLI commands.
- **Test Automation Workflow**: Added comprehensive instructions for full site testing automation including landing page discovery, auth acquisition, page enumeration, and test generation.

## v1.29.2 (2026-02-16)

### Bug Fixes

- **frpc Execution**: Fixed critical bug where frpc binary detection tried to execute `frpc --help` from PATH before checking if the binary exists, causing failures when frpc is not installed. Now correctly checks filesystem paths and returns absolute paths for execution, eliminating the need for frpc to be in PATH.

## v1.29.1 (2026-02-15)

### Bug Fixes

- **frpc Auto-Installation**: Fixed issue where frpc auto-installer failed to find the binary if the installer fell back to `~/.local/bin` or other PATH directories instead of `~/.helpmetest/bin`. The installer now properly checks all possible locations after auto-installation, ensuring frpc is found regardless of where it was installed.
- **Interactive Sessions**: Fixed session reuse bug after Exit command in MCP interactive mode, preventing stale session data from interfering with new sessions.
- **Test Results Display**: JavaScript return values now properly displayed in test result formatting, making debugging and test validation easier.
- **Status Table Layout**: Improved test status table readability by repositioning Duration and Stability columns next to Status column for easier scanning of timing and stability issues.
- **API Requests**: Replaced axios with native fetch for more reliable parallel streaming requests, reducing dependencies and improving performance.

## v1.29.0 (2026-02-14)

### New Features

- **Test Stability Metrics**: Status tool now includes stability metrics showing test reliability over time. Track pass rates and identify flaky tests that need attention, helping prioritize test maintenance and improve overall test suite quality.
- **Test Content Validation**: Automatic linting detects excessive Sleep commands in test content and suggests improvements. Tests with too many delays are flagged with warnings, encouraging more efficient test patterns and faster execution times.

### Improvements

- **Automatic Test Execution**: Tests now always run immediately after creation or update, providing instant feedback on test validity. No more manual test runs after making changes—see results right away and catch errors faster during test development.
- **Enhanced Status Formatting**: Test run results in status output now display with improved formatting and clearer presentation, making it easier to scan test history and identify patterns in test behavior.
- **Smarter API Detection**: Health check command now automatically detects and authenticates with the correct API endpoint, switching between production and development environments as needed for seamless operation across different deployments.

### Bug Fixes

- **CI Test Reliability**: Disabled flaky artifact upsert tests in CI environments that were failing due to backend issues, improving build stability and reducing false test failures.

## v1.28.0 (2026-02-13)

### New Features

- **Parallel Test Execution**: Run multiple tests simultaneously for faster feedback. Pass an array of test IDs to `helpmetest_run_test` to execute tests in parallel with Promise.allSettled. Individual results are shown for each test, followed by a comprehensive summary showing passed/failed/errored counts. Perfect for running smoke test suites or validating multiple features at once.
- **Verbose Test Inspection**: View complete test content and descriptions without executing tests using the new `verbose` parameter in `helpmetest_status`. See Robot Framework keywords, test descriptions, and full implementation details to review tests, understand logic, or prepare for modifications—all without triggering actual test runs.
- **Smart ID Filtering**: Filter status output by test ID, health check name, or deployment ID using the new `id` parameter. Pass a single ID or an array to focus on specific resources. Combine with `verbose` mode to get detailed information about particular tests, making test investigation and debugging more efficient.
- **Streamlined MCP Interface**: Reduced MCP tool count from 32 to 21 essential methods by removing duplicate and rarely-used tools. Consolidated overlapping functionality (`status_test`, `status_health`, `health_checks_status` merged into unified `status` tool). Cleaner API surface makes it easier for AI assistants to choose the right tool for each task.
- **First-Run Approval Tracking**: MCP init tool now tracks when it has been run and skips repeated tool approval prompts. State is persisted to `~/.helpmetest/mcp-state.json`, preventing the need to approve the same tools every time you restart your IDE or MCP client. One-time approval per tool for seamless ongoing usage.

### Improvements

- **Unified Test Management**: All test operations now use consistent `id` parameter instead of mixed `identifier` naming. Simplified parameter conventions across run, delete, and status operations make the API more predictable and easier to use.
- **Enhanced Status Tool Options**: Added `testsOnly` and `healthOnly` filters to show specific resource types. New `includeRuns` and `includeDeployments` options with configurable limits let you see test execution history and deployment timeline directly in status output. Complete system visibility in a single tool call.
- **Simplified Tool Descriptions**: Removed verbose AI-specific instructions from tool descriptions, focusing on concise functional descriptions. Cleaner documentation improves tool selection and reduces cognitive load for AI assistants.
- **Comprehensive Test Coverage**: Added 30 automated tests validating all MCP refactoring changes including duplicate removal, parameter consistency, enhanced status filters, parallel execution, and artifact upsert merging. Ensures stability and prevents regressions across the refactored API.

### Breaking Changes

- **Removed Duplicate Methods**: The following duplicate MCP tools have been removed in favor of the unified `helpmetest_status` tool:
  - `helpmetest_status_test` → use `helpmetest_status` with `testsOnly: true`
  - `helpmetest_status_health` → use `helpmetest_status` with `healthOnly: true`
  - `helpmetest_health_checks_status` → use `helpmetest_status` with `healthOnly: true`
  - `helpmetest_get_test_runs` → use `helpmetest_status` with `includeRuns: true`
  - `helpmetest_get_deployments` → use `helpmetest_status` with `includeDeployments: true`
  - `helpmetest_health_check` → use health check endpoints directly
  - `helpmetest_update` → use CLI update command or standard installation
- **Removed Non-Essential Artifact Methods**: The following artifact tools were rarely used and have been removed:
  - `helpmetest_get_artifact_stats` → use `helpmetest_search_artifacts` with filters
  - `helpmetest_get_artifact_tags` → tags are returned with artifacts in search
  - `helpmetest_get_linked_artifacts` → use `helpmetest_get_artifact` with `includeLinked: true`
  - `helpmetest_partial_update_artifact` → merged into `helpmetest_upsert_artifact` (use with only `id` and `content` parameters for partial updates)
- **Artifact Search Renamed**: `helpmetest_list_artifacts` has been renamed to `helpmetest_search_artifacts` to better reflect its filtering capabilities. Functionality remains unchanged.
- **Parameter Naming**: Test operations now consistently use `id` parameter instead of `identifier` for better API coherence across all methods.

## v1.27.0 (2026-02-08)

### New Features

- **Deploy Tracking via MCP**: AI assistants can now create deployment records using the `helpmetest_deploy` MCP tool. Track when code is deployed to correlate test failures with specific deployments, helping identify which changes caused issues. Deployment records are automatically tagged by app and environment for easy filtering.
- **CLI Self-Update via MCP**: The new `helpmetest_update` MCP tool lets AI assistants update the CLI to the latest version. After updating, restart the MCP server to use the new version. Keeps your tooling current without manual intervention.
- **Screenshot Persistence**: Interactive testing sessions now save screenshots to temporary storage (`tmpdir/helpmetest/screenshots/`) when screenshot mode is enabled. File paths are logged to console, making it easy to access and review captured screenshots for debugging and documentation.

### Improvements

- **Clearer CLI Description**: Updated main CLI description from "health check monitoring" to "Test automation, health monitoring, and AI-powered debugging" to better reflect the full scope of capabilities available.
- **Complete Help Documentation**: Added missing commands to help examples including `install mcp`, `proxy start/list/run-fake-server`, and `agent claude`. All CLI commands are now properly documented in the built-in help.
- **Reliable Proxy Cleanup**: Refactored proxy cleanup to use a global signal handler registry, ensuring tunnels are properly deregistered even when multiple signals are received. Prevents cleanup handlers from conflicting or being called multiple times.

## v1.26.0 (2026-02-03)

### New Features

- **Dynamic Proxy Configuration**: Proxy commands now automatically use `proxyUrl` from user authentication instead of hardcoded server addresses. Your proxy tunnels connect to the correct endpoint based on your environment automatically.

### Improvements

- **Efficient MCP Tool Calls**: The `run_interactive_command` MCP tool now accepts messages and tasks directly, reducing the number of tool calls needed for interactive debugging workflows. AI assistants can send commands more efficiently.
- **Server-Side MCP Instructions**: Verbose prompts for MCP tools moved to server-side with `how_to` references, enabling dynamic updates to AI agent behavior without CLI releases. Better instructions can be deployed independently.
- **Faster Default Model**: Changed default AI model from Sonnet to Haiku for faster responses and lower costs in typical scenarios. You can still specify Sonnet when you need more advanced reasoning.
- **Reliable Tunnel Cleanup**: Improved proxy tunnel cleanup with async signal handlers that properly deregister tunnels before exit. No more orphaned tunnel registrations when stopping proxies.

## v1.25.1 (2026-01-28)

### Bug Fixes

- **Deploy Command Authentication**: Fixed critical issue where `helpmetest deploy` command failed with "Company ID required" error. The deploy command was missing API URL detection logic, causing it to always use production URL instead of falling back to development environment when needed. Now properly detects the correct API endpoint just like other commands.
- **TaskList Stability**: Added stable IDs and updatedAt timestamps to TaskList items, preventing UI flicker and duplicate entries when tasks are updated frequently.
- **Test Result Formatting**: Fixed error handling in test markdown output to properly return formatted error messages instead of JSON objects when tests fail.

### Improvements

- **Event Listener Heartbeat**: The `listen_to_events` MCP tool now sends heartbeat signals every 3 seconds while listening, providing real-time confirmation that the AI assistant is actively monitoring for user messages and test status changes.
- **Interactive Session Timeouts**: Reduced default timeout for interactive commands from 5 seconds to 1 second for faster feedback. Commands requiring page navigation should specify longer timeouts (5-10 seconds) using the timeout parameter.
- **Centralized Instructions**: AI agents now fetch behavioral instructions from the server, enabling dynamic updates to agent behavior without CLI releases. Instructions for self-healing loops, browser automation, and test workflows can now be updated independently.

## v1.25.0 (2026-01-25)

### New Features

- **Unified Event Queue**: AI assistants can now monitor both user messages and test status changes from a single event queue. The new `listen_to_events` tool tracks test failures and recoveries in real-time, enabling self-healing agents that automatically detect and respond to test regressions without manual intervention.
- **Test Detail Viewing**: View complete test content and metadata without executing tests using the new Detail Mode in `status_test` tool. Pass an `id` parameter to inspect test descriptions, Robot Framework keywords, and configuration before running, making test review and debugging faster.
- **Proxy Lifecycle Management**: List all active proxy tunnels with `helpmetest proxy list` showing domain, port, and creation time. Stop individual tunnels by domain or all tunnels at once with `stop` and `stop_all` commands. Complete visibility and control over your local development tunnel infrastructure.

### Improvements

- **Reliable Process Cleanup**: Proxy tunnels now properly clean up frpc subprocesses when stopped. Switching from Node.js child_process to Bun.spawn with setInterval monitoring ensures frpc is always killed when the parent process receives SIGTERM/SIGINT, eliminating orphaned proxy processes.
- **Event-Driven Testing**: Test status changes (PASS→FAIL regressions, FAIL→PASS recoveries) automatically flow to AI assistants through the event queue. Emojis (📉 REGRESSION, 📈 RECOVERY, 🔄 CHANGE) make status changes instantly recognizable, accelerating debugging and incident response.
- **Better Error Context**: Interactive sessions now store the last used room, providing helpful hints in error messages when send_to_ui is required but missing. Reduces confusion during multi-step debugging workflows.

### Bug Fixes

- **Process Orphaning**: Fixed critical issue where frpc processes remained running as orphans after parent proxy process terminated. Now uses synchronous cleanup handler that kills frpc before parent exits, with setInterval keeping parent alive until frpc fully terminates.
- **Test Result Formatting**: Fixed edge case where tests without end_test events would return raw result objects instead of formatted output. Now properly extracts and formats test results even when streaming events are incomplete.

## v1.24.0 (2026-01-25)

### New Features

- **MCP Heartbeat Mechanism**: Added active listening indicator that proves AI assistants are actively waiting for user messages. Heartbeat messages sent every 30 seconds during idle listening show real-time connection status, eliminating uncertainty about whether the assistant is still responsive.
- **Proxy Connection Retry Logic**: Enhanced proxy tunnel resilience with automatic retry on connection failures. Retries up to 3 times with exponential backoff when frpc client fails to start, dramatically improving tunnel stability on flaky networks.

### Improvements

- **Enhanced Fake Server Design**: Updated proxy fake server UI to match helpmetest.com aesthetic with black backgrounds, glassmorphism effects, green accents (#5aff28), and SF Pro Text typography. Creates a cohesive brand experience across all HelpMeTest interfaces.

### Bug Fixes

- **JSON-RPC Protocol Compliance**: Fixed critical stdout pollution bug where non-JSON output was breaking MCP protocol communication. MCP server now properly routes all logs to stderr, ensuring clean JSON-RPC messages on stdout for reliable AI assistant integration.
- **Proxy Port Configuration**: Corrected port configuration validation to properly use PROXY_PORT environment variable instead of hardcoded values, fixing tunnel connectivity issues when custom ports are specified.

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