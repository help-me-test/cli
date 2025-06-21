#!/bin/bash

# Generate MCP Documentation Script
# This script runs the real AI E2E tests to generate documentation

set -e

echo "🚀 Generating HelpMeTest MCP Server Documentation..."
echo ""

# Ensure we're in the CLI directory
cd "$(dirname "$0")/.."

# Create docs directory if it doesn't exist
mkdir -p docs

# Run the AI integration tests to generate documentation
echo "📝 Running AI integration tests..."
bun test src/tests/mcp-real-ai-e2e.test.js

echo ""
echo "✅ Documentation generated successfully!"
echo ""
echo "📄 Generated files:"
echo "   - docs/mcp-real-ai-examples.md"
echo ""
echo "🔗 You can now use these examples in:"
echo "   - Blog posts"
echo "   - User documentation"
echo "   - Integration guides"
echo "   - Marketing materials"
echo ""
echo "💡 The examples show real conversations between users and AI assistants"
echo "   using the HelpMeTest MCP server for monitoring and health checks."