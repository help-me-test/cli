---
name: Release Request
about: Request a new release of HelpMeTest CLI
title: 'Release v[VERSION]'
labels: 'release'
assignees: ''
---

## Release Information

**Version**: v[VERSION] (e.g., v1.0.1)
**Type**: [patch/minor/major]

## Changes

### ✨ New Features
- [ ] Feature 1
- [ ] Feature 2

### 🐛 Bug Fixes
- [ ] Fix 1
- [ ] Fix 2

### 🔧 Improvements
- [ ] Improvement 1
- [ ] Improvement 2

### 💥 Breaking Changes
- [ ] Breaking change 1 (if any)

## Pre-Release Checklist

- [ ] All tests pass locally (`bun test`)
- [ ] Build test passes (`bun run test:build`)
- [ ] Version updated in `package.json`
- [ ] CHANGELOG.md updated (if exists)
- [ ] Documentation updated
- [ ] All CI checks pass

## Release Process

1. **Update Version**: Update version in `package.json`
2. **Push to Main**: Push changes to main branch
3. **Automatic Build**: GitHub Actions will automatically build and release
4. **Verify Release**: Check that all platform binaries are available

## Platform Support

The release should include binaries for:
- [ ] Linux x86_64
- [ ] Linux ARM64
- [ ] Linux i386
- [ ] macOS x86_64 (Intel)
- [ ] macOS ARM64 (Apple Silicon)
- [ ] Windows x86_64
- [ ] Windows ARM64
- [ ] Windows i386

## Additional Notes

[Add any additional notes about this release]