## 📥 Installation

### Quick Install (Recommended)

```bash
# Download and install the latest version
curl -fsSL https://raw.githubusercontent.com/help-me-test/cli/main/install.sh | bash
```

### Manual Installation

1. **Download the binary for your platform:**
   - **Linux x86_64**: `helpmetest-cli_Linux_x86_64.tar.gz`
   - **Linux ARM64**: `helpmetest-cli_Linux_arm64.tar.gz`
   - **Linux i386**: `helpmetest-cli_Linux_i386.tar.gz`
   - **macOS ARM64 (Apple Silicon)**: `helpmetest-cli_Darwin_arm64.tar.gz`
   - **macOS x86_64 (Intel)**: `helpmetest-cli_Darwin_x86_64.tar.gz`
   - **Windows x86_64**: `helpmetest-cli_Windows_x86_64.zip`
   - **Windows ARM64**: `helpmetest-cli_Windows_arm64.zip`
   - **Windows i386**: `helpmetest-cli_Windows_i386.zip`

2. **Extract and install:**

   **Linux/macOS:**
   ```bash
   tar -xzf helpmetest-cli_*.tar.gz
   sudo mv helpmetest /usr/local/bin/
   ```

   **Windows:**
   - Extract the `.zip` file
   - Move `helpmetest.exe` to a directory in your PATH

3. **Verify installation:**
   ```bash
   helpmetest --version
   ```

### Package Managers

**Homebrew (macOS/Linux):**
```bash
brew install help-me-test/tap/helpmetest
```

**Chocolatey (Windows):**
```powershell
choco install helpmetest
```

**Scoop (Windows):**
```powershell
scoop bucket add help-me-test https://github.com/help-me-test/scoop-bucket
scoop install helpmetest
```

## 🔐 Verification

All binaries are signed and checksums are provided. Verify your download:

```bash
# Download checksums
curl -fsSL https://github.com/help-me-test/cli/releases/latest/download/helpmetest-cli_*_checksums.txt

# Verify checksum (Linux/macOS)
sha256sum -c helpmetest-cli_*_checksums.txt

# Verify checksum (Windows PowerShell)
Get-FileHash helpmetest-cli_*.zip -Algorithm SHA256
```

## 📚 Documentation

- [Usage Guide](https://github.com/help-me-test/cli/blob/main/docs/usage.md)
- [Health Checks](https://github.com/help-me-test/cli/blob/main/docs/health-checks.md)
- [MCP Setup](https://github.com/help-me-test/cli/blob/main/docs/mcp-setup.md)
- [Integrations](https://github.com/help-me-test/cli/blob/main/docs/integrations.md)

## 🆘 Support

- [GitHub Issues](https://github.com/help-me-test/cli/issues)
- [Documentation](https://github.com/help-me-test/cli/blob/main/README.md)
- [Discord Community](https://discord.gg/helpmetest)