#!/usr/bin/env python3
"""
Test error handling in the MCP server
"""
import os
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get token from environment
VALID_TOKEN = os.getenv('HELPMETEST_API_TOKEN')
if not VALID_TOKEN:
    print("❌ HELPMETEST_API_TOKEN not found in environment variables")
    print("Please create a .env file with your token (see .env.example)")
    exit(1)

# Test with valid token to see error handling
server = MCPServerStdio(  
    'node',
    args=[
        '/Users/slava/work/helpmetest/cli/src/index.js',
        'mcp',
        VALID_TOKEN,  # Valid token from environment
        '--verbose'
    ]
)

agent = Agent('openai:gpt-4o', mcp_servers=[server])

async def main():
    async with agent.run_mcp_servers():
        result = await agent.run('Get all health checks')
    print(result.output)

import asyncio
asyncio.run(main())