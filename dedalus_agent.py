import asyncio
import sys
import json

from dedalus_labs import AsyncDedalus, DedalusRunner
from dedalus_labs.utils.stream import stream_async
from dotenv import load_dotenv

load_dotenv()


async def process_query(query: str) -> str:
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    response = await runner.run(
        input=query,
        model="openai/gpt-5-mini",
        mcp_servers=["windsor/exa-search-mcp"],
    )

    return response.final_output


async def main() -> None:
    print(json.dumps({"status": "info", "message": "Dedalus agent started"}))
    sys.stdout.flush()
    
    while True:
        try:
            print(json.dumps({"status": "info", "message": "Waiting for input..."}))
            sys.stdout.flush()
            
            line = sys.stdin.readline()
            print(json.dumps({"status": "info", "message": f"Received line: {line.strip()}"}))
            sys.stdout.flush()
            
            if not line:
                break
            
            data = json.loads(line.strip())
            query = data.get('query', '')
            print(json.dumps({"status": "info", "message": f"Parsed query: {query}"}))
            sys.stdout.flush()
            
            if query:
                print(json.dumps({"status": "info", "message": "Processing query..."}))
                sys.stdout.flush()
                result = await process_query(query)
                response = {"status": "success", "result": result}
            else:
                response = {"status": "error", "error": "No query provided"}
            
            print(json.dumps(response))
            sys.stdout.flush()
            
        except Exception as e:
            error_response = {"status": "error", "error": str(e)}
            print(json.dumps(error_response))
            sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())

