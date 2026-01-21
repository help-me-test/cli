#!/usr/bin/env bash
#
# Download frpc binaries for all platforms
#

set -e

VERSION="v0.66.0"
BIN_DIR="bin/frpc"

echo "Downloading frpc binaries version $VERSION..."

mkdir -p "$BIN_DIR"
cd "$BIN_DIR"

# Download and extract for each platform
platforms=(
  "darwin_amd64:frpc-darwin-x64"
  "darwin_arm64:frpc-darwin-arm64"
  "linux_amd64:frpc-linux-x64"
  "linux_arm64:frpc-linux-arm64"
  "linux_386:frpc-linux-x86"
  "windows_amd64:frpc-windows-x64.exe"
  "windows_arm64:frpc-windows-arm64.exe"
  "windows_386:frpc-windows-x86.exe"
)

for platform_mapping in "${platforms[@]}"; do
  IFS=':' read -r platform output_name <<< "$platform_mapping"

  # Skip if already exists
  if [ -f "$output_name" ]; then
    echo "✓ $output_name already exists, skipping"
    continue
  fi

  echo "Downloading frp_${VERSION#v}_${platform}..."

  if [[ "$platform" == windows_* ]]; then
    archive="frp_${VERSION#v}_${platform}.zip"
    curl -sL "https://github.com/fatedier/frp/releases/download/$VERSION/$archive" -o "$archive"
    unzip -q "$archive"
    dir_name="frp_${VERSION#v}_${platform}"
    mv "$dir_name/frpc.exe" "$output_name"
    rm -rf "$dir_name" "$archive"
  else
    archive="frp_${VERSION#v}_${platform}.tar.gz"
    curl -sL "https://github.com/fatedier/frp/releases/download/$VERSION/$archive" | tar xz
    dir_name="frp_${VERSION#v}_${platform}"
    mv "$dir_name/frpc" "$output_name"
    chmod +x "$output_name"
    rm -rf "$dir_name"
  fi

  echo "✓ Downloaded $output_name"
done

cd ../..

echo ""
echo "✅ All frpc binaries downloaded successfully!"
ls -lh "$BIN_DIR"
