#!/usr/bin/env python3
"""
Debug MCP server connection step by step.
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path

async def test_mcp_stdio():
    """Test MCP server with direct stdio communication."""
    
    cli_dir = Path(__file__).parent
    cmd = ["bun", str(cli_dir / "src" / "index.js"), "mcp", "--verbose"]
    
    print(f"Starting MCP server: {' '.join(cmd)}")
    
    # Start the MCP server process
    process = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0
    )
    
    try:
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "debug-client",
                    "version": "1.0.0"
                }
            }
        }
        
        print("Sending initialize request...")
        print(json.dumps(init_request))
        
        # Send the request
        process.stdin.write(json.dumps(init_request) + "\n")
        process.stdin.flush()
        
        # Wait for response with timeout
        try:
            stdout, stderr = process.communicate(timeout=5)
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            print(f"Return code: {process.returncode}")
        except subprocess.TimeoutExpired:
            print("Process timed out")
            process.kill()
            stdout, stderr = process.communicate()
            print(f"STDOUT after kill: {stdout}")
            print(f"STDERR after kill: {stderr}")
            
    except Exception as e:
        print(f"Error: {e}")
        process.kill()
        
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait()

if __name__ == "__main__":
    asyncio.run(test_mcp_stdio())