# MCP Test Management - AI-Powered Test Execution

## Overview

The HelpMeTest MCP server now includes powerful test management capabilities that allow your AI assistant to discover, organize, and execute your test suites through natural conversation.

## New MCP Tools

### `helpmetest_list_tests`
**Purpose:** Discover and list all available tests with their metadata
**Arguments:** None
**Returns:** Complete test inventory with IDs, names, descriptions, and tags

### `helpmetest_run_test`  
**Purpose:** Execute tests by name, tag, or ID with real-time results
**Arguments:** 
- `identifier` (required): Test name, tag (tag:tagname), or ID to run
**Returns:** Complete execution results with timing, status, and detailed logs

## Natural Language Examples

### Test Discovery
```
You: "What tests do I have available?"
AI: "You have 10 tests configured:
    
    🌐 Uptime Tests (tag: uptime):
    • netdata.helpmetest.com - Is netdata.helpmetest.com up?
    • login.helpmetest.com - Is login.helpmetest.com up?
    • ntfy.helpmetest.com - Is ntfy.helpmetest.com up?
    • helpmetest.com - Is helpmetest.com up?
    
    🔍 Functional Tests:
    • Google search (tag: keywords)
    • /docs (tag: docs)
    
    👤 User Journey Tests:
    • Login (tags: cuj, flaky)
    • Landing -> /docs (tags: landing, flaky)
    
    📋 Other Tests:
    • authorized
    • todos"

You: "Show me tests tagged with 'uptime'"
AI: "You have 4 uptime tests:
    • netdata.helpmetest.com (ID: w3yffj69d0j47bzcnj6eki)
    • login.helpmetest.com (ID: isopuekfypa3j3osz45kh9)
    • ntfy.helpmetest.com (ID: 0g5d9jbixfhg0p752t6z885d)
    • helpmetest.com (ID: pt178vwmfr5y9p3ev1dl9)
    
    These tests verify that your main services are responding."
```

### Test Execution by Tag
```
You: "Run all uptime tests"
AI: "Running all uptime tests...
    
    ✅ All 4 uptime tests PASSED!
    
    Results:
    • netdata.helpmetest.com: ✅ PASS (0.185s) - HTTP 200 OK
    • login.helpmetest.com: ✅ PASS (0.127s) - HTTP 204 No Content
    • ntfy.helpmetest.com: ✅ PASS (0.020s) - HTTP 200 OK
    • helpmetest.com: ✅ PASS (0.022s) - HTTP 200 OK
    
    📊 Summary:
    • Total execution time: 0.35 seconds
    • Success rate: 100% (4/4 passed)
    • All your sites are UP and responding correctly!"

You: "Execute critical user journey tests"
AI: "Running tests tagged with 'cuj'...
    
    Results:
    • Login: ❔ UNKNOWN - Test hasn't run recently
    
    📊 Summary:
    • 1 test executed
    • Status: Unknown (may need configuration)
    • Recommendation: Check test setup for Login flow"
```

### Test Execution by Name
```
You: "Run the Google search test"
AI: "Running 'Google search' test...
    
    ❌ Test FAILED
    • Test: Google search (keywords tag)
    • Duration: 2.3 seconds
    • Issue: Search functionality test failed
    • Keywords executed: 3 passed, 1 failed
    
    The test completed but encountered issues with the search automation,
    likely due to rate limiting or CAPTCHA protection."

You: "Execute the netdata health check"
AI: "Running 'netdata.helpmetest.com' test...
    
    ✅ Test PASSED!
    • Test: Is netdata.helpmetest.com up?
    • Duration: 0.185 seconds
    • Response: HTTP 200 OK in 17.9ms
    • Status: Healthy and responding normally"
```

### Test Execution by ID
```
You: "Run test ID w3yffj69d0j47bzcnj6eki"
AI: "Running test ID w3yffj69d0j47bzcnj6eki...
    
    ✅ Test PASSED!
    • Test: netdata.helpmetest.com - Is netdata.helpmetest.com up?
    • Duration: 0.185 seconds
    • Response: HTTP 200 OK in 17.9ms
    • Keywords: GET http://netdata.helpmetest.com (PASS, 17.9ms)
    • Status: Service is healthy and responding normally"
```

## Use Cases

### Pre-Deployment Verification
```
You: "Before I deploy, run all critical tests"
AI: "I'll run your critical tests. Let me check what you have available...
    
    Running uptime tests (4 tests) and user journey tests (2 tests)...
    
    ✅ Uptime Tests: 4/4 PASSED
    ✅ User Journey Tests: 1/2 PASSED (1 unknown)
    
    🎯 Deployment Status: READY
    All critical services are responding. One user journey test 
    needs configuration but won't block deployment."
```

### Development Workflow
```
You: "Test the search functionality"
AI: "Running search-related tests...
    
    Found 1 test: 'Google search' (keywords tag)
    
    ❌ Test FAILED
    • Duration: 2.3 seconds
    • Issue: Search automation failed
    • Likely cause: Rate limiting or CAPTCHA
    
    💡 Suggestion: This test may need updating for current search behavior."
```

### Monitoring & Health Checks
```
You: "Run a quick health check on all services"
AI: "Running all uptime tests for service health check...
    
    ✅ All services healthy!
    • netdata.helpmetest.com: 185ms
    • login.helpmetest.com: 127ms  
    • ntfy.helpmetest.com: 20ms
    • helpmetest.com: 22ms
    
    All response times are within normal ranges."
```

### Test Organization
```
You: "What test categories do I have?"
AI: "Your tests are organized into these categories:
    
    🌐 uptime (4 tests) - Service availability
    🔍 keywords (1 test) - Search functionality  
    📄 docs (1 test) - Documentation
    🚀 landing (1 test) - Landing pages
    👤 cuj (1 test) - Critical user journeys
    ⚠️ flaky (2 tests) - Tests that may be unstable
    
    You can run any category with: 'run [category] tests'"
```

## Advanced Features

### Detailed Execution Results
Each test execution provides:
- **Test Results**: Pass/fail status for each test
- **Performance Data**: Execution timing and response times
- **Keyword Logs**: Detailed step-by-step execution
- **Event Stream**: Complete test execution events
- **Error Analysis**: Detailed failure information when tests fail

### Tag-Based Organization
Tests can be organized using tags:
- `uptime` - Service availability tests
- `api` - API endpoint tests
- `cuj` - Critical user journey tests
- `keywords` - Search and functionality tests
- `docs` - Documentation tests
- `landing` - Landing page tests
- `flaky` - Tests that may be unstable

### Multiple Execution Methods
- **By Tag**: `tag:uptime` - Run all tests with specific tag
- **By Name**: `Google search` - Run specific test by name
- **By ID**: `w3yffj69d0j47bzcnj6eki` - Run test by unique ID

## Best Practices

### Test Organization
- Use descriptive tags to group related tests
- Keep test names clear and specific
- Document test purposes in descriptions

### AI Interaction
- Use natural language: "run uptime tests" vs "execute tag:uptime"
- Ask for test lists before running to understand what's available
- Use specific test names when you know them

### Development Workflow
- Run uptime tests before deployments
- Execute relevant test categories during development
- Use test results to guide debugging and fixes

## Troubleshooting

### No Tests Found
```
You: "What tests do I have?"
AI: "You currently have no tests configured. Tests are created through:
    • Robot Framework test files
    • HelpMeTest CLI test commands
    • Web interface test creation"
```

### Test Execution Failures
```
You: "Why did my test fail?"
AI: "The test failed because:
    • Network timeout (service not responding)
    • Authentication issues
    • Service returning error status
    • Test automation issues (CAPTCHA, rate limiting)
    
    Check the detailed logs for specific error messages."
```

### Performance Issues
```
You: "My tests are running slowly"
AI: "Test performance can be affected by:
    • Network latency to test targets
    • Service response times
    • Test complexity (browser automation vs simple HTTP)
    • Concurrent test execution
    
    Current execution time was X.X seconds, which is [normal/slow] for this test type."
```

## Integration Examples

### CI/CD Pipeline
```bash
# In your deployment script
echo "Running pre-deployment tests via AI..."
echo "run uptime tests" | your-ai-cli-tool

# Check exit code and proceed with deployment
if [ $? -eq 0 ]; then
    echo "Tests passed, proceeding with deployment"
    deploy.sh
else
    echo "Tests failed, aborting deployment"
    exit 1
fi
```

### Monitoring Alerts
```bash
# In your monitoring script
echo "check all critical services" | your-ai-cli-tool
```

### Development Workflow
```bash
# Before committing changes
echo "run tests related to my changes" | your-ai-cli-tool
```

---

The test management capabilities transform your AI assistant into a powerful test execution and monitoring companion, making it easy to verify system health, run test suites, and maintain quality through natural conversation.# MCP Test Management - AI-Powered Test Execution

## Overview

The HelpMeTest MCP server now includes powerful test management capabilities that allow your AI assistant to discover, organize, and execute your test suites through natural conversation.

## New MCP Tools

### `helpmetest_list_tests`
**Purpose:** Discover and list all available tests with their metadata
**Arguments:** None
**Returns:** Complete test inventory with IDs, names, descriptions, and tags

### `helpmetest_run_test`  
**Purpose:** Execute tests by name, tag, or ID with real-time results
**Arguments:** 
- `identifier` (required): Test name, tag (tag:tagname), or ID to run
**Returns:** Complete execution results with timing, status, and detailed logs

## Natural Language Examples

### Test Discovery
```
You: "What tests do I have available?"
AI: "You have 10 tests configured:
    
    🌐 Uptime Tests (tag: uptime):
    • netdata.helpmetest.com - Is netdata.helpmetest.com up?
    • login.helpmetest.com - Is login.helpmetest.com up?
    • ntfy.helpmetest.com - Is ntfy.helpmetest.com up?
    • helpmetest.com - Is helpmetest.com up?
    
    🔍 Functional Tests:
    • Google search (tag: keywords)
    • /docs (tag: docs)
    
    👤 User Journey Tests:
    • Login (tags: cuj, flaky)
    • Landing -> /docs (tags: landing, flaky)
    
    📋 Other Tests:
    • authorized
    • todos"

You: "Show me tests tagged with 'uptime'"
AI: "You have 4 uptime tests:
    • netdata.helpmetest.com (ID: w3yffj69d0j47bzcnj6eki)
    • login.helpmetest.com (ID: isopuekfypa3j3osz45kh9)
    • ntfy.helpmetest.com (ID: 0g5d9jbixfhg0p752t6z885d)
    • helpmetest.com (ID: pt178vwmfr5y9p3ev1dl9)
    
    These tests verify that your main services are responding."
```

### Test Execution by Tag
```
You: "Run all uptime tests"
AI: "Running all uptime tests...
    
    ✅ All 4 uptime tests PASSED!
    
    Results:
    • netdata.helpmetest.com: ✅ PASS (0.185s) - HTTP 200 OK
    • login.helpmetest.com: ✅ PASS (0.127s) - HTTP 204 No Content
    • ntfy.helpmetest.com: ✅ PASS (0.020s) - HTTP 200 OK
    • helpmetest.com: ✅ PASS (0.022s) - HTTP 200 OK
    
    📊 Summary:
    • Total execution time: 0.35 seconds
    • Success rate: 100% (4/4 passed)
    • All your sites are UP and responding correctly!"

You: "Execute critical user journey tests"
AI: "Running tests tagged with 'cuj'...
    
    Results:
    • Login: ❔ UNKNOWN - Test hasn't run recently
    
    📊 Summary:
    • 1 test executed
    • Status: Unknown (may need configuration)
    • Recommendation: Check test setup for Login flow"
```

### Test Execution by Name
```
You: "Run the Google search test"
AI: "Running 'Google search' test...
    
    ❌ Test FAILED
    • Test: Google search (keywords tag)
    • Duration: 2.3 seconds
    • Issue: Search functionality test failed
    • Keywords executed: 3 passed, 1 failed
    
    The test completed but encountered issues with the search automation,
    likely due to rate limiting or CAPTCHA protection."

You: "Execute the netdata health check"
AI: "Running 'netdata.helpmetest.com' test...
    
    ✅ Test PASSED!
    • Test: Is netdata.helpmetest.com up?
    • Duration: 0.185 seconds
    • Response: HTTP 200 OK in 17.9ms
    • Status: Healthy and responding normally"
```

### Test Execution by ID
```
You: "Run test ID w3yffj69d0j47bzcnj6eki"
AI: "Running test ID w3yffj69d0j47bzcnj6eki...
    
    ✅ Test PASSED!
    • Test: netdata.helpmetest.com - Is netdata.helpmetest.com up?
    • Duration: 0.185 seconds
    • Response: HTTP 200 OK in 17.9ms
    • Keywords: GET http://netdata.helpmetest.com (PASS, 17.9ms)
    • Status: Service is healthy and responding normally"
```

## Use Cases

### Pre-Deployment Verification
```
You: "Before I deploy, run all critical tests"
AI: "I'll run your critical tests. Let me check what you have available...
    
    Running uptime tests (4 tests) and user journey tests (2 tests)...
    
    ✅ Uptime Tests: 4/4 PASSED
    ✅ User Journey Tests: 1/2 PASSED (1 unknown)
    
    🎯 Deployment Status: READY
    All critical services are responding. One user journey test 
    needs configuration but won't block deployment."
```

### Development Workflow
```
You: "Test the search functionality"
AI: "Running search-related tests...
    
    Found 1 test: 'Google search' (keywords tag)
    
    ❌ Test FAILED
    • Duration: 2.3 seconds
    • Issue: Search automation failed
    • Likely cause: Rate limiting or CAPTCHA
    
    💡 Suggestion: This test may need updating for current search behavior."
```

### Monitoring & Health Checks
```
You: "Run a quick health check on all services"
AI: "Running all uptime tests for service health check...
    
    ✅ All services healthy!
    • netdata.helpmetest.com: 185ms
    • login.helpmetest.com: 127ms  
    • ntfy.helpmetest.com: 20ms
    • helpmetest.com: 22ms
    
    All response times are within normal ranges."
```

### Test Organization
```
You: "What test categories do I have?"
AI: "Your tests are organized into these categories:
    
    🌐 uptime (4 tests) - Service availability
    🔍 keywords (1 test) - Search functionality  
    📄 docs (1 test) - Documentation
    🚀 landing (1 test) - Landing pages
    👤 cuj (1 test) - Critical user journeys
    ⚠️ flaky (2 tests) - Tests that may be unstable
    
    You can run any category with: 'run [category] tests'"
```

## Advanced Features

### Detailed Execution Results
Each test execution provides:
- **Test Results**: Pass/fail status for each test
- **Performance Data**: Execution timing and response times
- **Keyword Logs**: Detailed step-by-step execution
- **Event Stream**: Complete test execution events
- **Error Analysis**: Detailed failure information when tests fail

### Tag-Based Organization
Tests can be organized using tags:
- `uptime` - Service availability tests
- `api` - API endpoint tests
- `cuj` - Critical user journey tests
- `keywords` - Search and functionality tests
- `docs` - Documentation tests
- `landing` - Landing page tests
- `flaky` - Tests that may be unstable

### Multiple Execution Methods
- **By Tag**: `tag:uptime` - Run all tests with specific tag
- **By Name**: `Google search` - Run specific test by name
- **By ID**: `w3yffj69d0j47bzcnj6eki` - Run test by unique ID

## Best Practices

### Test Organization
- Use descriptive tags to group related tests
- Keep test names clear and specific
- Document test purposes in descriptions

### AI Interaction
- Use natural language: "run uptime tests" vs "execute tag:uptime"
- Ask for test lists before running to understand what's available
- Use specific test names when you know them

### Development Workflow
- Run uptime tests before deployments
- Execute relevant test categories during development
- Use test results to guide debugging and fixes

## Troubleshooting

### No Tests Found
```
You: "What tests do I have?"
AI: "You currently have no tests configured. Tests are created through:
    • Robot Framework test files
    • HelpMeTest CLI test commands
    • Web interface test creation"
```

### Test Execution Failures
```
You: "Why did my test fail?"
AI: "The test failed because:
    • Network timeout (service not responding)
    • Authentication issues
    • Service returning error status
    • Test automation issues (CAPTCHA, rate limiting)
    
    Check the detailed logs for specific error messages."
```

### Performance Issues
```
You: "My tests are running slowly"
AI: "Test performance can be affected by:
    • Network latency to test targets
    • Service response times
    • Test complexity (browser automation vs simple HTTP)
    • Concurrent test execution
    
    Current execution time was X.X seconds, which is [normal/slow] for this test type."
```

## Integration Examples

### CI/CD Pipeline
```bash
# In your deployment script
echo "Running pre-deployment tests via AI..."
echo "run uptime tests" | your-ai-cli-tool

# Check exit code and proceed with deployment
if [ $? -eq 0 ]; then
    echo "Tests passed, proceeding with deployment"
    deploy.sh
else
    echo "Tests failed, aborting deployment"
    exit 1
fi
```

### Monitoring Alerts
```bash
# In your monitoring script
echo "check all critical services" | your-ai-cli-tool
```

### Development Workflow
```bash
# Before committing changes
echo "run tests related to my changes" | your-ai-cli-tool
```

---

The test management capabilities transform your AI assistant into a powerful test execution and monitoring companion, making it easy to verify system health, run test suites, and maintain quality through natural conversation.