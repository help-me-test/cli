#!/usr/bin/env python3
"""
Simple MCP test to isolate the keyValidator._parse error
"""
import asyncio
import subprocess
import json
import sys

async def test_mcp_server_directly():
    """Test the MCP server directly using subprocess"""
    print("Testing MCP server directly...")
    
    # Start the MCP server
    process = subprocess.Popen(
        ['bun', '/Users/slava/work/helpmetest/cli/src/index.js', 'mcp', '--verbose'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        # Send initialize message
        init_message = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }
        
        print("Sending initialize message...")
        process.stdin.write(json.dumps(init_message) + '\n')
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        print(f"Initialize response: {response_line.strip()}")
        
        # Send initialized notification
        initialized_message = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        
        print("Sending initialized notification...")
        process.stdin.write(json.dumps(initialized_message) + '\n')
        process.stdin.flush()
        
        # List tools
        list_tools_message = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        }
        
        print("Sending tools/list message...")
        process.stdin.write(json.dumps(list_tools_message) + '\n')
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        print(f"Tools list response: {response_line.strip()}")
        
        # Try to call system_status tool
        call_tool_message = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "system_status",
                "arguments": {}
            }
        }
        
        print("Sending tools/call message for system_status...")
        process.stdin.write(json.dumps(call_tool_message) + '\n')
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        print(f"Tool call response: {response_line.strip()}")
        
        # Check if there's an error
        try:
            response_data = json.loads(response_line.strip())
            if 'error' in response_data:
                print(f"ERROR: {response_data['error']}")
                return False
            else:
                print("SUCCESS: Tool call completed without error")
                return True
        except json.JSONDecodeError as e:
            print(f"Failed to parse response: {e}")
            return False
            
    except Exception as e:
        print(f"Test failed with exception: {e}")
        return False
    finally:
        process.terminate()
        process.wait()

if __name__ == "__main__":
    result = asyncio.run(test_mcp_server_directly())
    sys.exit(0 if result else 1)