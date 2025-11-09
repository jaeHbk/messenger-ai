#!/usr/bin/env python3
import json
import subprocess
import sys

def test_dedalus():
    # Start the dedalus agent
    process = subprocess.Popen(
        ['python3', 'dedalus_agent.py'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Send a test query
    test_query = {"query": "What is 2+2?"}
    process.stdin.write(json.dumps(test_query) + '\n')
    process.stdin.flush()
    
    # Read response
    response = process.stdout.readline()
    print("Dedalus response:", response.strip())
    
    process.terminate()

if __name__ == "__main__":
    test_dedalus()