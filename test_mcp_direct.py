#!/usr/bin/env python3
"""
Test MCP server using direct MCP client.
"""

import asyncio
import sys
from pathlib import Path

try:
    from mcp.client.stdio import stdio_client
    from mcp.client.session import ClientSession
    from mcp.types import Tool
except ImportError:
    print("Error: mcp package not installed. Install with: uv pip install --upgrade --system mcp")
    sys.exit(1)

async def test_mcp_client():
    """Test MCP server using direct MCP client."""
    
    cli_dir = Path(__file__).parent
    server_cmd = "bun"
    server_args = [str(cli_dir / "src" / "index.js"), "mcp"]
    
    print(f"Testing MCP server: {server_cmd} {' '.join(server_args)}")
    
    try:
        # Connect to the MCP server
        async with stdio_client(server=server_cmd, args=server_args) as (read_stream, write_stream):
            print("✅ Connected to MCP server")
            
            # Create client session
            session = ClientSession(read_stream, write_stream)
            
            # Initialize the session
            print("Initializing session...")
            init_result = await session.initialize()
            print(f"✅ Session initialized: {init_result.server_info.name} v{init_result.server_info.version}")
            print(f"Server capabilities: {init_result.capabilities}")
            
            # List available tools
            print("\nListing tools...")
            tools_result = await session.list_tools()
            print(f"✅ Found {len(tools_result.tools)} tools:")
            for tool in tools_result.tools:
                print(f"  - {tool.name}: {tool.description}")
            
            # Test health_check tool
            if any(tool.name == "health_check" for tool in tools_result.tools):
                print("\nTesting health_check tool...")
                try:
                    result = await session.call_tool(
                        "health_check",
                        {"url": "https://httpbin.org/status/200"}
                    )
                    print(f"✅ Health check result: {result.content[0].text}")
                except Exception as e:
                    print(f"❌ Health check failed: {e}")
            
            # Test system_status tool
            if any(tool.name == "system_status" for tool in tools_result.tools):
                print("\nTesting system_status tool...")
                try:
                    result = await session.call_tool("system_status", {})
                    print(f"✅ System status result: {result.content[0].text[:200]}...")
                except Exception as e:
                    print(f"❌ System status failed: {e}")
            
            print("\n✅ All tests completed successfully!")
            return True
            
    except Exception as e:
        print(f"❌ MCP test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_mcp_client())
    sys.exit(0 if success else 1)