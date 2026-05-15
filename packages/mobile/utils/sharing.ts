import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Check if sharing is available on the current platform
 */
export const isShareAvailable = async (): Promise<boolean> => {
  return await Sharing.isAvailableAsync();
};

/**
 * Share a file using the native share dialog
 * @param fileUri - The URI of the file to share
 * @param mimeType - Optional MIME type of the file
 * @param dialogTitle - Optional title for the share dialog (Android only)
 */
export const shareFile = async (
  fileUri: string,
  mimeType?: string,
  dialogTitle?: string
): Promise<void> => {
  try {
    const isAvailable = await isShareAvailable();
    
    if (!isAvailable) {
      throw new Error('Sharing is not available on this platform');
    }

    // Ensure the file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Share the file
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle,
      UTI: mimeType // Used for iOS
    });
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};

/**
 * Share text content by first saving it to a temporary file
 * @param content - The text content to share
 * @param filename - The name of the temporary file
 * @param mimeType - Optional MIME type of the content
 */
export const shareText = async (
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): Promise<void> => {
  try {
    const tempFileUri = `${FileSystem.cacheDirectory}${filename}`;
    
    // Write content to temporary file
    await FileSystem.writeAsStringAsync(tempFileUri, content);
    
    // Share the temporary file
    await shareFile(tempFileUri, mimeType);
    
    // Clean up the temporary file
    await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
  } catch (error) {
    console.error('Error sharing text:', error);
    throw error;
  }
}; 