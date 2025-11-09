# Messenger-AI
HackPrinceton 2026 

How to run:  
```
# Python side (Dedalus agent)
python3 -m venv venv
source venv/bin/activate
pip install dedalus-labs python-dotenv

# TypeScript bridge
cd brief-ai
npm install
npx ts-node index.ts
```

## Inspiration
We wanted a teammate in our group chats that could jump from summarizing dense PDFs to describing a photo in seconds. Messenger-AI was born out of the frustration of juggling multiple apps to gather context and the desire to make intelligent assistants feel collaborative instead of transactional.

## What it does
Messenger-AI embeds `@Brief-AI` into an iMessage thread. The bot:
- Watches every group conversation through `@photon-ai/imessage-kit` and responds only when tagged or when a file drops.
- Processes PDFs, text files, and images, extracts salient context, and stores them in a lightweight knowledge base tied to the chat.
- Pipes questions and file analyses to a Dedalus agent that dynamically selects between GPT-5, GPT-4o, DALL·E 3, and other models.
- Streams back natural-language answers or image links, enriched with prior conversation snippets so replies stay grounded.

## How we built it
The TypeScript bridge in `brief-ai/index.ts` orchestrates iMessage events. It normalizes messages, maintains a rolling history via the custom `contextManager`, and batches useful snippets into the query payload. Attachments flow into specialized processors — a PDF parser for long-form documents and an image pipeline that converts media into base64 payloads safe for vision models.  
For heavy lifting, we spawn `dedalus_agent.py` inside a local virtual environment. The agent uses `dedalus-labs` to multiplex requests across MCP-connected tools and large-model backends. Responses are pushed back over stdio, parsed in Node, and relayed to the chat with friendly status updates.

## Challenges we ran into
- Keeping the cross-language bridge resilient: stdio parsing, timeouts, and retry logic had to be tuned so the bot never froze a conversation.
- Managing context windows: large PDFs and rich conversation history forced us to implement truncation rules and file-level knowledge caching.
- Handling image payloads: we needed size checks and base64 guards so GPT-4o vision calls stayed within limits.
- Local environment drift: ensuring that the Python virtualenv matched the hard-coded path required clear setup conventions.

## Accomplishments
- Delivered an end-to-end chat assistant that feels native to iMessage while tapping into multi-model intelligence.
- Built an extensible knowledge base layer that keeps replies grounded without overwhelming the models.
- Implemented adaptive model routing inside the Dedalus agent, letting creative, analytical, and vision tasks succeed with minimal manual prompting.

## What we learned
- Cross-process orchestration is smoother when each side emits structured JSON logs—we leaned heavily on that for debugging.
- Thoughtful context management beats bigger prompts; small, curated snippets improved responsiveness and cost.
- MCP integrations dramatically expand what a chat assistant can do without bloating the core codebase.

## Next Steps

Adding more agents for more versatile functionalities