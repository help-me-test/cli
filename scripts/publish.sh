#!/bin/bash
# Publish CLI to help-me-test/cli repository
# Can be run locally for testing or in GitHub Actions

set -e

echo "🚀 Publishing HelpMeTest CLI..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI is required but not installed"
    exit 1
fi

# Check if we can access the CLI repo
if ! gh repo view help-me-test/cli &> /dev/null; then
    echo "❌ Cannot access help-me-test/cli repository"
    echo "Make sure you have access and GITHUB_TOKEN is set"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "📦 Version: $VERSION"

# Check if required files exist
REQUIRED_FILES=("README.md" "RELEASE_NOTES.md" "package.json" "docs")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "$file" ]; then
        echo "❌ Required file/directory missing: $file"
        exit 1
    fi
done

# Check if release assets exist (from build step)
if [ ! -d "test-archives" ] || [ -z "$(ls -A test-archives)" ]; then
    echo "❌ No release assets found in test-archives/"
    echo "Run 'bun run build:release' first"
    exit 1
fi

echo "✅ All prerequisites met"

# Use test-archives directly (they already exist)
echo "📦 Using existing release assets from test-archives..."
ASSETS_DIR="test-archives"

# Verify checksums exist
ls -la ${ASSETS_DIR}/
echo "Checksums file:"
cat ${ASSETS_DIR}/helpmetest-cli_${VERSION}_checksums.txt

# Delete existing release if it exists (in cli-code repo)
echo "🗑️  Cleaning up existing releases..."
gh release delete v$VERSION --yes || true

# Create release in cli-code repo
echo "🏷️  Creating release in cli-code repository..."
./scripts/release.sh

# Create release in CLI repo with assets
echo "🏷️  Creating release in help-me-test/cli repository..."

# Use the same release notes that were generated for cli-code
if [ -f "release-notes.md" ]; then
    echo "📝 Using detailed release notes from cli-code..."
    RELEASE_NOTES_FILE="release-notes.md"
else
    echo "⚠️  release-notes.md not found, creating basic notes..."
    echo "Cross-platform CLI tool for health check monitoring.

Download the appropriate binary for your platform from the assets below." > basic-release-notes.md
    RELEASE_NOTES_FILE="basic-release-notes.md"
fi

gh release delete v$VERSION --repo help-me-test/cli --yes || true
gh release create v$VERSION \
    --repo help-me-test/cli \
    --title "HelpMeTest CLI v$VERSION" \
    --notes-file "$RELEASE_NOTES_FILE" \
    ${ASSETS_DIR}/*

# Clean up temporary file if created
if [ -f "basic-release-notes.md" ]; then
    rm -f basic-release-notes.md
fi

echo "🎉 Successfully published CLI v$VERSION to help-me-test/cli!"

# Clean up
rm -f release-notes.md basic-release-notes.md

echo "✨ Publishing complete!"