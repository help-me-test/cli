#!/usr/bin/env python3
"""
Test the minimal MCP server to isolate the keyValidator._parse error
"""
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio

server = MCPServerStdio(  
    'node',
    args=[
        '/Users/slava/work/helpmetest/cli/test_minimal_mcp.js',
    ]
)

agent = Agent('openai:gpt-4o', mcp_servers=[server])

async def main():
    async with agent.run_mcp_servers():
        result = await agent.run('Call the simple test tool')
    print(result.output)

import asyncio
asyncio.run(main())