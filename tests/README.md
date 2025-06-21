# HelpMeTest CLI Tests

This directory contains the Python test suite for the HelpMeTest CLI. Python is used exclusively for testing the CLI functionality.

## Test Structure

### Python Tests (in this directory)
- `test_health_check.py` - Health check functionality tests
- `pyproject.toml` - Python test dependencies and configuration
- `main.py` - Test runner utilities
- `version_utils.py` - Version testing utilities

### JavaScript Tests (in `../src/tests/`)
- `mcp-e2e.test.js` - MCP end-to-end tests
- `mcp-http-*.test.js` - HTTP transport tests
- `version-e2e.test.js` - Version testing

## Setup & Installation

### Python Test Environment
```bash
# Install Python test dependencies (using uv)
cd /Users/slava/work/helpmetest/cli/tests
uv pip install --upgrade --system -e .

# Or install specific packages
uv pip install --upgrade --system pydantic-ai[mcp] python-dotenv pytest pytest-asyncio
```

## Running Tests

### Python Tests
```bash
# Run from tests directory
cd /Users/slava/work/helpmetest/cli/tests
pytest

# Run specific test
pytest test_health_check.py

# Run with verbose output
pytest -v

# Run with debug output
DEBUG=1 pytest -v
```

### JavaScript Tests
```bash
# Run from CLI root
cd /Users/slava/work/helpmetest/cli
bun test

# Run specific test
bun test src/tests/mcp-e2e.test.js
```

## Test Configuration

### Environment Variables
Create a `.env` file in the CLI root with:
```bash
HELPMETEST_API_TOKEN="your-test-token-here"
HELPMETEST_API_URL="https://slava.helpmetest.com"
ENV="test"
DEBUG=1  # For verbose test output
```

### Test Categories
- **Integration Tests**: Test MCP server functionality with real API calls
- **End-to-End Tests**: Full workflow testing with AI agents
- **Health Check Tests**: Verify health check tool functionality

## Adding New Tests

1. **Python Tests**: Add to this directory with `test_` prefix
2. **JavaScript Tests**: Add to `../src/tests/` with `.test.js` suffix
3. **Follow naming conventions**: `test_feature_name.py` or `feature-name.test.js`
4. **Include proper async/await patterns for MCP tests**

## Notes

- Python is used exclusively for testing the CLI
- All Python dependencies are isolated to this directory
- Use `uv` for Python package management (not pip or virtualenv)
- JavaScript tests use Bun for execution