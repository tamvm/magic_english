import mammoth from 'mammoth';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

class FileProcessingService {
  async processFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit');
    }

    const fileExtension = this.getFileExtension(file.originalname);

    switch (fileExtension.toLowerCase()) {
      case 'txt':
        return await this.processTxtFile(file);
      case 'pdf':
        return await this.processPdfFile(file);
      case 'docx':
        return await this.processDocxFile(file);
      case 'srt':
        return await this.processSrtFile(file);
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  }

  getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  async processTxtFile(file) {
    try {
      const content = file.buffer.toString('utf-8');

      if (!content || content.trim().length < 50) {
        throw new Error('Text file content is too short to analyze (minimum 50 characters)');
      }

      return {
        content: content.trim(),
        title: this.generateTitleFromFilename(file.originalname),
        excerpt: this.generateExcerpt(content),
        wordCount: this.countWords(content),
        fileType: 'txt'
      };
    } catch (error) {
      throw new Error(`Failed to process text file: ${error.message}`);
    }
  }

  async processPdfFile(file) {
    try {
      console.log('🔍 Starting PDF parsing with pdf-parse...');

      // Use pdf-parse which is more reliable for Node.js
      const pdfData = await pdfParse(file.buffer);

      console.log('📄 PDF parsing completed, extracted text length:', pdfData.text.length);

      // Clean up the extracted text
      const cleanedText = this.cleanExtractedText(pdfData.text);

      if (!cleanedText || cleanedText.trim().length < 100) {
        throw new Error('PDF content is too short or could not be extracted properly (minimum 100 characters)');
      }

      console.log('✅ PDF processing successful');

      return {
        content: cleanedText,
        title: this.generateTitleFromFilename(file.originalname),
        excerpt: this.generateExcerpt(cleanedText),
        wordCount: this.countWords(cleanedText),
        pageCount: pdfData.numpages,
        fileType: 'pdf'
      };
    } catch (error) {
      console.error('❌ PDF parsing error:', error);
      throw new Error(`Failed to process PDF file: ${error.message}`);
    }
  }

  async processDocxFile(file) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      const content = result.value;

      if (result.messages.length > 0) {
        console.warn('DOCX processing warnings:', result.messages);
      }

      if (!content || content.trim().length < 100) {
        throw new Error('DOCX content is too short or could not be extracted properly (minimum 100 characters)');
      }

      const cleanedText = this.cleanExtractedText(content);

      return {
        content: cleanedText,
        title: this.generateTitleFromFilename(file.originalname),
        excerpt: this.generateExcerpt(cleanedText),
        wordCount: this.countWords(cleanedText),
        fileType: 'docx'
      };
    } catch (error) {
      throw new Error(`Failed to process DOCX file: ${error.message}`);
    }
  }

  cleanExtractedText(text) {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Remove multiple consecutive newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim
      .trim();
  }

  generateTitleFromFilename(filename) {
    if (!filename) return 'Untitled Document';

    // Remove extension and clean up
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Replace underscores and hyphens with spaces, capitalize words
    return nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim();
  }

  generateExcerpt(content, maxLength = 200) {
    if (!content) return '';

    const words = content.trim().split(/\s+/);
    if (words.length <= 30) return content;

    const excerpt = words.slice(0, 30).join(' ');
    return excerpt.length > maxLength
      ? excerpt.substring(0, maxLength - 3) + '...'
      : excerpt + '...';
  }

  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async processSrtFile(file) {
    try {
      const content = file.buffer.toString('utf-8');

      if (!content || content.trim().length < 50) {
        throw new Error('SRT file content is too short to analyze (minimum 50 characters)');
      }

      // Parse SRT content to extract subtitle text
      const subtitleText = this.parseSrtContent(content);

      if (!subtitleText || subtitleText.trim().length < 100) {
        throw new Error('SRT file contains insufficient text content (minimum 100 characters)');
      }

      return {
        content: subtitleText,
        title: this.generateTitleFromFilename(file.originalname),
        excerpt: this.generateExcerpt(subtitleText),
        wordCount: this.countWords(subtitleText),
        fileType: 'srt'
      };
    } catch (error) {
      throw new Error(`Failed to process SRT file: ${error.message}`);
    }
  }

  parseSrtContent(srtContent) {
    if (!srtContent) return '';

    // Split by double newlines to get subtitle blocks
    const blocks = srtContent.split(/\n\s*\n/);
    const subtitleTexts = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');

      // Skip if block doesn't have at least 3 lines (index, timestamp, text)
      if (lines.length < 3) continue;

      // Skip first line (index) and second line (timestamp)
      // Collect all remaining lines as subtitle text
      const textLines = lines.slice(2);
      const subtitleText = textLines.join(' ').trim();

      if (subtitleText) {
        // Remove HTML tags that might be in subtitles
        const cleanText = subtitleText.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
          subtitleTexts.push(cleanText);
        }
      }
    }

    // Join all subtitle texts with spaces
    return subtitleTexts.join(' ').trim();
  }

  // Validate file type based on mimetype and extension
  isValidFileType(file) {
    const allowedExtensions = ['txt', 'pdf', 'docx', 'srt'];
    const allowedMimeTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/srt', // SRT files sometimes use this MIME type
      'application/x-subrip' // Alternative MIME type for SRT files
    ];

    const extension = this.getFileExtension(file.originalname);
    const isValidExtension = allowedExtensions.includes(extension.toLowerCase());

    // For SRT files, we're more lenient with MIME type validation since SRT files
    // are often served with different MIME types (text/plain, text/srt, etc.)
    if (extension.toLowerCase() === 'srt') {
      return true;
    }

    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

    return isValidExtension && isValidMimeType;
  }
}

export const fileProcessingService = new FileProcessingService();