#!/bin/bash
# Universal release script for HelpMeTest CLI
# Can be used both manually and by GitHub Actions

set -e

# Determine if running in GitHub Actions
if [ -n "$GITHUB_ACTIONS" ]; then
  RUNNING_IN_CI=true
  echo "🚀 Running in GitHub Actions"
else
  RUNNING_IN_CI=false
  echo "🚀 Running in manual mode"
fi

# Check for required tools in manual mode
if [ "$RUNNING_IN_CI" = false ]; then
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
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Creating release for version: $VERSION"

# Set paths based on environment
if [ "$RUNNING_IN_CI" = true ]; then
  # In GitHub Actions, artifacts are downloaded to release-assets
  ASSETS_DIR="release-assets"
else
  # In manual mode, we build to test-archives
  ASSETS_DIR="test-archives"
  
  # Check if release assets exist (should be built already)
  if [ ! -d "$ASSETS_DIR" ] || [ -z "$(ls -A $ASSETS_DIR)" ]; then
      echo "❌ No release assets found. Run 'bun run build:release' first."
      exit 1
  fi
  
  echo "📦 Found release assets:"
  ls -la $ASSETS_DIR/
fi

# Generate release notes
echo "📝 Generating release notes..."

# Check if RELEASE_NOTES.md exists
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

# Create the release
echo "🚀 Creating GitHub release..."

if [ "$RUNNING_IN_CI" = true ]; then
  # In GitHub Actions, use the GITHUB_TOKEN
  gh release create v${VERSION} \
    --notes-file release-notes.md \
    ${ASSETS_DIR}/*
else
  # In manual mode, use the authenticated gh CLI
  gh release create v${VERSION} \
    --notes-file release-notes.md \
    ${ASSETS_DIR}/*
  
  echo "✅ Release v${VERSION} created successfully!"
  echo "🔗 View release: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/v${VERSION}"
fi

# Clean up
rm -f release-notes.md

echo "🎉 Release process completed!"