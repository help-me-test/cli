from mcp.server.fastmcp import FastMCP

from pydantic_ai import Agent

server = FastMCP('PydanticAI Server')

@server.tool()
async def poet(theme: str) -> str:
    """Poem generator"""
    return 'boppy dop'


if __name__ == '__main__':
    server.run()
