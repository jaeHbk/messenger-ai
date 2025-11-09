import asyncio
import sys
import json

from dedalus_labs import AsyncDedalus, DedalusRunner
from dedalus_labs.utils.stream import stream_async
from dotenv import load_dotenv

load_dotenv()

# Persistent runners per chat ID
runners = {}

async def get_or_create_runner(chat_id: str) -> DedalusRunner:
    if chat_id not in runners:
        print(json.dumps({"status": "debug", "message": f"Creating NEW runner for {chat_id}"}))
        sys.stdout.flush()
        client = AsyncDedalus()
        runners[chat_id] = DedalusRunner(client)
    else:
        print(json.dumps({"status": "debug", "message": f"Using EXISTING runner for {chat_id}"}))
        sys.stdout.flush()
    return runners[chat_id]

async def process_query(query: str, chat_id: str = "default") -> str:
    runner = await get_or_create_runner(chat_id)
    
    # Debug: Show total active runners
    print(json.dumps({"status": "debug", "message": f"Total active runners: {len(runners)}"}))
    sys.stdout.flush()
    
    print(json.dumps({"status": "debug", "message": f"Query: {query[:100]}..."}))
    sys.stdout.flush()

    response = await runner.run(
        input=query,
        model="openai/gpt-5-mini",
        mcp_servers=["windsor/exa-search-mcp"],
    )
    
    print(json.dumps({"status": "debug", "message": f"Response: {response.final_output[:100]}..."}))
    sys.stdout.flush()

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
            chat_id = data.get('chat_id', 'default')
            print(json.dumps({"status": "info", "message": f"Parsed query: {query}, chat_id: {chat_id}"}))
            sys.stdout.flush()
            
            if query:
                print(json.dumps({"status": "info", "message": "Processing query..."}))
                sys.stdout.flush()
                result = await process_query(query, chat_id)
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

