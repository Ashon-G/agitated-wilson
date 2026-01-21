import BoxOAuthService from '../integrations/BoxOAuthService';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';
import { KnowledgeItem } from '../types/app';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BoxFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified_at: string;
  content_modified_at: string;
}

interface BoxFileList {
  entries: BoxFile[];
  total_count: number;
  offset: number;
  limit: number;
}

interface SyncSummary {
  totalFiles: number;
  imported: number;
  failed: number;
  skipped: number;
}

interface BoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class BoxService {
  private static readonly BASE_URL = 'https://api.box.com/2.0';
  private static readonly STORAGE_KEY = 'box_tokens';

  // Supported file types for text extraction
  private static readonly SUPPORTED_EXTENSIONS = [
    '.txt',
    '.md',
    '.pdf',
    '.doc',
    '.docx',
  ];

  /**
   * Store Box tokens securely
   */
  private async storeTokens(tokens: BoxTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(BoxService.STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store Box tokens:', error);
    }
  }

  /**
   * Retrieve stored Box tokens
   */
  private async getStoredTokens(): Promise<BoxTokens | null> {
    try {
      const tokensJson = await AsyncStorage.getItem(BoxService.STORAGE_KEY);
      if (tokensJson) {
        return JSON.parse(tokensJson);
      }
    } catch (error) {
      console.error('Failed to retrieve Box tokens:', error);
    }
    return null;
  }

  /**
   * Check if Box is connected (has valid tokens)
   */
  async isConnected(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    return tokens !== null;
  }

  /**
   * Clear stored Box tokens
   */
  private async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BoxService.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear Box tokens:', error);
    }
  }

  /**
   * Ensure we have a valid access token, refreshing if needed
   */
  private async ensureValidToken(): Promise<string> {
    const tokens = await this.getStoredTokens();

    if (!tokens) {
      throw new Error('No active Box connection. Please connect your Box account.');
    }

    // Check if token expires in next 5 minutes
    const expiresIn = tokens.expiresAt - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresIn < fiveMinutes) {
      console.log('🔵 Box token expiring soon, refreshing...');
      console.log(`   Expires in: ${Math.floor(expiresIn / 1000)} seconds`);

      try {
        const refreshed = await BoxOAuthService.refreshBoxToken(tokens.refreshToken);

        if (!refreshed) {
          console.error('🔴 Token refresh failed - clearing invalid tokens');
          await this.clearTokens();
          throw new Error('Failed to refresh Box token. Please reconnect your account.');
        }

        await this.storeTokens(refreshed);
        console.log('🟢 Token refreshed successfully');
        return refreshed.accessToken;
      } catch (error) {
        console.error('🔴 Error during token refresh:', error);
        // Clear invalid tokens so user can reconnect
        await this.clearTokens();
        throw new Error('Failed to refresh Box token. Please reconnect your account.');
      }
    }

    return tokens.accessToken;
  }

  /**
   * Store tokens after successful authentication
   */
  async saveTokens(tokens: BoxTokens): Promise<void> {
    await this.storeTokens(tokens);
  }

  /**
   * Disconnect Box account
   */
  async disconnect(): Promise<void> {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      await BoxOAuthService.revokeBoxToken(tokens.accessToken);
    }
    await this.clearTokens();
  }

  /**
   * List files in a Box folder
   */
  async listFiles(folderId: string = '0', options?: {
    limit?: number;
    offset?: number;
  }): Promise<BoxFileList> {
    try {
      const accessToken = await this.ensureValidToken();
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        fields: 'id,name,type,size,modified_at,content_modified_at',
      });

      const response = await fetch(`${BoxService.BASE_URL}/folders/${folderId}/items?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Failed to list Box files:', response.status, errorText);

        // Handle specific error cases
        if (response.status === 401) {
          // Token is invalid even after refresh
          console.error('🔴 Token invalid - clearing stored tokens');
          await this.clearTokens();
          throw new Error('Box authentication expired. Please reconnect your account.');
        }

        throw new Error(`Failed to list files: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error listing Box files:', error);

      // Provide user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('reconnect')) {
          throw error; // Already has good message
        }
        throw new Error(`Box error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Get file content as text
   */
  async getFileContent(fileId: string): Promise<string> {
    try {
      const accessToken = await this.ensureValidToken();

      const response = await fetch(`${BoxService.BASE_URL}/files/${fileId}/content`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      // Get content as text
      const content = await response.text();
      return content;
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFile(fileName: string): boolean {
    return BoxService.SUPPORTED_EXTENSIONS.some(ext =>
      fileName.toLowerCase().endsWith(ext),
    );
  }

  /**
   * Recursively list all files in folder and subfolders
   */
  private async listAllFiles(folderId: string = '0'): Promise<BoxFile[]> {
    const allFiles: BoxFile[] = [];
    let offset = 0;
    const limit = 100;

    try {
      // Get all items in current folder
      while (true) {
        const result = await this.listFiles(folderId, { limit, offset });

        for (const item of result.entries) {
          if (item.type === 'file' && this.isSupportedFile(item.name)) {
            allFiles.push(item);
          } else if (item.type === 'folder') {
            // Recursively get files from subfolder
            try {
              const subFiles = await this.listAllFiles(item.id);
              allFiles.push(...subFiles);
            } catch (error) {
              console.warn(`Skipping folder ${item.name}:`, error);
            }
          }
        }

        // Check if there are more items
        if (offset + limit >= result.total_count) {
          break;
        }
        offset += limit;
      }
    } catch (error) {
      console.error('Error listing all files:', error);
    }

    return allFiles;
  }

  /**
   * Sync all Box documents to knowledge base
   */
  async syncAllDocuments(workspaceId: string): Promise<SyncSummary> {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const summary: SyncSummary = {
      totalFiles: 0,
      imported: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      console.log('Starting Box sync...');

      // Get all supported files from Box
      const files = await this.listAllFiles('0');
      summary.totalFiles = files.length;

      console.log(`Found ${files.length} supported files in Box`);

      // Get existing knowledge items to check for duplicates from users/{userId}/knowledge
      const knowledgePath = `users/${user.uid}/knowledge`;
      const existingItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {
        where: [
          { field: 'workspaceId', operator: '==', value: workspaceId },
        ],
      });

      const existingBoxIds = new Set(
        existingItems
          .filter(item => item.source === 'box')
          .map(item => item.sourceId),
      );

      // Process each file
      for (const file of files) {
        try {
          // Skip if already imported
          if (existingBoxIds.has(file.id)) {
            console.log(`Skipping already imported: ${file.name}`);
            summary.skipped++;
            continue;
          }

          // Create knowledge item with Box reference (no download needed)
          // The AI will fetch content directly from Box when needed
          console.log(`Linking: ${file.name}`);

          const knowledgeItem = {
            type: 'file' as const,
            title: file.name,
            content: undefined, // No content stored - AI fetches from Box on-demand
            source: 'box',
            sourceId: file.id,
            workspaceId,
            userId: user.uid,
            tags: ['box', 'document'],
            description: `Box document: ${file.name}`,
            metadata: {
              boxFileId: file.id,
              modifiedAt: file.modified_at,
              size: file.size,
              // Store reference for AI to fetch content when needed
              boxAccessMethod: 'on-demand',
            },
            createdAt: new Date(),
          };

          // Save to Firestore in users/{userId}/knowledge
          await BackendService.createDocument(knowledgePath, knowledgeItem);

          console.log(`Linked: ${file.name}`);
          summary.imported++;
        } catch (error) {
          console.error(`Failed to import ${file.name}:`, error);
          summary.failed++;
        }
      }

      console.log('Box sync complete:', summary);
      return summary;
    } catch (error) {
      console.error('Failed to sync Box documents:', error);
      throw error;
    }
  }

  /**
   * Sync only selected Box files/folders to knowledge base
   */
  async syncSelectedItems(
    workspaceId: string,
    selectedItems: Array<{ id: string; name: string; type: 'file' | 'folder' }>,
  ): Promise<SyncSummary> {
    const user = AuthenticationService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const summary: SyncSummary = {
      totalFiles: 0,
      imported: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      console.log(`Starting selective Box sync for ${selectedItems.length} items...`);

      // Expand folders into files
      const allFiles: BoxFile[] = [];
      for (const item of selectedItems) {
        if (item.type === 'folder') {
          console.log(`Expanding folder: ${item.name}`);
          const folderFiles = await this.listAllFiles(item.id);
          allFiles.push(...folderFiles);
        } else if (item.type === 'file') {
          // Fetch full file details
          try {
            const accessToken = await this.ensureValidToken();
            const response = await fetch(`${BoxService.BASE_URL}/files/${item.id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (response.ok) {
              const fileData = await response.json();
              if (this.isSupportedFile(fileData.name)) {
                allFiles.push(fileData);
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch file details for ${item.name}:`, error);
          }
        }
      }

      summary.totalFiles = allFiles.length;
      console.log(`Found ${allFiles.length} supported files from selection`);

      // Get existing knowledge items to check for duplicates from users/{userId}/knowledge
      const knowledgePath = `users/${user.uid}/knowledge`;
      const existingItems = await BackendService.queryCollection<KnowledgeItem>(knowledgePath, {
        where: [
          { field: 'workspaceId', operator: '==', value: workspaceId },
        ],
      });

      const existingBoxIds = new Set(
        existingItems
          .filter(item => item.source === 'box')
          .map(item => item.sourceId),
      );

      // Process each file
      for (const file of allFiles) {
        try {
          // Skip if already imported
          if (existingBoxIds.has(file.id)) {
            console.log(`Skipping already imported: ${file.name}`);
            summary.skipped++;
            continue;
          }

          // Create knowledge item with Box reference (no download needed)
          // The AI will fetch content directly from Box when needed
          console.log(`Linking: ${file.name}`);

          const knowledgeItem = {
            type: 'file' as const,
            title: file.name,
            content: undefined, // No content stored - AI fetches from Box on-demand
            source: 'box',
            sourceId: file.id,
            workspaceId,
            userId: user.uid,
            tags: ['box', 'document'],
            description: `Box document: ${file.name}`,
            metadata: {
              boxFileId: file.id,
              modifiedAt: file.modified_at,
              size: file.size,
              // Store reference for AI to fetch content when needed
              boxAccessMethod: 'on-demand',
            },
            createdAt: new Date(),
          };

          // Save to Firestore in users/{userId}/knowledge
          await BackendService.createDocument(knowledgePath, knowledgeItem);
          console.log(`Linked: ${file.name}`);
          summary.imported++;
        } catch (error) {
          console.error(`Failed to import ${file.name}:`, error);
          summary.failed++;
        }
      }

      console.log('Selective Box sync complete:', summary);
      return summary;
    } catch (error) {
      console.error('Failed to sync selected Box items:', error);
      throw error;
    }
  }
}

export default new BoxService();
