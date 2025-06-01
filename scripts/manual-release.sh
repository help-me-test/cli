#!/bin/bash

# Manual release script for testing
# This script creates a GitHub release manually using the gh CLI

set -e

echo "🚀 Creating Manual Release"
echo "=========================="

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    echo "   Visit: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run 'gh auth login' first."
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Creating release for version: $VERSION"

# Build release assets
echo "🔨 Building release assets..."
bun run build:release

# Check if release assets exist
if [ ! -d "test-archives" ] || [ -z "$(ls -A test-archives)" ]; then
    echo "❌ No release assets found. Build may have failed."
    exit 1
fi

echo "📦 Found release assets:"
ls -la test-archives/

# Create release notes
cat > release-notes.md << EOF
# HelpMeTest CLI v${VERSION}

## 🚀 What's New

- Automated release with cross-platform binaries
- Support for Linux, macOS, and Windows platforms
- Single binary distribution with embedded runtime

## 📦 Downloads

Choose the appropriate binary for your platform:

### Linux
- **x86_64**: \`helpmetest-cli_Linux_x86_64.tar.gz\`
- **ARM64**: \`helpmetest-cli_Linux_arm64.tar.gz\`
- **i386**: \`helpmetest-cli_Linux_i386.tar.gz\`

### macOS
- **x86_64 (Intel)**: \`helpmetest-cli_Darwin_x86_64.tar.gz\`
- **ARM64 (Apple Silicon)**: \`helpmetest-cli_Darwin_arm64.tar.gz\`

### Windows
- **x86_64**: \`helpmetest-cli_Windows_x86_64.zip\`
- **ARM64**: \`helpmetest-cli_Windows_arm64.zip\`
- **i386**: \`helpmetest-cli_Windows_i386.zip\`

## 🔐 Verification

Verify your download using the provided checksums:
\`\`\`bash
sha256sum -c helpmetest-cli_${VERSION}_checksums.txt
\`\`\`

## 📖 Installation

### Linux/macOS
\`\`\`bash
# Download and extract
tar -xzf helpmetest-cli_Linux_x86_64.tar.gz

# Install to system path
sudo mv helpmetest /usr/local/bin/helpmetest
sudo chmod +x /usr/local/bin/helpmetest

# Verify installation
helpmetest --version
\`\`\`

### Windows
\`\`\`bash
# Extract the zip file
# Add helpmetest.exe to your PATH
# Or run directly: .\helpmetest.exe --version
\`\`\`

## 🛠️ Usage

\`\`\`bash
# Send a health check heartbeat
helpmetest health "my-service" "5m"

# View system metrics
helpmetest metrics

# Get help
helpmetest --help
\`\`\`

## 🔧 Requirements

- No external dependencies required (self-contained binary)
- Minimum system requirements: 64MB RAM, 100MB disk space
EOF

echo "📝 Release notes created"

# Create the release
echo "🚀 Creating GitHub release..."
gh release create v${VERSION} \
    --title "HelpMeTest CLI v${VERSION}" \
    --notes-file release-notes.md \
    test-archives/*

echo "✅ Release v${VERSION} created successfully!"
echo "🔗 View release: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/v${VERSION}"

# Clean up
rm -f release-notes.md

echo "🎉 Manual release completed!"