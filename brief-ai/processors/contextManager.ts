import { type Message } from '@photon-ai/imessage-kit';

export interface FileEntry {
  filename: string;
  content: string;
}

export interface MessageHistoryEntry {
  senderName: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    type: string;
    extractedContent?: string;
  }>;
  timestamp: Date;
}

class ContextManager {
  private knowledgeBase = new Map<string, FileEntry[]>();
  private messageHistory = new Map<string, MessageHistoryEntry[]>();
  private readonly MAX_HISTORY = 10;
  private readonly MAX_FILES = 10;

  // Knowledge Base Management
  addFileToKnowledgeBase(chatId: string, filename: string, content: string): void {
    const files = this.knowledgeBase.get(chatId) || [];
    files.push({ filename, content });

    if (files.length > this.MAX_FILES) {
      files.shift();
    }

    this.knowledgeBase.set(chatId, files);
  }

  getKnowledgeBase(chatId: string): string | undefined {
    const files = this.knowledgeBase.get(chatId) || [];

    if (files.length === 0) return undefined;

    return files.map(file =>
      `--- Content from ${file.filename} ---\n${file.content}\n--- End of Content ---`
    ).join('\n\n');
  }

  clearKnowledgeBase(chatId: string): void {
    this.knowledgeBase.delete(chatId);
  }

  // Message History Management
  async addMessageToHistory(chatId: string, message: Message): Promise<void> {
    const history = this.messageHistory.get(chatId) || [];

    const entry: MessageHistoryEntry = {
      senderName: message.isFromMe ? 'You' : (message.senderName || 'Unknown'),
      text: message.text ?? undefined,
      timestamp: new Date()
    };

    // Handle attachments if present
    if (message.attachments && message.attachments.length > 0) {
      entry.attachments = message.attachments.map(attachment => ({
        filename: attachment.filename,
        type: this.getFileExtension(attachment.filename),
        extractedContent: `[${this.getFileTypeDescription(attachment.filename)}: ${attachment.filename}]`
      }));
    }

    history.push(entry);

    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }

    this.messageHistory.set(chatId, history);
  }

  getConversationContext(chatId: string): string {
    const history = this.messageHistory.get(chatId) || [];

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

  clearMessageHistory(chatId: string): void {
    this.messageHistory.delete(chatId);
  }

  // Utility methods
  private getFileExtension(filename: string): string {
    return filename.toLowerCase().split('.').pop() || '';
  }

  private getFileTypeDescription(filename: string): string {
    const ext = this.getFileExtension(filename);
    
    switch (ext) {
      case 'pdf': return 'PDF Document';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return 'Image';
      case 'txt': return 'Text File';
      case 'md': return 'Markdown File';
      default: return 'File';
    }
  }

  // Debug/Stats methods
  getChatStats(chatId: string): { messageCount: number; fileCount: number } {
    const messages = this.messageHistory.get(chatId) || [];
    const files = this.knowledgeBase.get(chatId) || [];
    
    return {
      messageCount: messages.length,
      fileCount: files.length
    };
  }

  getAllChats(): string[] {
    const allChats = new Set([
      ...this.messageHistory.keys(),
      ...this.knowledgeBase.keys()
    ]);
    return Array.from(allChats);
  }
}

// Export singleton instance
export const contextManager = new ContextManager();