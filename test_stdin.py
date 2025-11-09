#!/usr/bin/env python3
import json
import sys

print("Python test script started")
sys.stdout.flush()

while True:
    try:
        print("Waiting for input...")
        sys.stdout.flush()
        
        line = sys.stdin.readline()
        print(f"Received: {line.strip()}")
        sys.stdout.flush()
        
        if not line:
            break
            
        # Echo back the input
        response = {"status": "success", "received": line.strip()}
        print(json.dumps(response))
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Error: {e}")
        sys.stdout.flush()