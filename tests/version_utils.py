"""
Version utilities for Python scripts.

Reads version from package.json to ensure consistency across the CLI application.
"""

import json
import os
from pathlib import Path


def get_version() -> str:
    """
    Get the current version from package.json.

    Returns:
        str: Current version from package.json
    """
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    package_json_path = script_dir / "package.json"

    try:
        with open(package_json_path, "r", encoding="utf-8") as f:
            package_data = json.load(f)
            return package_data.get("version", "1.0.0")
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        # Fallback to default version if package.json is not found or invalid
        return "1.0.0"


def get_package_name() -> str:
    """
    Get the package name from package.json.

    Returns:
        str: Package name from package.json
    """
    script_dir = Path(__file__).parent
    package_json_path = script_dir / "package.json"

    try:
        with open(package_json_path, "r", encoding="utf-8") as f:
            package_data = json.load(f)
            return package_data.get("name", "helpmetest-cli")
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return "helpmetest-cli"


def get_user_agent() -> str:
    """
    Get user agent string with current version.

    Returns:
        str: User agent string
    """
    return f"HelpMeTest-CLI/{get_version()}"


def get_mcp_client_info() -> dict:
    """
    Get MCP client info with current version.

    Returns:
        dict: MCP client information
    """
    return {"name": "helpmetest-mcp-client", "version": get_version()}


if __name__ == "__main__":
    print(f"Version: {get_version()}")
    print(f"Package: {get_package_name()}")
    print(f"User Agent: {get_user_agent()}")
