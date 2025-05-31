# HelpMeTest CLI

A command-line tool for sending health check heartbeats to HelpMeTest monitoring system.

✨ **Features:**
- 🎨 Colorized output for better readability
- 📊 Automatic system metrics collection
- ⏱️ Flexible grace period formats
- 🔧 Systemd timer integration
- 🚀 Single binary compilation

## Installation

```bash
# Install dependencies
bun install

# Build single binary
bun run build:binary

# Or build both Node.js bundle and binary
bun run build:all

# Package binary with executable permissions
bun run package
```

## Usage

```bash
helpmetest health <name> <grace_period>
```

### Examples

```bash
# Basic health check
helpmetest health "database-backup" "5m"

# With environment
ENV=production helpmetest health "web-app" "1m"

# Conditional execution
psql postgres://user:pass@localhost/db -c "SELECT 1;" && \
  helpmetest health "db-connection" "2m"
```

## Environment Variables

- `HELPMETEST_API_TOKEN` - Required. Your HelpMeTest API token
- `ENV` - Optional. Environment identifier (dev, staging, prod)
- `HELPMETEST_*` - Optional. Custom data (any env var starting with HELPMETEST_)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run in development
bun start health "test" "1m"
```

## Grace Period Formats

Supported time formats (via timespan-parser):
- `30s` - 30 seconds
- `5m` - 5 minutes  
- `2h` - 2 hours
- `1d` - 1 day
- `15min` - 15 minutes
- `2.5h` - 2.5 hours

## System Metrics

The CLI automatically collects and sends:
- Hostname
- IP Address
- CPU usage
- Memory usage
- Disk usage
- Environment
- Custom HELPMETEST_* variables

## Build Scripts

- `bun run clean` - Remove dist and archives directories
- `bun run build` - Build Node.js bundle (dist/helpmetest)
- `bun run build:binary` - Build single executable binary
- `bun run build:all` - Clean, build bundle, and build binary
- `bun run package` - Build binary and make it executable
- `bun run build:linux-x64` - Build Linux x64 binary
- `bun run build:linux-arm64` - Build Linux ARM64 binary
- `bun run build:darwin-x64` - Build macOS x64 binary
- `bun run build:darwin-arm64` - Build macOS ARM64 binary
- `bun run build:windows-x64` - Build Windows x64 binary
- `bun run release:local` - Build multiple platform binaries locally

## Binary Distribution

The compiled binary (`dist/helpmetest`) is a self-contained executable that includes:
- All Node.js dependencies
- System metrics collection
- Colorized output support
- Complete CLI functionality

Binary size: ~55MB (includes Bun runtime)

## CI/CD Pipeline

The CLI uses GitHub Actions for automated building and releasing:

### Automated Builds
- **Trigger**: Push to `main` branch (when `src/**`, `package.json`, or workflow files change)
- **Platforms**: Linux (x64, ARM64, i386), macOS (x64, ARM64), Windows (x64, ARM64, i386)
- **Artifacts**: Cross-platform binaries with naming scheme: `helpmetest-cli_OS_ARCH.tar.gz` (or `.zip` for Windows)
- **Testing**: Runs unit tests before building
- **Checksums**: Generates SHA256 checksums for all release assets

### Release Process
1. Update version in `package.json`
2. Push to `main` branch
3. GitHub Actions automatically:
   - Runs tests
   - Builds binaries for all platforms
   - Creates GitHub release with version tag
   - Uploads all binaries and checksums

### Manual Release
```bash
# Trigger manual build
gh workflow run build-release.yml
```

## Deployment

### From GitHub Releases
```bash
# Download latest release
curl -L -o helpmetest-cli.tar.gz https://github.com/your-org/helpmetest-cli/releases/latest/download/helpmetest-cli_Linux_x86_64.tar.gz

# Extract and install
tar -xzf helpmetest-cli.tar.gz
sudo mv helpmetest /usr/local/bin/helpmetest
sudo chmod +x /usr/local/bin/helpmetest

# Test installation
helpmetest --version
```

### Local Build
```bash
# Copy binary to system path
sudo cp dist/helpmetest /usr/local/bin/helpmetest

# Make executable (if needed)
sudo chmod +x /usr/local/bin/helpmetest

# Test installation
helpmetest --version
```