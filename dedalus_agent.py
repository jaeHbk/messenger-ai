import asyncio
import sys
import json
import os

from dedalus_labs import AsyncDedalus, DedalusRunner
from dedalus_labs.utils.stream import stream_async
from dotenv import load_dotenv
from calendar_agent import CalendarAgent

load_dotenv()

# Initialize calendar agent
calendar_agent = CalendarAgent()

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

def select_model(query: str) -> str:
    """Select the best model based on the query type"""
    query_lower = query.lower()
    
    # Image generation tasks - disabled DALL-E 3, use GPT-4o mini instead
    # if any(keyword in query_lower for keyword in ['create image', 'generate image', 'draw', 'make picture', 'create picture', 'generate picture', 'paint', 'illustrate', 'design image']):
    #     return "openai/dall-e-3"
    
    # Vision/image analysis tasks - use GPT-4o
    if any(keyword in query_lower for keyword in ['analyze image', 'describe image', 'read image', 'analyze this file content from', '.jpg', '.png', '.gif', 'what\'s in this image', 'data:image']):
        return "openai/gpt-4o"
    
    # Complex reasoning, coding, analysis - use GPT-5
    elif any(keyword in query_lower for keyword in ['analyze', 'code', 'debug', 'complex', 'reasoning', 'logic', 'algorithm']):
        return "openai/gpt-5"
    
    # Fast responses, simple tasks - use GPT-5-mini
    elif any(keyword in query_lower for keyword in ['quick', 'simple', 'summarize', 'brief', 'short']):
        return "openai/gpt-5-mini"
    
    # Creative writing, long-form content - use Claude 3.5 Sonnet
    elif any(keyword in query_lower for keyword in ['write', 'create', 'story', 'essay', 'creative', 'draft']):
        return "anthropic/claude-3-5-sonnet"
    
    # Default to GPT-5-mini for general tasks (more accessible)
    else:
        return "openai/gpt-5-mini"

async def process_query(query: str, chat_id: str = "default") -> str:
    runner = await get_or_create_runner(chat_id)
    
    # Debug: Show total active runners
    print(json.dumps({"status": "debug", "message": f"Total active runners: {len(runners)}"}))
    sys.stdout.flush()
    
    # Select optimal model for this query
    selected_model = select_model(query)
    print(json.dumps({"status": "debug", "message": f"Selected model: {selected_model}"}))
    sys.stdout.flush()
    
    print(json.dumps({"status": "debug", "message": f"Query: {query[:100]}..."}))
    sys.stdout.flush()

    response = await runner.run(
        input=query,
        model=selected_model,
        mcp_servers=[
            "windsor/exa-search-mcp",           # Enhanced web search
            "google/google-docs-mcp",           # Google Docs editing
            "google/google-drive-mcp",          # Google Drive access
            "brightdata/web-research-mcp",      # Advanced web scraping
        ],
    )
    
    # Handle different response types
    final_response = response.final_output
    
    # Check if this was an image generation request
    if selected_model == "openai/dall-e-3":
        print(json.dumps({"status": "debug", "message": f"DALL-E Response type: {type(final_response)}"}))
        sys.stdout.flush()
        
        # DALL-E responses might contain image URLs or be structured differently
        if isinstance(final_response, str):
            # If it's a URL, format it nicely
            if final_response.startswith('http') and ('image' in final_response or 'dalle' in final_response):
                final_response = f"🎨 Here's your generated image:\n{final_response}\n\nImage created with DALL-E 3"
            # If it contains a URL within text, extract and format it
            elif 'http' in final_response:
                import re
                urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', final_response)
                if urls:
                    image_url = urls[0]
                    final_response = f"🎨 Here's your generated image:\n{image_url}\n\nImage created with DALL-E 3"
    
    print(json.dumps({"status": "debug", "message": f"Final response: {final_response[:100]}..."}))
    sys.stdout.flush()

    return final_response


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
                # Check for dates/times and generate .ics file if detected
                ics_file_path = None
                calendar_message = ""
                
                try:
                    ics_file_path = calendar_agent.process_text(query)
                    if ics_file_path:
                        # Get absolute path for the .ics file
                        abs_path = os.path.abspath(ics_file_path)
                        calendar_message = f"\n\n📅 Calendar event detected! I've created a calendar file: {abs_path}\nYou can import this .ics file into your calendar app."
                        print(json.dumps({"status": "info", "message": f"Generated calendar file: {abs_path}"}))
                        sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({"status": "debug", "message": f"Calendar agent error: {str(e)}"}))
                    sys.stdout.flush()
                
                print(json.dumps({"status": "info", "message": "Processing query..."}))
                sys.stdout.flush()
                result = await process_query(query, chat_id)
                
                # Append calendar message if .ics file was generated
                if calendar_message:
                    result = result + calendar_message
                
                response = {"status": "success", "result": result}
                if ics_file_path:
                    response["ics_file"] = os.path.abspath(ics_file_path)
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

