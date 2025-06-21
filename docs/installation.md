# Installation Guide

## Quick Install (Recommended)

```bash
curl -fsSL https://helpmetest.com/install | bash
# Binary size: ~55MB (includes Bun runtime)

# Verify installation
helpmetest --version
```

The installer will automatically:
- Detect your OS and architecture
- Download the appropriate binary
- Install it to `/usr/local/bin` (or appropriate location for your OS)
- Make it executable
- Verify the installation

## Manual Installation Methods

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

## Environment Variables

Set up your API token:
```bash
export HELPMETEST_API_TOKEN="your-token-here"
```

Optional environment variables:
- `ENV` - Environment identifier (dev, staging, prod)
- `HELPMETEST_*` - Custom data (any env var starting with HELPMETEST_)

## Verification

Test your installation:
```bash
# Basic health check
helpmetest health "test-check" "1m"

# Check system metrics
helpmetest metrics

# View help
helpmetest --help
```