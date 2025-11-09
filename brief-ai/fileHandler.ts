import { type Attachment, type Message } from '@photon-ai/imessage-kit';
import * as path from 'path';
import { contextManager } from './processors/contextManager';
import { pdfProcessor } from './processors/pdfProcessor';
import { imageProcessor } from './processors/imageProcessor';

export interface FileResult {
  summary: string;
  content: string;
  success: boolean;
  fileType: string;
}

export async function processAndStoreFile(chatId: string, file: Attachment): Promise<FileResult> {
  console.log(`[INFO] Processing file: ${file.filename}`);

  const fileExtension = path.extname(file.filename).toLowerCase();
  let extractedContent = '';
  let success = true;
  let fileType = '';

  try {
    if (fileExtension === '.pdf') {
      fileType = 'PDF';
      const result = await pdfProcessor.processPDF(file.path);
      extractedContent = result.content;
      success = result.success;
    } 
    else if (imageProcessor.isImageFile(file.filename)) {
      fileType = 'Image';
      const result = await imageProcessor.processImage(file.path, file.filename);
      extractedContent = result.content;
      success = result.success;
    }
    else if (fileExtension === '.txt' || fileExtension === '.md') {
      fileType = 'Text';
      const fs = await import('fs/promises');
      extractedContent = await fs.readFile(file.path, 'utf8');
    }
    else {
      fileType = 'Unknown';
      extractedContent = `[File: ${file.filename}]`;
    }

    // Store in knowledge base
    if (success && extractedContent && !extractedContent.startsWith('[Error')) {
      contextManager.addFileToKnowledgeBase(chatId, file.filename, extractedContent);
    }

    return {
      summary: success 
        ? `Successfully processed ${fileType.toLowerCase()} file "${file.filename}".`
        : `Failed to process ${fileType.toLowerCase()} file "${file.filename}".`,
      content: extractedContent,
      success,
      fileType
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing file ${file.filename}:`, errorMessage);
    
    return {
      summary: `Error processing file "${file.filename}": ${errorMessage}`,
      content: `[Error: ${errorMessage}]`,
      success: false,
      fileType: 'Error'
    };
  }
}

// Delegate to context manager
export async function addMessageToHistory(chatId: string, message: Message): Promise<void> {
  return contextManager.addMessageToHistory(chatId, message);
}

export function getConversationContext(chatId: string): string {
  return contextManager.getConversationContext(chatId);
}

export function getKnowledgeBase(chatId: string): string | undefined {
  return contextManager.getKnowledgeBase(chatId);
}

export function clearKnowledgeBase(chatId: string): void {
  contextManager.clearKnowledgeBase(chatId);
}

export function clearMessageHistory(chatId: string): void {
  contextManager.clearMessageHistory(chatId);
}