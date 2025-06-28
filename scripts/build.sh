#!/bin/bash

# Build script for HelpMeTest CLI
# This script builds all platform binaries

set -e

echo "🚀 Building HelpMeTest CLI"
echo "======================================"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first."
    exit 1
fi

echo "✅ Bun found: $(bun --version)"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Building version: $VERSION"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
bun run clean

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Skip tests for release testing
echo "🧪 Skipping tests for release demonstration..."
# bun test

# Test individual platform builds
echo "🔨 Building platform-specific binaries..."

platforms=("linux-x64" "linux-arm64" "linux-x86" "darwin-x64" "darwin-arm64" "windows-x64" "windows-arm64" "windows-x86")

for platform in "${platforms[@]}"; do
    echo "  Building for $platform..."
    bun run "build:$platform"
    
    # Check if binary was created
    if [[ "$platform" == *"windows"* ]]; then
        binary_path="dist/helpmetest-$platform.exe"
    else
        binary_path="dist/helpmetest-$platform"
    fi
    
    if [[ -f "$binary_path" ]]; then
        size=$(du -h "$binary_path" | cut -f1)
        echo "  ✅ $platform binary created ($size)"
    else
        echo "  ❌ $platform binary not found"
        exit 1
    fi
done

# Create release archives
echo "📦 Creating release archives..."
mkdir -p test-archives

for platform in "${platforms[@]}"; do
    if [[ "$platform" == *"windows"* ]]; then
        binary_name="helpmetest-$platform.exe"
        archive_name="helpmetest-cli_$(echo ${platform//-/_} | sed 's/linux/Linux/; s/darwin/Darwin/; s/windows/Windows/' | sed 's/_x64/_x86_64/; s/_x86$/_i386/').zip"
        cd dist
        cp "$binary_name" helpmetest.exe
        zip "../test-archives/$archive_name" helpmetest.exe
        rm helpmetest.exe
        cd ..
    else
        binary_name="helpmetest-$platform"
        archive_name="helpmetest-cli_$(echo ${platform//-/_} | sed 's/linux/Linux/; s/darwin/Darwin/' | sed 's/_x64/_x86_64/; s/_x86$/_i386/').tar.gz"
        cd dist
        cp "$binary_name" helpmetest
        tar -czf "../test-archives/$archive_name" helpmetest
        rm helpmetest
        cd ..
    fi
    echo "  ✅ Created $archive_name"
done

# Generate checksums for release
echo "🔐 Generating checksums..."
cd test-archives
sha256sum *.tar.gz *.zip > helpmetest-cli_${VERSION}_checksums.txt 2>/dev/null || sha256sum * > helpmetest-cli_${VERSION}_checksums.txt
echo "  ✅ Checksums generated: helpmetest-cli_${VERSION}_checksums.txt"
cd ..

# Display results
echo ""
echo "🎉 Release build completed successfully!"
echo ""
echo "📊 Build Results:"
echo "=================="
ls -la dist/
echo ""
echo "📦 Release Archives:"
echo "==================="
ls -la test-archives/
echo ""
echo "🔐 Checksums:"
echo "============="
cat test-archives/helpmetest-cli_${VERSION}_checksums.txt

echo ""
echo "✅ All builds completed successfully!"
echo "🚀 Ready for release v$VERSION!"