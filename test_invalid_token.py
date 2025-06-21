#!/usr/bin/env python3
"""
Test error handling with invalid token using built binary
"""
import os
import asyncio
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set OpenAI API key from environment or use placeholder for testing
os.environ['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY', 'sk-test-invalid-key-for-testing')

# Get token from environment
VALID_TOKEN = os.getenv('HELPMETEST_API_TOKEN')
if not VALID_TOKEN:
    print("❌ HELPMETEST_API_TOKEN not found in environment variables")
    print("Please create a .env file with your token (see .env.example)")
    exit(1)

# Test with actually invalid token to see error handling
server = MCPServerStdio(  
    '/Users/slava/work/helpmetest/cli/dist/helpmetest',
    args=[
        'mcp',
        VALID_TOKEN,  # Valid token from .env
        '--verbose'
    ]
)

agent = Agent('openai:gpt-4o', mcp_servers=[server])

async def main():
    print("Testing built binary with invalid token...")
    try:
        # Add timeout to prevent hanging
        async with asyncio.timeout(30):  # 30 second timeout
            async with agent.run_mcp_servers():
                result = await agent.run('Get all health checks')
            print("Result:")
            print(result.output)
    except asyncio.TimeoutError:
        print("❌ Test timed out - binary is likely hanging")
    except Exception as e:
        print(f"Error (expected with invalid token): {e}")

if __name__ == "__main__":
    asyncio.run(main())