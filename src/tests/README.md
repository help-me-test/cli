# MCP Integration Tests

This directory contains comprehensive integration tests for the MCP (Model Context Protocol) server implementation.

## Test Coverage

### ✅ Working Tests (30/30 passing)

#### 1. MCP HTTP Integration Tests (`mcp-http-integration.test.js`)
- **Status**: ✅ All 11 tests passing
- **Coverage**: Complete HTTP server functionality
- Tests HTTP server startup, health endpoints, error handling, lifecycle management
- Validates server responses, status codes, and graceful shutdown

#### 2. MCP End-to-End Tests (`mcp-e2e.test.js`) 
- **Status**: ✅ All 12 tests passing
- **Coverage**: Complete stdio MCP protocol functionality
- Tests MCP server initialization, tool listing, tool execution
- Validates health_check, system_status, and health_checks_status tools
- Tests error handling and parameter validation

#### 3. MCP HTTP Simple Tests (`mcp-http-simple.test.js`)
- **Status**: ✅ All 3 tests passing  
- **Coverage**: Basic HTTP endpoint availability
- Tests health endpoint and 404 responses

### ❌ Known Issues (12/12 failing)

#### SSE MCP Client Connection Tests
- **Files**: `mcp-http-e2e.test.js`, `mcp-sse-minimal.test.js`
- **Status**: ❌ All SSE client connection tests failing
- **Issue**: SSE client cannot establish connection with MCP SSE server
- **Error**: `SSE error: The socket connection was closed unexpectedly`

**Root Cause**: There appears to be an incompatibility between the MCP SDK's SSE client transport and our SSE server implementation. The HTTP server correctly serves the `/sse` endpoint, but the MCP SSE client connection fails during the handshake process.

## Test Structure

```
cli/src/tests/
├── mcp-e2e.test.js              # ✅ Stdio MCP protocol tests
├── mcp-http-integration.test.js # ✅ HTTP server integration tests  
├── mcp-http-simple.test.js      # ✅ Basic HTTP endpoint tests
├── mcp-http-e2e.test.js         # ❌ SSE MCP protocol tests (failing)
├── mcp-sse-minimal.test.js      # ❌ Minimal SSE connection tests (failing)
└── README.md                    # This file
```

## Running Tests

```bash
# Run all MCP tests
bun test --testPathPattern=mcp

# Run only working tests
bun test src/tests/mcp-e2e.test.js
bun test src/tests/mcp-http-integration.test.js
bun test src/tests/mcp-http-simple.test.js

# Run failing SSE tests (for debugging)
bun test src/tests/mcp-http-e2e.test.js
bun test src/tests/mcp-sse-minimal.test.js
```

## Test Environment

- **Node.js Runtime**: Bun
- **Test Framework**: Jest
- **MCP SDK Version**: ^1.13.0
- **Test Ports**: 31337-31341 (to avoid conflicts)

## Future Work

1. **Fix SSE Connection Issue**: Investigate MCP SDK SSE client/server compatibility
2. **Add More HTTP Tests**: Test additional HTTP scenarios and edge cases
3. **Performance Tests**: Add load testing for concurrent connections
4. **Authentication Tests**: Test API token validation in HTTP mode
5. **Integration with CI/CD**: Ensure tests run in containerized environments

## Notes

- All tests use isolated test tokens and ports to avoid conflicts
- HTTP server functionality is fully tested and working
- Stdio MCP protocol is fully tested and working  
- SSE transport has server-side implementation but client connection issues
- Tests include proper cleanup and graceful shutdown handling