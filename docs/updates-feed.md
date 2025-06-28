# Updates Feed Integration

This guide covers the new company updates feed system, which provides real-time activity tracking and test restoration capabilities.

## Overview

The updates feed system provides a comprehensive audit trail and real-time activity feed for companies. It transforms test deletion into a soft delete with full restoration capabilities, while establishing a company-wide activity feed that tracks all meaningful business events across services.

## MCP Tools

### `helpmetest_updates`
**Purpose:** Get recent company updates from the updates feed
**Arguments:**
- `limit` (optional, default: 20): Number of updates to retrieve
- `tags` (optional): Filter updates by specific tags (e.g., "test:deletion")
**Returns:** Recent company updates with tags, data, and timestamps

### `helpmetest_restore_test`
**Purpose:** Restore a previously deleted test from the updates feed
**Arguments:**
- `update_id` (required): ID of the update record containing the deleted test data
**Returns:** Restoration status and restored test details

## Natural Language Examples

### Viewing Recent Updates
```
You: "Show me recent company updates"
AI: "Here are the 5 most recent updates for your company:

    🔄 Test Deletion (2 minutes ago)
    • Test: 'Login Flow' was deleted by user@example.com
    • Tags: test:deletion, severity:info
    • ID: update-12345 (click to view details)

    ⚠️ Health Check Warning (15 minutes ago)
    • Service: 'api-server' is experiencing high latency
    • Tags: healthcheck:warning, severity:warning
    • Response time: 2.5s (above threshold of 1s)

    ✅ Test Restoration (30 minutes ago)
    • Test: 'Homepage Navigation' was restored by admin@example.com
    • Tags: test:restoration, severity:info
    • Original deletion: 45 minutes ago

    You can filter updates by type using 'Show me updates with tag:X'"
```

### Restoring Deleted Tests
```
You: "I accidentally deleted the Login Flow test, can I get it back?"
AI: "I found a recent deletion of 'Login Flow' test from 2 minutes ago.

    Would you like me to restore this test?
    • Test ID: test-789
    • Deleted by: user@example.com
    • Deletion time: June 25, 2025 at 15:30
    • Update ID: update-12345

    I can restore this test to its previous state."

You: "Yes, please restore it"
AI: "✅ Test 'Login Flow' has been successfully restored!
    
    • Original test ID: test-789 has been preserved
    • All test configurations and steps have been restored
    • Test is now active and available for execution
    
    You can run it with: helpmetest test 'Login Flow'"
```

### Filtering Updates by Tag
```
You: "Show me all test deletion events"
AI: "Here are the test deletion events from the past 7 days:

    🔄 Login Flow (2 minutes ago)
    • Deleted by: user@example.com
    • Tags: test:deletion, severity:info
    • Status: Restored (30 seconds ago)

    🔄 API Health Check (2 days ago)
    • Deleted by: admin@example.com
    • Tags: test:deletion, severity:info
    • Status: Permanently deleted

    🔄 Payment Processing (5 days ago)
    • Deleted by: user@example.com
    • Tags: test:deletion, severity:info
    • Status: Permanently deleted"
```

## Tag-Based Event Types

The updates system uses tags to classify events:

- `test:deletion` - Test deletion events
- `test:restoration` - Test restoration events
- `severity:info` - Informational updates
- `severity:warning` - Warning updates
- `severity:error` - Error updates
- `healthcheck:warning` - Health check warnings
- `healthcheck:error` - Health check errors

## Data Retention

Updates are retained for 7 days with full context, providing an audit trail of recent activities. After 7 days, updates are automatically removed from the system.

## Integration with Other Services

The updates feed integrates with:

- **Test Management**: Track test creation, deletion, and restoration
- **Health Checks**: Monitor service health status changes
- **Billing**: Track billing events and failures
- **User Management**: Track user activity and permissions changes

## WebSocket Integration

Updates are delivered in real-time via WebSocket connections, allowing for immediate notification of important events. The WebSocket API uses the same authentication as the REST API.