import { type Attachment, type Message } from '@photon-ai/imessage-kit';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';

interface FileEntry {
  filename: string;
  content: string;
}

const knowledgeBase = new Map<string, FileEntry[]>();

interface MessageHistoryEntry {
  senderName: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    type: string;
    extractedContent?: string;
  }>;
  timestamp: Date;
}

const messageHistory = new Map<string, MessageHistoryEntry[]>();

async function extractPdfText(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  try {
    const { text } = await parser.getText();
    return text;
  } finally {
    try {
      await parser.destroy();
    } catch (error) {
      console.warn(`[WARN] Failed to destroy PDF parser for ${filePath}:`, error);
    }
  }
}

export interface FileResult {
  summary: string;
  content: string;
}

export async function processAndStoreFile(chatId: string, file: Attachment): Promise<FileResult> {
  console.log(`[INFO] Processing file: ${file.filename}`);

  const fileExtension = path.extname(file.filename).toLowerCase();
  let extractedText = '';

  if (fileExtension === '.pdf') {
    extractedText = await extractPdfText(file.path);
  } else if (fileExtension === '.txt' || fileExtension === '.md') {
    extractedText = await fs.readFile(file.path, 'utf8');
  } else {
    extractedText = `[File: ${file.filename}]`;
  }

  const files = knowledgeBase.get(chatId) || [];
  files.push({
    filename: file.filename,
    content: extractedText
  });

  if (files.length > 10) {
    files.shift();
  }

  knowledgeBase.set(chatId, files);

  return {
    summary: `Successfully read and stored the content from "${file.filename}".`,
    content: extractedText
  };
}

export async function addMessageToHistory(chatId: string, message: Message): Promise<void> {
  const history = messageHistory.get(chatId) || [];

  const entry: MessageHistoryEntry = {
    senderName: message.isFromMe ? 'You' : (message.senderName || 'Unknown'),
    text: message.text ?? undefined,
    timestamp: new Date()
  };

  if (message.attachments && message.attachments.length > 0) {
    entry.attachments = [];

    for (const attachment of message.attachments) {
      const fileExtension = path.extname(attachment.filename).toLowerCase();
      let extractedContent = '';

      if (fileExtension === '.pdf') {
        extractedContent = await extractPdfText(attachment.path);
      } else if (fileExtension === '.txt' || fileExtension === '.md') {
        extractedContent = await fs.readFile(attachment.path, 'utf8');
      } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
        extractedContent = `[Image: ${attachment.filename}]`;
      } else {
        extractedContent = `[File: ${attachment.filename}]`;
      }

      entry.attachments.push({
        filename: attachment.filename,
        type: fileExtension,
        extractedContent
      });
    }
  }

  history.push(entry);

  if (history.length > 10) {
    history.shift();
  }

  messageHistory.set(chatId, history);
}

export function getConversationContext(chatId: string): string {
  const history = messageHistory.get(chatId) || [];

  if (history.length === 0) return '';

  const contextLines: string[] = ['--- Recent Conversation History ---'];

  for (const entry of history) {
    let messageLine = `${entry.senderName}: `;

    if (entry.text) {
      messageLine += entry.text;
    }

    if (entry.attachments && entry.attachments.length > 0) {
      for (const attachment of entry.attachments) {
        messageLine += `\n  [Attachment: ${attachment.filename}]`;
        if (attachment.extractedContent) {
          const content = attachment.extractedContent.length > 500
            ? attachment.extractedContent.substring(0, 500) + '...'
            : attachment.extractedContent;
          messageLine += `\n  Content: ${content}`;
        }
      }
    }

    contextLines.push(messageLine);
  }

  contextLines.push('--- End of Conversation History ---');
  return contextLines.join('\n');
}

export function getKnowledgeBase(chatId: string): string | undefined {
  const files = knowledgeBase.get(chatId) || [];

  if (files.length === 0) return undefined;

  return files.map(file =>
    `--- Content from ${file.filename} ---\n${file.content}\n--- End of Content ---`
  ).join('\n\n');
}

export function clearKnowledgeBase(chatId: string): void {
  knowledgeBase.delete(chatId);
}

export function clearMessageHistory(chatId: string): void {
  messageHistory.delete(chatId);
}