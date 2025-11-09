import { promises as fs } from 'fs';
import { PDFParse } from 'pdf-parse';

export interface PDFResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: {
    pageCount?: number;
    fileSize: number;
    processingTime: number;
  };
}

class PDFProcessor {
  async processPDF(filePath: string): Promise<PDFResult> {
    const startTime = Date.now();
    
    try {
      console.log('5. Reading PDF file:', filePath);
      
      // Read file and get size
      const dataBuffer = await fs.readFile(filePath);
      const fileSize = dataBuffer.length;
      console.log('6. PDF buffer size:', fileSize);

      // Initialize PDF parser
      const parser = new PDFParse({ data: dataBuffer });

      try {
        console.log('7. Extracting PDF text...');
        const result = await parser.getText();
        const processingTime = Date.now() - startTime;
        
        console.log('8. PDF text extracted, length:', result.text.length);

        return {
          success: true,
          content: result.text,
          metadata: {
            pageCount: result.total || undefined,
            fileSize,
            processingTime
          }
        };
      } finally {
        // Always clean up parser
        try {
          await parser.destroy();
        } catch (error) {
          console.warn(`[WARN] Failed to destroy PDF parser for ${filePath}:`, error);
        }
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Error processing PDF:', errorMessage);
      
      return {
        success: false,
        content: `[Error processing PDF: ${errorMessage}]`,
        error: errorMessage,
        metadata: {
          fileSize: 0,
          processingTime
        }
      };
    }
  }

  // Utility method to validate PDF files
  isValidPDFPath(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.pdf');
  }

  // Method to get PDF info without full text extraction (faster)
  async getPDFInfo(filePath: string): Promise<{ fileSize: number; exists: boolean }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        fileSize: stats.size,
        exists: true
      };
    } catch {
      return {
        fileSize: 0,
        exists: false
      };
    }
  }
}

// Export singleton instance
export const pdfProcessor = new PDFProcessor();