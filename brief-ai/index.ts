// --- Save this as index.ts ---

import { IMessageSDK, type Message, type Attachment } from '@photon-ai/imessage-kit';
import * as fs from 'fs';
import * as path from 'path';

// --- Bot Configuration ---
const BOT_NAME = '@Brief-AI';

/**
 * This is our "AI's memory". It's just a simple map.
 * We'll store "mock" knowledge based on the filename.
 */
const knowledgeBase = new Map<string, string>();

// --- "AI" FUNCTIONS (100% LOCAL MOCKS) ---

/**
 * MOCK AI (Summarizer):
 * "Pretends" to read ANY file and generates a mock summary.
 */
async function summarizeAndStore(chatId: string, file: Attachment): Promise<string> {
  // This function is now guaranteed to work for ANY file.
  
  // 1. "Understand" the file by its name
  const fileInfo = `[Mock Knowledge] I have stored the file: '${file.filename}'`;
  
  // 2. Add this "knowledge" to our local base
  const currentKnowledge = knowledgeBase.get(chatId) || '';
  const newKnowledge = currentKnowledge + '\n' + fileInfo;
  knowledgeBase.set(chatId, newKnowledge);

  // 3. Return a "mock summary"
  const summary = `This is a mock summary for "${file.filename}". I have successfully 'read' it and added it to my knowledge base.`;
  
  // We add a small delay to make it feel like a real AI
  await new Promise(resolve => setTimeout(resolve, 1500)); 

  return summary;
}

/**
 * MOCK AI (Q&A):
 * "Pretends" to answer a question using the mock knowledge base.
 */
async function answerQuestion(chatId: string, question: string): Promise<string> {
  const context = knowledgeBase.get(chatId);

  if (!context) {
    return "I don't have any knowledge for this chat yet. Please upload a file, and I'll read it.";
  }
  
  // --- MOCK AI RESPONSE ---
  // We'll just check if a keyword from the question is in our "mock" context
  const questionWords = question.toLowerCase().split(' ');
  const foundWord = questionWords.find(word => context.toLowerCase().includes(word));

  let answer = '';
  if (foundWord) {
    answer = `[Mock AI]: I found information related to "${foundWord}" in my knowledge base.`;
  } else {
    answer = `[Mock AI]: I couldn't find an answer to "${question}" in the files I've read.`;
  }

  // We add a small delay to make it feel like a real AI
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return answer;
}


// --- MESSAGE HANDLERS ---

/**
 * HANDLER 1: Proactive File Reader
 * This handler now works for ANY file type.
 */
async function handleFileLogic(sdk: IMessageSDK, message: Message, file: Attachment) {
  console.log(`[INFO] File detected in chat ${message.chatId}: ${file.filename}`);
  
  // **THIS IS THE FIX**: We removed the ".pdf" check.
  // This code block will now run for ANY file.
  
  // 1. Acknowledge
  await sdk.message(message)
    .replyText(`Thanks! I'm 'reading' "${file.filename}" now...`)
    .execute();

  // 2. "Read" and "summarize" (using our new mock function)
  const summary = await summarizeAndStore(message.chatId, file);

  // 3. Post the summary
  await sdk.message(message)
    .replyText(summary)
    .execute();
    
  await sdk.message(message)
    .replyText('I have added this file to my knowledge base. Feel free to tag me (@Brief-AI) to ask questions about it.')
    .execute();
}

/**
 * HANDLER 2: Reactive Q&A (No changes needed)
 */
async function handleTagLogic(sdk: IMessageSDK, message: Message) {
  const text = message.text || '';
  
  console.log(`[INFO] Bot was tagged in chat: ${message.chatId}`);
  const question = text.replace(new RegExp(BOT_NAME, 'i'), '').trim();
  
  await sdk.message(message)
    .replyText(`Got it. Searching my knowledge base for: "${question}"...`)
    .execute();

  const answer = await answerQuestion(message.chatId, question);

  await sdk.message(message)
    .replyText(answer)
    .execute();
}


// --- Main Bot Startup Function (No changes needed) ---
async function main() {
  try {
    const sdk = new IMessageSDK({
      watcher: { unreadOnly: false }
    });

    console.log('[INFO] Brief-AI (The AI Dropbox) is starting...');
    console.log('[INFO] Grant Full Disk Access to your terminal.');

    await sdk.startWatching({
      onGroupMessage: async (message: Message) => {
        console.log(`[DEBUG] New group message received. 
            FromMe: ${message.isFromMe}. 
            Attachments: ${message.attachments ? message.attachments.length : 0}
            Text: ${message.text}
            ChatID: ${message.chatId}`);

        if (message.isFromMe) return; 

        const text = message.text || '';
        const isTagged = text.toLowerCase().includes(BOT_NAME.toLowerCase());
        const hasFile = message.attachments && message.attachments.length > 0;

        if (hasFile) {
          const filename = message.attachments[0].filename;
          console.log(`[DEBUG] Message has a file: ${filename}`);
          await handleFileLogic(sdk, message, message.attachments[0]);
        } else if (isTagged) {
          console.log(`[DEBUG] Message has a tag: ${text}`);
          await handleTagLogic(sdk, message);
        }
      },
      onError: (error) => {
        console.error('[ERROR] Watcher failed on a message:', error);
      }
    });

    console.log('[INFO] Watcher is running. Waiting for file uploads or tags...');

  } catch (error) {
    console.error('[ERROR] Failed to initialize SDK:', error);
    process.exit(1);
  }
}

main();