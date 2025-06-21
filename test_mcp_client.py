#!/usr/bin/env python3
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio

server = MCPServerStdio(  
    'node',
    args=[
        '/Users/slava/work/helpmetest/cli/src/index.js',
        'mcp',
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