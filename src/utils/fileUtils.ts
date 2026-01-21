import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { KnowledgeItem } from '../types/app';

export interface FilePickerResult {
  success: boolean;
  file?: {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
  };
  error?: string;
}

export const pickDocument = async (): Promise<FilePickerResult> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        success: true,
        file: {
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        },
      };
    }

    return { success: false, error: 'No document selected' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick document',
    };
  }
};

export const pickImage = async (): Promise<FilePickerResult> => {
  try {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      return { success: false, error: 'Permission to access media library denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);

      return {
        success: true,
        file: {
          uri: asset.uri,
          name: `image_${Date.now()}.jpg`,
          size: fileInfo.exists ? fileInfo.size || 0 : 0,
          mimeType: 'image/jpeg',
        },
      };
    }

    return { success: false, error: 'No image selected' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick image',
    };
  }
};

export const takePhoto = async (): Promise<FilePickerResult> => {
  try {
    // Request permission
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      return { success: false, error: 'Permission to access camera denied' };
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);

      return {
        success: true,
        file: {
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          size: fileInfo.exists ? fileInfo.size || 0 : 0,
          mimeType: 'image/jpeg',
        },
      };
    }

    return { success: false, error: 'No photo taken' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to take photo',
    };
  }
};

export const saveFileToKnowledge = async (
  file: FilePickerResult['file'],
  workspaceId: string,
  title?: string,
  description?: string,
  tags: string[] = [],
): Promise<Partial<KnowledgeItem> | null> => {
  if (!file) return null;

  try {
    // Create a permanent copy in the app's document directory
    const documentsDir = FileSystem.documentDirectory;
    const fileName = `${Date.now()}_${file.name}`;
    const permanentUri = `${documentsDir}${fileName}`;

    await FileSystem.copyAsync({
      from: file.uri,
      to: permanentUri,
    });

    const isImage = file.mimeType.startsWith('image/');

    return {
      type: isImage ? 'media' : 'file',
      title: title || file.name,
      description,
      filePath: permanentUri,
      fileSize: file.size,
      mimeType: file.mimeType,
      workspaceId,
      tags,
    };
  } catch (error) {
    console.error('Failed to save file:', error);
    return null;
  }
};

export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};