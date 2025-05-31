# HelpMeTest CLI v{{VERSION}}

## 🚀 What's New

- Automated release with cross-platform binaries
- Support for Linux, macOS, and Windows platforms
- Single binary distribution with embedded runtime

## 📦 Downloads

Choose the appropriate binary for your platform:

### Linux
- **x86_64**: `helpmetest-cli_Linux_x86_64.tar.gz`
- **ARM64**: `helpmetest-cli_Linux_arm64.tar.gz`
- **i386**: `helpmetest-cli_Linux_i386.tar.gz`

### macOS
- **x86_64 (Intel)**: `helpmetest-cli_Darwin_x86_64.tar.gz`
- **ARM64 (Apple Silicon)**: `helpmetest-cli_Darwin_arm64.tar.gz`

### Windows
- **x86_64**: `helpmetest-cli_Windows_x86_64.zip`
- **ARM64**: `helpmetest-cli_Windows_arm64.zip`
- **i386**: `helpmetest-cli_Windows_i386.zip`

## 🔐 Verification

Verify your download using the provided checksums:
```bash
sha256sum -c helpmetest-cli_{{VERSION}}_checksums.txt
```

## 📖 Installation

### Linux/macOS
```bash
# Download and extract
tar -xzf helpmetest-cli_Linux_x86_64.tar.gz

# Install to system path
sudo mv helpmetest /usr/local/bin/helpmetest
sudo chmod +x /usr/local/bin/helpmetest

# Verify installation
helpmetest --version
```

### Windows
```bash
# Extract the zip file
# Add helpmetest.exe to your PATH
# Or run directly: .\helpmetest.exe --version
```

## 🛠️ Usage

```bash
# Send a health check heartbeat
helpmetest health "my-service" "5m"

# View system metrics
helpmetest metrics

# Get help
helpmetest --help
```

## 🔧 Requirements

- No external dependencies required (self-contained binary)
- Minimum system requirements: 64MB RAM, 100MB disk space

---

**Full Changelog**: https://github.com/your-org/helpmetest-cli/compare/v{{PREVIOUS_VERSION}}...v{{VERSION}}