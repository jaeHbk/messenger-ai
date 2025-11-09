// --- Save this as index.ts ---

import { IMessageSDK, type Message, type Attachment } from '@photon-ai/imessage-kit';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// --- Bot Configuration ---
const BOT_NAME = '@Brief-AI';

let dedalusAgent: ChildProcessWithoutNullStreams | null = null;

function startDedalusAgent(): void {
  console.log('[DEBUG] 1. Starting Dedalus agent...');
  if (dedalusAgent) {
    console.log('[DEBUG] 2. Dedalus agent already running');
    return;
  }
  
  console.log('[DEBUG] 3. Spawning Python process...');
  dedalusAgent = spawn('/Users/johnkim/projects/messenger-ai/venv/bin/python', ['/Users/johnkim/projects/messenger-ai/dedalus_agent.py'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('[DEBUG] 4. Dedalus agent spawned successfully');
}

function stopDedalusAgent(): void {
  if (dedalusAgent) {
    dedalusAgent.kill();
    dedalusAgent = null;
  }
}

async function queryDedalusAgent(query: string): Promise<string> {
  if (!dedalusAgent) {
    startDedalusAgent();
  }

  console.log('[DEBUG] Sending query to Dedalus:', query);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('[DEBUG] Dedalus agent timeout after 30s');
      reject(new Error('Dedalus agent timeout'));
    }, 120000);

    let responseData = '';
    
    const onData = (data: Buffer) => {
      const chunk = data.toString();
      console.log('[DEBUG] Received from Dedalus:', chunk);
      
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line.trim());
            console.log('[DEBUG] Parsed response:', response);
            
            if (response.status === 'success') {
              clearTimeout(timeout);
              dedalusAgent!.stdout.off('data', onData);
              resolve(response.result || response.received);
              return;
            } else if (response.status === 'error') {
              clearTimeout(timeout);
              dedalusAgent!.stdout.off('data', onData);
              reject(new Error(response.error));
              return;
            }
          } catch (e) {
            // Not JSON, ignore (debug messages)
            console.log('[DEBUG] Non-JSON line ignored:', line.trim());
          }
        }
      }
    };

    const onError = (error: Buffer) => {
      console.log('[DEBUG] Dedalus stderr:', error.toString());
    };

    dedalusAgent!.stdout.on('data', onData);
    dedalusAgent!.stderr.on('data', onError);
    dedalusAgent!.stdin.write(JSON.stringify({ query }) + '\n');
    console.log('[DEBUG] Query sent to Dedalus');
  });
}

async function summarizeAndStore(chatId: string, file: Attachment): Promise<string> {
  const query = `Please analyze and summarize this file: ${file.filename}`;
  try {
    return await queryDedalusAgent(query);
  } catch (error) {
    return `Error analyzing file: ${error}`;
  }
}

async function answerQuestion(chatId: string, question: string): Promise<string> {
  try {
    return await queryDedalusAgent(question);
  } catch (error) {
    return `Error processing question: ${error}`;
  }
}


// --- MESSAGE HANDLERS ---

/**
 * HANDLER 1: Proactive File Reader
 * This handler now works for ANY file type.
 */
async function handleFileLogic(sdk: IMessageSDK, message: Message, file: Attachment) {
  await sdk.message(message)
    .replyText(`Analyzing "${file.filename}"...`)
    .execute();

  const summary = await summarizeAndStore(message.chatId, file);

  await sdk.message(message)
    .replyText(summary)
    .execute();
}

async function handleTagLogic(sdk: IMessageSDK, message: Message) {
  const text = message.text || '';
  const question = text.replace(new RegExp(BOT_NAME, 'i'), '').trim();
  
  await sdk.message(message)
    .replyText(`Processing: "${question}"...`)
    .execute();

  const answer = await answerQuestion(message.chatId, question);

  await sdk.message(message)
    .replyText(answer)
    .execute();
}


async function main() {
  try {
    console.log('[DEBUG] 5. Creating IMessageSDK...');
    const sdk = new IMessageSDK({
      watcher: { unreadOnly: false }
    });
    console.log('[DEBUG] 6. IMessageSDK created successfully');

    console.log('[INFO] Brief-AI starting with Dedalus integration...');
    startDedalusAgent();

    console.log('[DEBUG] 7. Setting up message watchers...');
    await sdk.startWatching({
      onGroupMessage: async (message: Message) => {
        console.log('[DEBUG] 8. Message received:', message.text, 'Files:', message.attachments?.length || 0);
        
        const text = message.text || '';
        const hasFile = message.attachments && message.attachments.length > 0;

        console.log('[DEBUG] 9. Processing message...');
        if (hasFile) {
          console.log('[DEBUG] 10. Handling file logic...');
          await handleFileLogic(sdk, message, message.attachments[0]);
        } else if (text.trim()) {
          console.log('[DEBUG] 11. Handling tag logic...');
          await handleTagLogic(sdk, message);
        } else {
          console.log('[DEBUG] 12. No action taken for message');
        }
      },
      onError: (error) => {
        console.error('[ERROR]', error);
      }
    });
    console.log('[DEBUG] 13. Message watchers set up successfully');

    console.log('[INFO] Watching for messages...');
    
    // Test every 30 seconds to confirm the bot is alive
    setInterval(() => {
      console.log('[DEBUG] Bot still running...');
    }, 30000);

    process.on('SIGTERM', stopDedalusAgent);
    process.on('SIGINT', stopDedalusAgent);

  } catch (error) {
    console.error('[ERROR]', error);
    stopDedalusAgent();
    process.exit(1);
  }
}

main();