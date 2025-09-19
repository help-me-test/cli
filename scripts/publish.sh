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
REQUIRED_FILES=("README.md" "RELEASE_NOTES.md" "package.json")
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

# Copy test-archives contents to release-assets for consistent paths
echo "📦 Preparing release assets..."
mkdir -p release-assets
cp test-archives/* release-assets/
ASSETS_DIR="release-assets"

# Verify checksums exist
ls -la ${ASSETS_DIR}/
echo "Checksums file:"
cat ${ASSETS_DIR}/helpmetest-cli_${VERSION}_checksums.txt

# Delete existing release if it exists (in cli-code repo)
echo "🗑️  Cleaning up existing releases..."
gh release delete v$VERSION --yes || true

# Create release in cli-code repo
echo "🏷️  Creating release in cli-code repository..."

# Generate release notes
echo "📝 Generating release notes..."
if [ -f "RELEASE_NOTES.md" ]; then
  echo "📝 Found RELEASE_NOTES.md, extracting latest release notes..."
  
  # Extract the latest version's release notes
  awk -v version="v${VERSION}" '
      BEGIN { printing = 0; }
      $0 ~ "^## " version { printing = 1; next; }
      $0 ~ "^## v[0-9]" && printing == 1 { printing = 0; exit; }
      printing == 1 { print; }
  ' RELEASE_NOTES.md > latest_notes.txt
  
  # Create the full release notes with template and latest changes
  {
    echo "# HelpMeTest CLI v${VERSION}"
    echo ""
    cat latest_notes.txt
    echo ""
    cat .github/INSTALLATION_TEMPLATE.md
  } > release-notes.md
  
  # Clean up temporary file
  rm -f latest_notes.txt
else
  echo "⚠️ RELEASE_NOTES.md not found, using default template..."
  # Create release notes with default template
  {
    echo "# HelpMeTest CLI v${VERSION}"
    echo ""
    echo "## 🚀 What's New"
    echo ""
    echo "- Automated release with cross-platform binaries"
    echo "- Support for Linux, macOS, and Windows platforms"
    echo "- Single binary distribution with embedded runtime"
    echo ""
    cat .github/INSTALLATION_TEMPLATE.md
  } > release-notes.md
fi

echo "📝 Release notes created"

# Create release in cli-code repo
gh release delete v$VERSION --yes || true
gh release create v$VERSION \
    --notes-file release-notes.md \
    ${ASSETS_DIR}/*

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

# Create release in CLI repo with the same assets
echo "🏷️  Creating release in help-me-test/cli repository..."
gh release delete v$VERSION --repo help-me-test/cli --yes || true
gh release create v$VERSION \
    --repo help-me-test/cli \
    --title "HelpMeTest CLI v$VERSION" \
    --notes-file "$RELEASE_NOTES_FILE" \
    ${ASSETS_DIR}/*

echo "🎉 Successfully published CLI v$VERSION to both repositories!"

# Clean up
rm -rf release-assets
rm -f release-notes.md basic-release-notes.md

echo "✨ Publishing complete!"