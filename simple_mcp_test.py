#!/usr/bin/env python3
"""
Simple MCP test to debug connection issues.
"""

import asyncio
import subprocess
import sys
from pathlib import Path

try:
    from pydantic_ai import Agent
    from pydantic_ai.mcp import MCPServerStdio
except ImportError:
    print("Error: pydantic-ai not installed")
    sys.exit(1)

CLI_DIR = Path(__file__).parent
BUN_CMD = ["bun", str(CLI_DIR / "src" / "index.js")]

async def simple_test():
    """Simple test to check MCP server connection."""
    
    print(f"Testing MCP server with: {' '.join(BUN_CMD)}")
    
    # First, test if the CLI works at all
    try:
        result = subprocess.run(BUN_CMD + ["--version"], 
                              capture_output=True, text=True, timeout=5)
        print(f"CLI version check: {result.stdout.strip()}")
    except Exception as e:
        print(f"CLI version check failed: {e}")
        return False
    
    # Test MCP server startup
    try:
        server = MCPServerStdio("bun", args=[str(CLI_DIR / "src" / "index.js"), "mcp"])
        agent = Agent('openai:gpt-4o', mcp_servers=[server])
        
        print("Attempting to connect to MCP server...")
        
        async with agent.run_mcp_servers():
            print("✅ MCP server connected!")
            
            # Simple test
            result = await agent.run("What tools are available?")
            print(f"Response: {result.output}")
            
        return True
        
    except Exception as e:
        print(f"❌ MCP connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(simple_test())
    sys.exit(0 if success else 1)