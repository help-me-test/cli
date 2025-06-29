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

### Platform-Specific Downloads

Choose the appropriate binary for your platform:

#### Linux
- **x86_64**: `helpmetest-cli_Linux_x86_64.tar.gz`
- **ARM64**: `helpmetest-cli_Linux_arm64.tar.gz`
- **i386**: `helpmetest-cli_Linux_i386.tar.gz`

#### macOS
- **x86_64 (Intel)**: `helpmetest-cli_Darwin_x86_64.tar.gz`
- **ARM64 (Apple Silicon)**: `helpmetest-cli_Darwin_arm64.tar.gz`

#### Windows
- **x86_64**: `helpmetest-cli_Windows_x86_64.zip`
- **ARM64**: `helpmetest-cli_Windows_arm64.zip`
- **i386**: `helpmetest-cli_Windows_i386.zip`

### Verifying Downloads

Verify your download using the provided checksums:
```bash
# Download checksums file
curl -L -o helpmetest-cli_1.1.2_checksums.txt https://github.com/help-me-test/cli/releases/download/v1.1.2/helpmetest-cli_1.1.2_checksums.txt

# Verify download
sha256sum -c helpmetest-cli_1.1.2_checksums.txt
```

### Linux/macOS Installation
```bash
# Download latest release (replace with your platform-specific URL)
curl -L -o helpmetest-cli.tar.gz https://github.com/help-me-test/cli/releases/latest/download/helpmetest-cli_Linux_x86_64.tar.gz

# Extract and install
tar -xzf helpmetest-cli.tar.gz
sudo mv helpmetest /usr/local/bin/helpmetest
sudo chmod +x /usr/local/bin/helpmetest

# Test installation
helpmetest --version
```

### Windows Installation
```bash
# Download the zip file from the releases page
# Extract the zip file
# Add helpmetest.exe to your PATH
# Or run directly: .\helpmetest.exe --version
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

## Configuration Setup

### Option 1: Environment Variables
```bash
export HELPMETEST_API_TOKEN="your-token-here"
export ENV="production"  # Optional
```

### Option 2: .env File (Recommended for Development)
```bash
# Create .env file in your project directory
cat > .env << EOF
HELPMETEST_API_TOKEN=your-token-here
HELPMETEST_API_URL=https://helpmetest.com
ENV=production
EOF
```

### Configuration Priority
1. **Environment variables** (highest priority)
2. **`.env` file** in current directory
3. **Default values**

### Available Variables
- `HELPMETEST_API_TOKEN` - Your HelpMeTest API token (required)
- `HELPMETEST_API_URL` - API base URL (optional, defaults to https://helpmetest.com)
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