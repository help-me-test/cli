#!/bin/bash
# Setup script for Python test environment

set -e

echo "🐍 Setting up Python test environment for HelpMeTest CLI..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install it first:"
    echo "curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Install Python test dependencies
echo "📦 Installing Python test dependencies..."
uv pip install --upgrade --system -e .

echo "✅ Python test environment setup complete!"
echo ""
echo "🧪 Run tests with:"
echo "  cd $(pwd)"
echo "  pytest"
echo ""
echo "📝 Make sure to create a .env file in the CLI root with your test token:"
echo "  HELPMETEST_API_TOKEN=your-token-here"