#!/usr/bin/env python3
from flask import Flask, request, jsonify
import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

async def process_query(query: str) -> str:
    client = AsyncDedalus()
    runner = DedalusRunner(client)
    response = await runner.run(
        input=query,
        model="openai/gpt-5-mini",
        mcp_servers=["windsor/exa-search-mcp"],
    )
    return response.final_output

@app.route('/query', methods=['POST'])
def handle_query():
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
            
        result = asyncio.run(process_query(query))
        return jsonify({"result": result})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("Starting Dedalus HTTP server...")
    app.run(host='127.0.0.1', port=8000, debug=True)