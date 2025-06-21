#!/usr/bin/env python3
"""
Test MCP server tools functionality to identify bugs between versions
"""
import asyncio
import json
import sys
from typing import Dict, Any, List

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Test with valid token from environment
VALID_TOKEN = os.getenv('HELPMETEST_API_TOKEN')
if not VALID_TOKEN:
    print("❌ HELPMETEST_API_TOKEN not found in environment variables")
    print("Please create a .env file with your token (see .env.example)")
    exit(1)

class MCPTester:
    def __init__(self, command: List[str], name: str):
        self.command = command
        self.name = name
        self.process = None
        
    async def start(self):
        """Start the MCP server process"""
        print(f"\n=== Starting {self.name} ===")
        print(f"Command: {' '.join(self.command)}")
        
        self.process = await asyncio.create_subprocess_exec(
            *self.command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send a JSON-RPC request and get response"""
        if not self.process:
            raise RuntimeError("Process not started")
            
        request_json = json.dumps(request) + '\n'
        print(f"[{self.name}] Sending: {request_json.strip()}")
        
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response line
        try:
            response_line = await asyncio.wait_for(
                self.process.stdout.readline(), timeout=5.0
            )
            response_str = response_line.decode().strip()
            print(f"[{self.name}] Response: {response_str}")
            
            if response_str:
                return json.loads(response_str)
            else:
                return {"error": "Empty response"}
        except asyncio.TimeoutError:
            return {"error": "Timeout"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode error: {e}"}
    
    async def stop(self):
        """Stop the process"""
        if self.process:
            self.process.terminate()
            await self.process.wait()

async def test_mcp_functionality():
    """Test both versions with actual tool calls"""
    
    # Create testers
    node_tester = MCPTester([
        'node',
        '/Users/slava/work/helpmetest/cli/src/index.js',
        'mcp',
        VALID_TOKEN,
        '--verbose'
    ], "Node.js")
    
    built_tester = MCPTester([
        '/Users/slava/work/helpmetest/cli/dist/helpmetest-darwin-arm64',
        'mcp',
        VALID_TOKEN,
        '--verbose'
    ], "Built")
    
    results = {}
    
    for tester in [node_tester, built_tester]:
        try:
            await tester.start()
            
            # 1. Initialize
            init_response = await tester.send_request({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "roots": {"listChanged": True},
                        "sampling": {}
                    },
                    "clientInfo": {
                        "name": "test-client",
                        "version": "1.0.0"
                    }
                }
            })
            
            # 2. List tools
            tools_response = await tester.send_request({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            })
            
            # 3. Try to call a tool (get health checks)
            tool_call_response = await tester.send_request({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "get_health_checks",
                    "arguments": {}
                }
            })
            
            results[tester.name] = {
                "init": init_response,
                "tools": tools_response,
                "tool_call": tool_call_response,
                "success": True
            }
            
        except Exception as e:
            print(f"[{tester.name}] Error: {e}")
            results[tester.name] = {
                "success": False,
                "error": str(e)
            }
        finally:
            await tester.stop()
    
    # Compare results
    print(f"\n=== DETAILED COMPARISON ===")
    
    for step in ["init", "tools", "tool_call"]:
        print(f"\n--- {step.upper()} COMPARISON ---")
        
        node_result = results.get("Node.js", {}).get(step)
        built_result = results.get("Built", {}).get(step)
        
        if node_result and built_result:
            if node_result == built_result:
                print(f"✅ {step}: Both versions identical")
            else:
                print(f"❌ {step}: Versions differ!")
                print(f"Node.js: {json.dumps(node_result, indent=2)}")
                print(f"Built: {json.dumps(built_result, indent=2)}")
        else:
            print(f"⚠️  {step}: Missing results")
            if node_result:
                print(f"Node.js: {json.dumps(node_result, indent=2)}")
            if built_result:
                print(f"Built: {json.dumps(built_result, indent=2)}")
    
    # Overall success comparison
    node_success = results.get("Node.js", {}).get("success", False)
    built_success = results.get("Built", {}).get("success", False)
    
    print(f"\n=== FINAL SUMMARY ===")
    print(f"Node.js overall success: {node_success}")
    print(f"Built version overall success: {built_success}")
    
    if node_success != built_success:
        print("🐛 BUG DETECTED: Different success rates!")
        if not built_success:
            print("Built version failed:", results.get("Built", {}).get("error"))
    else:
        print("Both versions have same success rate")

if __name__ == "__main__":
    asyncio.run(test_mcp_functionality())