import { type Attachment } from '@photon-ai/imessage-kit';
import * as fs from 'fs';
import * as path from 'path';
import pdf = require('pdf-parse');

// In-memory knowledge base for each chat
const knowledgeBase = new Map<string, string>();

export interface FileResult {
  summary: string;
  content: string;
}

export async function processAndStoreFile(chatId: string, file: Attachment): Promise<FileResult> {
  console.log(`[INFO] Processing file: ${file.filename}`);
  let extractedText = '';

  const filePath = file.path;

  try {
    const fileExtension = path.extname(file.filename).toLowerCase();

    if (fileExtension === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await (pdf as any)(dataBuffer);
      extractedText = data.text;
    } else if (fileExtension === '.txt' || fileExtension === '.md') {
      extractedText = fs.readFileSync(filePath, 'utf8');
    } else {
      const unsupportedMsg = `[INFO] File type '${fileExtension}' not supported for text extraction. Storing filename only.`;
      console.log(unsupportedMsg);
      extractedText = `[File: ${file.filename}]`;
    }

    // Add extracted text to knowledge base
    const currentKnowledge = knowledgeBase.get(chatId) || '';
    const newKnowledge = currentKnowledge + `\n\n--- Content from ${file.filename} ---\n${extractedText}\n--- End of Content ---`;
    knowledgeBase.set(chatId, newKnowledge);

    const summary = `Successfully read and stored the content from "${file.filename}".`;
    return { summary, content: extractedText };

  } catch (error) {
    console.error(`[ERROR] Failed to read file ${file.filename}:`, error);
    return { 
      summary: `Sorry, I failed to read the content of "${file.filename}".`, 
      content: '' 
    };
  }
}

export function getKnowledgeBase(chatId: string): string | undefined {
  return knowledgeBase.get(chatId);
}

export function clearKnowledgeBase(chatId: string): void {
  knowledgeBase.delete(chatId);
}