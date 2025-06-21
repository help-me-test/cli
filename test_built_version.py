#!/usr/bin/env python3
"""
Test the built version vs Node.js version to identify bugs
"""
import os
import asyncio
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Test with valid token from environment
VALID_TOKEN = os.getenv('HELPMETEST_API_TOKEN')
if not VALID_TOKEN:
    print("❌ HELPMETEST_API_TOKEN not found in environment variables")
    print("Please create a .env file with your token (see .env.example)")
    exit(1)

async def test_node_version():
    """Test with Node.js version"""
    print("=== Testing Node.js version ===")
    server = MCPServerStdio(  
        'node',
        args=[
            '/Users/slava/work/helpmetest/cli/src/index.js',
            'mcp',
            VALID_TOKEN,
            '--verbose'
        ]
    )
    
    agent = Agent('openai:gpt-4o', mcp_servers=[server])
    
    try:
        async with agent.run_mcp_servers():
            result = await agent.run('Get all health checks')
        print("Node.js version result:")
        print(result.output)
        return True
    except Exception as e:
        print(f"Node.js version error: {e}")
        return False

async def test_built_version():
    """Test with built version"""
    print("\n=== Testing built version ===")
    server = MCPServerStdio(  
        '/Users/slava/work/helpmetest/cli/dist/helpmetest-darwin-arm64',
        args=[
            'mcp',
            VALID_TOKEN,
            '--verbose'
        ]
    )
    
    agent = Agent('openai:gpt-4o', mcp_servers=[server])
    
    try:
        async with agent.run_mcp_servers():
            result = await agent.run('Get all health checks')
        print("Built version result:")
        print(result.output)
        return True
    except Exception as e:
        print(f"Built version error: {e}")
        return False

async def main():
    """Run both tests and compare"""
    print("Comparing Node.js version vs built version...")
    
    node_success = await test_node_version()
    built_success = await test_built_version()
    
    print(f"\n=== Summary ===")
    print(f"Node.js version: {'SUCCESS' if node_success else 'FAILED'}")
    print(f"Built version: {'SUCCESS' if built_success else 'FAILED'}")
    
    if node_success and not built_success:
        print("BUG DETECTED: Node.js version works but built version fails!")
    elif not node_success and built_success:
        print("UNEXPECTED: Built version works but Node.js version fails!")
    elif node_success and built_success:
        print("Both versions work correctly")
    else:
        print("Both versions fail")

if __name__ == "__main__":
    asyncio.run(main())