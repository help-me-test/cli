#!/usr/bin/env python3
"""
Test MCP servers directly without AI agent to identify bugs
"""
import asyncio
import subprocess
import json
import sys
from typing import Dict, Any

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Test with valid token from environment
VALID_TOKEN = os.getenv('HELPMETEST_API_TOKEN')
if not VALID_TOKEN:
    print("❌ HELPMETEST_API_TOKEN not found in environment variables")
    print("Please create a .env file with your token (see .env.example)")
    exit(1)

async def test_mcp_server_direct(command: list, name: str) -> Dict[str, Any]:
    """Test MCP server directly using stdio"""
    print(f"\n=== Testing {name} ===")
    print(f"Command: {' '.join(command)}")
    
    try:
        # Start the process
        process = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Send MCP initialization request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "roots": {
                        "listChanged": True
                    },
                    "sampling": {}
                },
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }
        
        # Send the request
        request_json = json.dumps(init_request) + '\n'
        print(f"Sending: {request_json.strip()}")
        
        process.stdin.write(request_json.encode())
        await process.stdin.drain()
        
        # Wait for response with timeout
        try:
            stdout_data, stderr_data = await asyncio.wait_for(
                process.communicate(), timeout=10.0
            )
        except asyncio.TimeoutError:
            print("Timeout waiting for response")
            process.kill()
            return {"success": False, "error": "Timeout"}
        
        # Parse response
        stdout_str = stdout_data.decode() if stdout_data else ""
        stderr_str = stderr_data.decode() if stderr_data else ""
        
        print(f"STDOUT: {stdout_str}")
        print(f"STDERR: {stderr_str}")
        print(f"Return code: {process.returncode}")
        
        return {
            "success": process.returncode == 0,
            "stdout": stdout_str,
            "stderr": stderr_str,
            "returncode": process.returncode
        }
        
    except Exception as e:
        print(f"Exception: {e}")
        return {"success": False, "error": str(e)}

async def main():
    """Compare Node.js vs built version"""
    print("Testing MCP servers directly...")
    
    # Test Node.js version
    node_command = [
        'node',
        '/Users/slava/work/helpmetest/cli/src/index.js',
        'mcp',
        VALID_TOKEN,
        '--verbose'
    ]
    
    # Test built version
    built_command = [
        '/Users/slava/work/helpmetest/cli/dist/helpmetest-darwin-arm64',
        'mcp',
        VALID_TOKEN,
        '--verbose'
    ]
    
    node_result = await test_mcp_server_direct(node_command, "Node.js version")
    built_result = await test_mcp_server_direct(built_command, "Built version")
    
    print(f"\n=== COMPARISON SUMMARY ===")
    print(f"Node.js success: {node_result['success']}")
    print(f"Built version success: {built_result['success']}")
    
    if node_result['success'] != built_result['success']:
        print("🐛 BUG DETECTED: Different behavior between versions!")
        
        if node_result['success'] and not built_result['success']:
            print("Node.js works, built version fails")
            print("Built version error details:")
            print(f"  Return code: {built_result.get('returncode')}")
            print(f"  STDERR: {built_result.get('stderr')}")
        else:
            print("Built version works, Node.js fails")
            print("Node.js error details:")
            print(f"  Return code: {node_result.get('returncode')}")
            print(f"  STDERR: {node_result.get('stderr')}")
    else:
        print("Both versions behave the same")

if __name__ == "__main__":
    asyncio.run(main())