# Messenger-AI
HackPrinceton 2026 

## Inspiration

## What it does
An iMessage bot (using Photon’s iMessage Kit) that sends a PDF into a group chat when someone says the keyword (default: `pdf`).

## How we built it
We use the iMessage Kit watcher on macOS to listen to group messages and reply with a local PDF file when the keyword appears.

Reference: [photon-hq/imessage-kit](https://github.com/photon-hq/imessage-kit)

Run locally (Node.js):

1) Install dependencies:

```bash
npm install
```

2) Create a `.env` file:

```bash
PDF_FILE_PATH=/absolute/path/to/your.pdf
PDF_KEYWORD=pdf
```

3) Grant your Terminal/IDE Full Disk Access (macOS) so the SDK can read `~/Library/Messages/chat.db`.

4) Start the bot:

```bash
npm start
```

5) In any iMessage group chat on this Mac, send a message containing `pdf`. The bot replies in that chat with the PDF.

## Challenges we ran into
macOS permissions and ensuring the PDF is available locally (sending works best with local files).

## Accomplishments
Single-purpose, testable MVP that proves end-to-end iMessage group interaction with file sending.

## What we learned
Start with one trigger and one action to validate the integration quickly.

## Next Steps
- Add reaction/tapback handling (e.g., 👍 tally).
- Support downloading PDFs from URLs to a temp file before sending.

some more epic stuff