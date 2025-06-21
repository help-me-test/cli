#!/usr/bin/env python3
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

server = MCPServerStdio(  
    'node',
    args=[
        '/Users/slava/work/helpmetest/cli/src/index.js',
        'mcp',
        VALID_TOKEN,
    ]
)

agent = Agent('openai:gpt-4o', mcp_servers=[server])


async def main():
    async with agent.run_mcp_servers():
        result = await agent.run('Check helpmetest status')
    print(result.output)
# from pydantic_ai import Agent
# from pydantic_ai.mcp import MCPServerSSE

# server = MCPServerSSE(url='http://localhost:31337/sse')  
# agent = Agent('openai:gpt-4o', mcp_servers=[server])  


# async def main():
#     async with agent.run_mcp_servers():  
#         result = await agent.run('check status of helpmetest')
#     print(result.output)

import asyncio
asyncio.run(main())