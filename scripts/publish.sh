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

# Copy build artifacts to release-assets
echo "📦 Preparing release assets..."
cp -r test-archives release-assets

# Verify checksums exist
ls -la release-assets/
echo "Checksums file:"
cat release-assets/helpmetest-cli_${VERSION}_checksums.txt

# Delete existing release if it exists (in cli-code repo)
echo "🗑️  Cleaning up existing releases..."
gh release delete v$VERSION --yes || true

# Create release in cli-code repo
echo "🏷️  Creating release in cli-code repository..."
./scripts/release.sh

# Clone the CLI repository
echo "📥 Cloning help-me-test/cli repository..."
rm -rf cli-repo
git clone "https://slavaGanzin:${GITHUB_TOKEN}@github.com/help-me-test/cli.git" cli-repo

# Clear existing content except .git
echo "🧹 Clearing existing content..."
find cli-repo -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# Copy user-facing files (exclude DEVELOPMENT.md)
echo "📋 Copying user-facing files..."
cp README.md cli-repo/
cp RELEASE_NOTES.md cli-repo/
cp package.json cli-repo/
cp -r docs cli-repo/

# Commit and push
echo "💾 Committing changes to help-me-test/cli..."
cd cli-repo
git config user.name "GitHub Actions"
git config user.email "actions@github.com"
git add .

if ! git diff --staged --quiet; then
    git commit -m "Update CLI to version $VERSION

Source: $(git -C .. rev-parse HEAD)"
    git push origin main
    echo "✅ Changes pushed to help-me-test/cli"
else
    echo "ℹ️  No changes to commit"
fi

# Create release in CLI repo with assets
echo "🏷️  Creating release in help-me-test/cli repository..."
cd ..

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
    release-assets/*

# Clean up temporary file if created
if [ -f "basic-release-notes.md" ]; then
    rm -f basic-release-notes.md
fi

echo "🎉 Successfully published CLI v$VERSION to help-me-test/cli!"

# Clean up
rm -rf cli-repo release-assets
rm -f release-notes.md

echo "✨ Publishing complete!"