import { promises as fs } from 'fs';
import * as path from 'path';

export interface ImageResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: {
    fileSize: number;
    format: string;
    base64Length: number;
    processingTime: number;
  };
}

class ImageProcessor {
  private readonly SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit
  private readonly MAX_BASE64_LENGTH = 1000000; // ~1M characters for base64 (~750KB image)

  async processImage(filePath: string, filename: string): Promise<ImageResult> {
    const startTime = Date.now();
    
    try {
      console.log('5. Processing image file:', filePath);
      
      // Validate file format
      const fileExtension = path.extname(filename).toLowerCase();
      if (!this.isValidImageFormat(fileExtension)) {
        return {
          success: false,
          content: `[Unsupported image format: ${fileExtension}]`,
          error: `Unsupported format: ${fileExtension}`
        };
      }

      // Read file and check size
      const imageBuffer = await fs.readFile(filePath);
      const fileSize = imageBuffer.length;
      console.log('6. Image buffer size:', fileSize);

      // Check file size limit
      if (fileSize > this.MAX_FILE_SIZE) {
        return {
          success: false,
          content: `[Image too large: ${this.formatFileSize(fileSize)}]`,
          error: `File too large: ${this.formatFileSize(fileSize)}`
        };
      }

      // Convert to base64 for GPT-4o
      const base64Data = imageBuffer.toString('base64');
      
      // Check if base64 is too large for context window
      if (base64Data.length > this.MAX_BASE64_LENGTH) {
        console.log('7. Image too large for context, creating placeholder');
        return {
          success: false,
          content: `[Large Image: ${filename} (${this.formatFileSize(fileSize)}) - Too large for analysis. Please use a smaller image or compress it first.]`,
          error: `Image too large for analysis: ${this.formatFileSize(fileSize)}`,
          metadata: {
            fileSize,
            format: fileExtension,
            base64Length: base64Data.length,
            processingTime: Date.now() - startTime
          }
        };
      }
      
      const mimeType = this.getMimeType(fileExtension);
      
      // Create data URL format that vision models expect
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      const processingTime = Date.now() - startTime;
      
      console.log('7. Image converted to base64, length:', base64Data.length);
      
      return {
        success: true,
        content: dataUrl,
        metadata: {
          fileSize,
          format: fileExtension,
          base64Length: base64Data.length,
          processingTime
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Error processing image:', errorMessage);
      
      return {
        success: false,
        content: `[Error processing image: ${errorMessage}]`,
        error: errorMessage,
        metadata: {
          fileSize: 0,
          format: '',
          base64Length: 0,
          processingTime
        }
      };
    }
  }

  // Utility methods
  isValidImageFormat(extension: string): boolean {
    return this.SUPPORTED_FORMATS.includes(extension.toLowerCase());
  }

  isImageFile(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    return this.isValidImageFormat(extension);
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Method to get image info without full processing (faster)
  async getImageInfo(filePath: string): Promise<{ fileSize: number; exists: boolean; format: string }> {
    try {
      const stats = await fs.stat(filePath);
      const format = path.extname(filePath).toLowerCase();
      
      return {
        fileSize: stats.size,
        exists: true,
        format
      };
    } catch {
      return {
        fileSize: 0,
        exists: false,
        format: ''
      };
    }
  }

  // Method to validate image before processing
  async validateImage(filePath: string, filename: string): Promise<{ valid: boolean; reason?: string }> {
    const extension = path.extname(filename).toLowerCase();
    
    if (!this.isValidImageFormat(extension)) {
      return { valid: false, reason: `Unsupported format: ${extension}` };
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return { valid: false, reason: `File too large: ${this.formatFileSize(stats.size)}` };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, reason: 'File not accessible' };
    }
  }
}

// Export singleton instance
export const imageProcessor = new ImageProcessor();