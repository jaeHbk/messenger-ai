import { IMessageSDK, type Message, type Attachment } from '@photon-ai/imessage-kit';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import { processAndStoreFile, getConversationContext, addMessageToHistory, getKnowledgeBase } from './fileHandler';

const BOT_NAME = '@Brief-AI';

let dedalusAgent: ChildProcessWithoutNullStreams | null = null;

// Starts the agent
function startDedalusAgent(): void {
  console.log('[DEBUG] Starting Dedalus agent...');
  if (dedalusAgent) {
    console.log('[DEBUG] Dedalus agent already running');
    return;
  }
  
  // Get project root (parent of brief-ai directory)
  const projectRoot = join(__dirname, '..');
  const pythonPath = join(projectRoot, 'venv', 'bin', 'python');
  const agentScriptPath = join(projectRoot, 'dedalus_agent.py');
  
  console.log('[DEBUG] Spawning Python process...');
  console.log('[DEBUG] Python path:', pythonPath);
  console.log('[DEBUG] Agent script:', agentScriptPath);
  
  dedalusAgent = spawn(pythonPath, [agentScriptPath], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('[DEBUG] Dedalus agent spawned successfully');
}

function stopDedalusAgent(): void {
  if (dedalusAgent) {
    dedalusAgent.kill();
    dedalusAgent = null;
  }
}

async function queryDedalusAgent(query: string, chatId: string): Promise<string> {
  if (!dedalusAgent) {
    startDedalusAgent();
  }

  console.log('[DEBUG] Sending query to Dedalus:', query);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('[DEBUG] Dedalus agent timeout after 120s');
      reject(new Error('Dedalus agent timeout'));
    }, 120000);

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
    dedalusAgent!.stdin.write(JSON.stringify({ query, chat_id: chatId }) + '\n');
    console.log('[DEBUG] Query sent to Dedalus');
  });
}

async function answerQuestion(chatId: string, question: string): Promise<string> {
  // Smart context management - reduce context for large content and image tasks
  const questionLower = question.toLowerCase();
  const isImageAnalysis = questionLower.includes('analyze image') || question.includes('data:image') || questionLower.includes('describe image');
  const isImageGeneration = questionLower.includes('create image') || questionLower.includes('generate image') || questionLower.includes('draw') || questionLower.includes('make picture');
  
  if (isImageAnalysis) {
    // For image analysis, use minimal context to avoid token limits
    const conversationContext = getConversationContext(chatId);
    const recentContext = conversationContext ? conversationContext.split('\n').slice(-5).join('\n') : '';
    const fullQuery = recentContext ? `${recentContext}\n\nCurrent question: ${question}` : question;
    return await queryDedalusAgent(fullQuery, chatId);
  } else if (isImageGeneration) {
    // For image generation, use minimal context - DALL-E doesn't need conversation history
    return await queryDedalusAgent(question, chatId);
  } else {
    // Normal context management for non-image queries
    const conversationContext = getConversationContext(chatId);
    const fileContext = getKnowledgeBase(chatId);

    let fullQuery = '';

    if (conversationContext && fileContext) {
      fullQuery = `${conversationContext}\n\nFile contents:\n${fileContext}\n\nCurrent question: ${question}`;
    } else if (conversationContext) {
      fullQuery = `${conversationContext}\n\nCurrent question: ${question}`;
    } else if (fileContext) {
      fullQuery = `File contents:\n${fileContext}\n\nQuestion: ${question}`;
    } else {
      fullQuery = question;
    }

    return await queryDedalusAgent(fullQuery, chatId);
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

  const { content, success, fileType } = await processAndStoreFile(message.chatId, file);
  
  if (!success) {
    // If file processing failed, send error message
    await sdk.message(message)
      .replyText(content) // content contains error message
      .execute();
    return;
  }

  // Smart context management based on file type
  const isImageFile = fileType === 'Image';
  
  if (isImageFile) {
    // For images, use minimal context to avoid token limits
    const analysisQuery = `Analyze this image file ${file.filename}:\n\n${content}`;
    const analysis = await queryDedalusAgent(analysisQuery, message.chatId);
    
    await sdk.message(message)
      .replyText(analysis)
      .execute();
  } else {
    // For other files, use full context
    const conversationContext = getConversationContext(message.chatId);
    const analysisQuery = conversationContext
      ? `${conversationContext}\n\nAnalyze this file content from ${file.filename}:\n\n${content}`
      : `Analyze this file content from ${file.filename}:\n\n${content}`;

    const analysis = await queryDedalusAgent(analysisQuery, message.chatId);
    
    await sdk.message(message)
      .replyText(analysis)
      .execute();
  }
}

// I believe this handles no text?
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


// --- Main Bot Startup ---
async function main() {
  try {
    console.log('[INFO] Brief-AI starting with Dedalus integration...');
    
    // Initialize iMessage SDK
    const sdk = new IMessageSDK({
      watcher: { unreadOnly: false }
    });

    // Start Dedalus agent
    startDedalusAgent();

    // Set up message watchers
    await sdk.startWatching({
      onGroupMessage: async (message: Message) => {
        console.log('1. Message received:', message.text);
        console.log('2. Attachments:', message.attachments?.length || 0, message.attachments);
        
        // ALWAYS store the message in history first (including bot's own responses)
        await addMessageToHistory(message.chatId, message);

        // Don't respond to our own messages
        if (message.isFromMe) {
          console.log('3. Ignoring own message');
          return;
        }

        const text = message.text || '';
        const isTagged = text.toLowerCase().includes(BOT_NAME.toLowerCase());
        const hasFile = message.attachments && message.attachments.length > 0;

        console.log('4. Tagged:', isTagged, '| Has file:', hasFile);

        // Only respond if tagged or has file
        if (hasFile) {
          console.log('5. Processing file');
          await handleFileLogic(sdk, message, message.attachments[0]);
        } else if (isTagged) {
          console.log('5. Processing tagged message');
          await handleTagLogic(sdk, message);
        } else {
          console.log('5. No action needed');
        }
      },
      onError: (error) => {
        console.error('[ERROR]', error);
      }
    });

    console.log('[INFO] Watching for messages...');

    // Cleanup on exit
    process.on('SIGTERM', stopDedalusAgent);
    process.on('SIGINT', stopDedalusAgent);

  } catch (error) {
    console.error('[ERROR]', error);
    stopDedalusAgent();
    process.exit(1);
  }
}

main();