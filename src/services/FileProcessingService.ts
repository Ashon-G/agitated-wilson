import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { FileUpload } from '../types/knowledge';
import { getOpenAITextResponse } from '../api/chat-service';
import { AIMessage } from '../types/ai';

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

class FileProcessingService {
  // Maximum file size: 50MB
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Supported file types
  private static readonly SUPPORTED_TYPES = {
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/rtf'],
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
    archives: ['application/zip', 'application/x-rar-compressed'],
  };

  /**
   * Open document picker and return selected files
   */
  static async pickFiles(allowMultiple: boolean = true): Promise<FileUpload[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: allowMultiple,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return [];
      }

      const files: FileUpload[] = [];
      const assets = Array.isArray(result.assets) ? result.assets : [result.assets];

      for (const asset of assets) {
        if (!asset) continue;

        const fileUpload: FileUpload = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          name: asset.name,
          size: asset.size || 0,
          type: this.getFileCategory(asset.mimeType || ''),
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/octet-stream',
          uploadProgress: 0,
          status: 'pending',
        };

        // Validate file
        const validation = this.validateFile(fileUpload);
        if (!validation.isValid) {
          fileUpload.status = 'error';
          fileUpload.error = validation.error;
        }

        files.push(fileUpload);
      }

      return files;
    } catch (error) {
      console.error('File picker error:', error);
      throw new Error('Failed to pick files. Please try again.');
    }
  }

  /**
   * Validate a file upload
   */
  static validateFile(file: FileUpload): FileValidationResult {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File "${file.name}" is too large. Maximum size is 50MB.`,
      };
    }

    // Check if file type is supported
    const allSupportedTypes = Object.values(this.SUPPORTED_TYPES).flat();
    if (!allSupportedTypes.includes(file.mimeType)) {
      return {
        isValid: false,
        error: `File type "${file.mimeType}" is not supported.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get file category based on mime type
   */
  static getFileCategory(mimeType: string): string {
    for (const [category, types] of Object.entries(this.SUPPORTED_TYPES)) {
      if (types.includes(mimeType)) {
        return category.slice(0, -1); // Remove 's' from plural
      }
    }
    return 'file';
  }

  /**
   * Get file icon based on type
   */
  static getFileIcon(mimeType: string): string {
    if (this.SUPPORTED_TYPES.documents.includes(mimeType)) {
      if (mimeType === 'application/pdf') return 'document-text';
      return 'document';
    }
    if (this.SUPPORTED_TYPES.images.includes(mimeType)) return 'image';
    if (this.SUPPORTED_TYPES.audio.includes(mimeType)) return 'musical-notes';
    if (this.SUPPORTED_TYPES.video.includes(mimeType)) return 'videocam';
    if (this.SUPPORTED_TYPES.archives.includes(mimeType)) return 'archive';
    return 'document';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  sizes[i]}`;
  }

  /**
   * Extract text content from file (basic implementation)
   */
  static async extractTextContent(file: FileUpload): Promise<string> {
    try {
      if (file.mimeType === 'text/plain') {
        const content = await FileSystem.readAsStringAsync(file.uri);
        return content;
      }

      // For other file types, we'd need more sophisticated extraction
      // For now, return empty string
      return '';
    } catch (error) {
      console.error('Text extraction error:', error);
      return '';
    }
  }

  /**
   * Generate thumbnail for image files (basic implementation)
   */
  static async generateThumbnail(file: FileUpload): Promise<string | null> {
    try {
      if (this.SUPPORTED_TYPES.images.includes(file.mimeType)) {
        // For now, just return the original URI
        // In a real implementation, you'd resize the image
        return file.uri;
      }
      return null;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  }

  /**
   * Process uploaded file with AI analysis
   */
  static async processFile(file: FileUpload, userId?: string): Promise<Partial<FileUpload>> {
    try {
      const updates: Partial<FileUpload> = {
        status: 'uploading',
      };

      // Extract text content if applicable
      const textContent = await this.extractTextContent(file);
      if (textContent) {
        (updates as any).extractedText = textContent;
      }

      // Generate thumbnail if applicable
      const thumbnail = await this.generateThumbnail(file);
      if (thumbnail) {
        (updates as any).thumbnail = thumbnail;
      }

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        updates.uploadProgress = progress;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // AI processing for content analysis
      if (textContent && userId) {
        try {
          const aiAnalysis = await this.analyzeFileContent(textContent, file.name);
          (updates as any).aiSummary = aiAnalysis.summary;
          (updates as any).aiKeyPoints = aiAnalysis.keyPoints;
          (updates as any).aiTags = aiAnalysis.suggestedTags;
          (updates as any).aiCategory = aiAnalysis.category;
        } catch (aiError) {
          console.warn('AI analysis failed:', aiError);
        }
      }

      updates.status = 'completed';
      return updates;
    } catch (error) {
      console.error('File processing error:', error);
      return {
        status: 'error',
        error: 'Failed to process file',
      };
    }
  }

  /**
   * Analyze file content using AI
   */
  static async analyzeFileContent(textContent: string, fileName: string): Promise<{
    summary: string;
    keyPoints: string[];
    suggestedTags: string[];
    category: string;
  }> {
    try {
      const analysisPrompt = `Analyze the following file content and provide insights:

File Name: ${fileName}
Content: ${textContent.slice(0, 2000)}${textContent.length > 2000 ? '...' : ''}

Please provide:
1. A concise summary (2-3 sentences)
2. Key points or main topics (up to 5 bullet points)
3. Suggested tags for categorization (up to 8 relevant tags)
4. Content category (document type: report, presentation, guide, specification, etc.)

Format your response as JSON:
{
  "summary": "Brief summary here",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "category": "document-category"
}`;

      const messages: AIMessage[] = [
        { role: 'system', content: 'You are an AI assistant that analyzes documents and extracts key information. Always respond with valid JSON.' },
        { role: 'user', content: analysisPrompt },
      ];

      const response = await getOpenAITextResponse(messages, {
        temperature: 0.3,
        maxTokens: 500,
      });

      try {
        const analysis = JSON.parse(response.content);
        return {
          summary: analysis.summary || 'Document analysis not available',
          keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints.slice(0, 5) : [],
          suggestedTags: Array.isArray(analysis.suggestedTags) ? analysis.suggestedTags.slice(0, 8) : [],
          category: analysis.category || 'document',
        };
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        return {
          summary: 'Document uploaded successfully',
          keyPoints: [],
          suggestedTags: this.getSuggestedTags({ name: fileName } as FileUpload),
          category: 'document',
        };
      }
    } catch (error) {
      console.error('AI content analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get suggested tags based on file type and name
   */
  static getSuggestedTags(file: FileUpload): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(file.type);

    // Add file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension) {
      tags.push(extension);
    }

    // Add content-based tags based on filename
    const filename = file.name.toLowerCase();
    if (filename.includes('report')) tags.push('report');
    if (filename.includes('presentation')) tags.push('presentation');
    if (filename.includes('design')) tags.push('design');
    if (filename.includes('spec')) tags.push('specification');
    if (filename.includes('meeting')) tags.push('meeting');
    if (filename.includes('contract')) tags.push('contract');
    if (filename.includes('invoice')) tags.push('invoice');

    return [...new Set(tags)]; // Remove duplicates
  }
}

export default FileProcessingService;