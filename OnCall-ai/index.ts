// --- Save this as index.ts ---

import { IMessageSDK, type Message } from '@photon-ai/imessage-kit';
import * as fs from 'fs';
import * as path from 'path';

const BOT_NAME = '@OnCall-AI';

// --- THIS IS THE NEW, CORRECTED FUNCTION ---
async function handleTaggedMessage(sdk: IMessageSDK, message: Message) {
  
  // This is how you check for the tag using the chain API
  const didTag = message.text && message.text.toLowerCase().includes(BOT_NAME.toLowerCase());

  if (!didTag) {
    // Not for us, ignore it.
    return;
  }

  // Get the prompt text *after* the tag
  const prompt = message.text.replace(new RegExp(BOT_NAME, 'i'), '').trim();

  // --- Command: "send logs" ---
  if (prompt.toLowerCase().includes('send logs')) {
    
    console.log('[INFO] "send logs" command detected.');
    
    // 1. First, reply to let them know you're working
    await sdk.message(message)
      .replyText('One moment, I am pulling the server logs...')
      .execute(); //

    // --- Create dummy log content ---
    const logContent = `--- DUMMY LOGS ---
[${new Date().toISOString()}] FATAL: OutOfMemoryError
[${new Date().toISOString()}] INFO: User 'jaehun' triggered alert.
--- END OF LOGS ---`;
    
    // 2. Send the logs *as text*
    // This is the most reliable way to send text data in a reply
    await sdk.message(message)
      .replyText(logContent) //
      .execute(); //
    
    console.log(`[INFO] Successfully sent logs to chat ${message.chatId}`);

  // --- Command: "send report" (Example for Image/File) ---
  // The docs show .replyImage(), not .replyFile().
  // You can try this with a PDF, but it's designed for images.
  } else if (prompt.toLowerCase().includes('send report')) {
    
    const pdfFilePath = path.join(__dirname, 'dummy_report.pdf');
      
    if (fs.existsSync(pdfFilePath)) {
      
      await sdk.message(message)
        .replyText('Sending the report as a file...') //
        .execute(); //

      // This method is for images, but you can test if it works for other files.
      // If this fails, the library doesn't support file *replies* (only text/image).
      await sdk.message(message)
        .replyImage(pdfFilePath) //
        .execute(); //

    } else {
      await sdk.message(message)
        .replyText("Sorry, I couldn't find 'dummy_report.pdf' to send.") //
        .execute(); //
    }

  // --- Default Greeting ---
  } else {
    console.log(`[INFO] Replying with default greeting.`);
    await sdk.message(message)
      .replyText(`Hi! I am OnCall-AI. I received your message: "${prompt}"`) //
      .execute(); //
  }
}

// --- Main Function to Start the Bot (Updated) ---
async function main() {
  try {
    const sdk = new IMessageSDK({
      watcher: { unreadOnly: false }
    });

    console.log('[INFO] OnCall-AI bot starting...');

    await sdk.startWatching({
      
      onGroupMessage: async (message: Message) => {
        // --- This is a built-in safety check ---
        // It's better than the manual `isFromMe` check.
        if (message.isFromMe) { 
          return;
        }
        
        await handleTaggedMessage(sdk, message);
      },
      
      onNewMessage: async (message: Message) => {
        if (message.isFromMe) {
          return;
        }
        await sdk.message(message)
          .replyText("Hi! I only work in group chats for now.") //
          .execute(); //
      },

      onError: (error) => {
        // This will prevent the watcher from crashing on a single bad message
        console.error('[ERROR] Watcher failed on a message:', error);
      }
    });

    console.log('[INFO] Watcher is running. Send a message to your group chat.');

  } catch (error) {
    console.error('[ERROR] Failed to initialize SDK:', error);
  }
}

main();