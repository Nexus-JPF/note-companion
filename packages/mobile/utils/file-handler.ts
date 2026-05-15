import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL, API_CONFIG } from '@/constants/config';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'pending';

export interface SharedFile {
  uri?: string;
  mimeType?: string;
  name?: string;
  text?: string;
  processType?: string; // Add processType field to distinguish between 'magic-diagram' or regular OCR
}

export interface UploadResult {
  status: UploadStatus;
  text?: string | { extractedText?: string; visualElements?: unknown };
  error?: string;
  fileId?: number | string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  fileName?: string;
}

export interface UploadResponse {
  success: boolean;
  fileId?: number | string;
  status: string;
  url?: string;
  text?: string;
  error?: string;
  fileUrl?: string;
  mimeType?: string;
  fileName?: string;
}

// Basic content moderation function to screen uploads
const moderateContent = async (text: string | undefined): Promise<{ 
  isAppropriate: boolean;
  reason?: string;
}> => {
  if (!text) return { isAppropriate: true };
  
  // Basic profanity/content check - would use a proper service in production
  const checkTerms = [
    'explicit', 'inappropriate', 'offensive', 'banned'
  ];
  
  // Check for any problematic terms
  for (const term of checkTerms) {
    if (text.toLowerCase().includes(term)) {
      return { 
        isAppropriate: false, 
        reason: `Content contains potentially inappropriate material (${term})` 
      };
    }
  }
  
  return { isAppropriate: true };
};

/**
 * Prepares a file for upload by normalizing paths and generating appropriate filename
 * and mimetype.
 */
export const prepareFile = async (
  file: SharedFile
): Promise<{
  fileName: string;
  mimeType: string;
  fileUri: string | null;
}> => {
  // Determine filename
  const fileName = file.name || `shared-${Date.now()}.${file.mimeType?.split('/')[1] || file.uri?.split('.').pop() || 'file'}`;
  
  // Determine mimetype
  let mimeType: string;
  
  // If file has explicit MIME type, use it
  if (file.mimeType) {
    mimeType = file.mimeType;
  } 
  // Otherwise, try to determine from extension
  else if (file.uri) {
    const fileExtension = file.uri.split('.').pop()?.toLowerCase();
    switch (fileExtension) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'heic':
        mimeType = 'image/heic';
        break;
      default:
        // Try to assign a generic type based on the extension
        if (fileExtension) {
          mimeType = `application/${fileExtension}`;
        } else {
          // Default to generic binary
          mimeType = 'application/octet-stream';
        }
    }
  } 
  // Default to octet-stream if we can't determine
  else {
    mimeType = 'application/octet-stream';
  }
  
  // Process paths based on platform
  // For text content, we just want a cache file path that will work
  let fileUri: string | null = null;
  
  if (file.text) {
    // For text content, create a temporary file in the cache directory
    fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    
    // Write the text to the file
    await FileSystem.writeAsStringAsync(fileUri, file.text);
  } 
  // For file content, normalize URI based on platform
  else if (file.uri) {
    fileUri = Platform.select({
      ios: file.uri.replace('file://', ''),
      android: file.uri,
      default: file.uri,
    });
  }
  
  return {
    fileName,
    mimeType,
    fileUri,
  };
};

/**
 * Uploads a file to the server using the new presigned URL flow for R2
 */
export const uploadFile = async (
  file: SharedFile,
  token: string
): Promise<UploadResponse> => {
  try {
    console.log("Starting presigned URL upload flow...");
    console.log('Input file properties:', {
      hasTextContent: !!file.text,
      mimeType: file.mimeType,
      name: file.name,
      uri: file.uri ? (file.uri.substring(0, 50) + '...') : undefined,
    });

    const { fileName, mimeType, fileUri } = await prepareFile(file);

    console.log('Prepared file properties:', {
      fileName,
      mimeType,
      fileUri: fileUri ? (fileUri.substring(0, 50) + '...') : undefined,
      platform: Platform.OS,
    });

    // --- Binary File Upload via Presigned URL ---
    console.log('Handling binary file upload via presigned URL');
    if (!fileUri) {
      throw new Error('No valid file URI available for upload');
    }

    // 1. Get presigned URL from our backend
    console.log('Fetching presigned URL...');
    const presignedUrlResponse = await fetch(`${API_URL}/api/create-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ filename: fileName, contentType: mimeType }),
    });

    if (!presignedUrlResponse.ok) {
      const errorData = await presignedUrlResponse.json().catch(() => ({ error: 'Failed to get presigned URL' }));
      throw new Error(errorData.error || 'Failed to get presigned URL');
    }

    const { uploadUrl, key, publicUrl } = await presignedUrlResponse.json();
    console.log('Received presigned URL details:', { key, publicUrl: publicUrl?.substring(0, 50) + '...' });

    if (!uploadUrl || !key || !publicUrl) {
        throw new Error('Invalid response from create-upload-url endpoint');
    }

    // 2. Upload file directly to R2 using the presigned URL
    console.log('Uploading file directly to R2...');
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        // Important: Set the content type header for the S3 PUT request
        'Content-Type': mimeType,
        // Remove Authorization header as it's not needed for the presigned URL
        // 'Authorization': `Bearer ${token}`, <--- REMOVE THIS
      },
    });

    console.log('R2 upload status:', uploadResult.status);
    // Check if upload to R2 was successful (typically 200 OK)
    if (uploadResult.status < 200 || uploadResult.status >= 300) {
        console.error('R2 Upload failed:', uploadResult.body);
        throw new Error(`Direct upload to R2 failed with status ${uploadResult.status}`);
    }
    console.log('File uploaded successfully to R2');

    // 3. Notify backend that upload is complete
    console.log('Notifying backend of completed upload...');
    const recordUploadResponse = await fetch(`${API_URL}/api/record-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        key, 
        publicUrl, 
        originalName: fileName, 
        fileType: mimeType,
        processType: file.processType || 'standard-ocr' // Pass the processType or default to standard-ocr
      }),
    });

    if (!recordUploadResponse.ok) {
      const errorData = await recordUploadResponse.json().catch(() => ({ error: 'Failed to record upload' }));
      throw new Error(errorData.error || 'Failed to record upload');
    }

    const recordResult = await recordUploadResponse.json();
    console.log('Backend notified, record result:', recordResult);

    return {
      success: true,
      fileId: recordResult.fileId, // The ID generated by our backend
      status: 'pending', // Status is pending until background worker processes it
      url: publicUrl, // The public URL of the file in R2
      mimeType: mimeType, // Pass along mimeType
      fileName: fileName, // Pass along fileName
    };
    // --- End Binary File Handling ---

  } catch (error) {
    console.error('Error in uploadFile (presigned URL flow):', error);
    // Return a structured error response
    return {
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
};

/**
 * Handles the entire file processing workflow: upload, trigger process, and poll for results
 */
export const handleFileProcess = async (
  file: SharedFile,
  token: string,
  onStatusChange?: (status: UploadStatus, details?: { fileId?: string | number, url?: string, mimeType?: string, fileName?: string }) => void,
): Promise<UploadResult> => {
  let uploadData: UploadResponse | null = null;

  try {
    onStatusChange?.('uploading');

    uploadData = await uploadFile(file, token);

    if (!uploadData.success || !uploadData.fileId) {
      // If upload itself failed, report error immediately
      throw new Error(uploadData.error || 'File upload failed without specific error');
    }

    // Notify with details after successful upload initiation
    // The status is now 'pending' as returned by uploadFile
    onStatusChange?.('pending', { // Use 'pending' status immediately
      fileId: uploadData.fileId,
      url: uploadData.url,
      mimeType: uploadData.mimeType,
      fileName: uploadData.fileName
    });

    // --- Trigger Generic Background Processing (fire‑and‑forget) ---
    console.log(`Upload successful for ${uploadData.fileId}, triggering background processing…`);
    fetch(`${API_URL}/api/trigger-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => {
        if (!res.ok) {
          return res.text().then(t =>
            console.warn(`Background trigger failed (${res.status}): ${t}`)
          );
        }
        console.log('Background processing job triggered ✅');
      })
      .catch(err =>
        console.error('Error triggering background processing:', err)
      );
    // --- End fire‑and‑forget ---

    // *** REMOVED POLLING LOGIC ***

    // Return immediately after successful upload and trigger attempt
    console.log(`handleFileProcess returning pending status for fileId: ${uploadData.fileId}`);
    return {
        status: 'pending', // Return 'pending' status
        text: undefined, // Use undefined instead of null
        error: undefined, // Use undefined instead of null
        fileId: uploadData.fileId,
        url: uploadData.url,
        mimeType: uploadData.mimeType,
        fileName: uploadData.fileName,
    };

  } catch (error) {
    console.error('handleFileProcess error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to process file';
    const fileIdOnError = uploadData?.fileId;
    // Construct error result
    const errorResult: UploadResult = {
      status: 'error',
      error: errorMsg,
      fileId: fileIdOnError,
      url: uploadData?.url,
      mimeType: uploadData?.mimeType,
      fileName: uploadData?.fileName,
    };
    onStatusChange?.('error', { // Notify error status
        fileId: errorResult.fileId,
        url: errorResult.url,
        mimeType: errorResult.mimeType,
        fileName: errorResult.fileName
    });
    return errorResult; // Return the error result
  }
};

/**
 * Helper function to escape special characters in regex patterns
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Directory for storing pending uploads
const PENDING_UPLOADS_DIR = `${FileSystem.documentDirectory}pending_uploads/`;
const SYNC_QUEUE_FILE = `${FileSystem.documentDirectory}sync_queue.json`;

/**
 * Ensure the pending uploads directory exists
 */
export const ensurePendingUploadsDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(PENDING_UPLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_UPLOADS_DIR, { intermediates: true });
  }
};

/**
 * Save a file to local storage for later syncing
 */
export const saveFileLocally = async (file: SharedFile): Promise<{ 
  localId: string;
  preview: {
    previewText?: string;
    thumbnailUri?: string;
    previewType: 'text' | 'image' | 'other';
  }
}> => {
  await ensurePendingUploadsDir();
  
  // Create a unique local ID
  const localId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  // Create a directory for this file
  const fileDir = `${PENDING_UPLOADS_DIR}${localId}/`;
  await FileSystem.makeDirectoryAsync(fileDir);
  
  // Generate a preview/thumbnail
  const preview = await generatePreview(file, localId);
  
  // Save the file metadata
  const metadata = {
    name: file.name,
    mimeType: file.mimeType,
    // Don't store the full text in metadata, just a preview
    textPreview: preview.previewText,
    thumbnailUri: preview.thumbnailUri,
    previewType: preview.previewType,
    localId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  await FileSystem.writeAsStringAsync(
    `${fileDir}metadata.json`, 
    JSON.stringify(metadata)
  );
  
  // If it's a text file, save the text content
  if (file.text) {
    await FileSystem.writeAsStringAsync(
      `${fileDir}content.txt`,
      file.text
    );
  } 
  // Otherwise, if it has a URI, copy the file
  else if (file.uri) {
    const { fileName } = await prepareFile(file);
    const destPath = `${fileDir}${fileName}`;
    await FileSystem.copyAsync({
      from: file.uri,
      to: destPath
    });
  }
  
  // Add to sync queue
  await addToSyncQueue(localId);
  
  return { 
    localId,
    preview
  };
};

/**
 * Add a file to the sync queue
 */
export const addToSyncQueue = async (localId: string): Promise<void> => {
  try {
    // Read current queue
    let queue: string[] = [];
    try {
      const queueInfoExists = await FileSystem.getInfoAsync(SYNC_QUEUE_FILE);
      if (queueInfoExists.exists) {
        const queueData = await FileSystem.readAsStringAsync(SYNC_QUEUE_FILE);
        queue = JSON.parse(queueData);
      }
    } catch (error) {
      console.log('Error reading sync queue, starting new queue', error);
      queue = [];
    }
    
    // Add to queue if not already present
    if (!queue.includes(localId)) {
      queue.push(localId);
      await FileSystem.writeAsStringAsync(
        SYNC_QUEUE_FILE,
        JSON.stringify(queue)
      );
    }
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
};

/**
 * Process the next item in the sync queue
 */
export const processSyncQueue = async (token: string): Promise<boolean> => {
  try {
    // Check if queue file exists
    const queueInfoExists = await FileSystem.getInfoAsync(SYNC_QUEUE_FILE);
    if (!queueInfoExists.exists) {
      return false; // No queue exists yet
    }

    // Read queue
    const queueData = await FileSystem.readAsStringAsync(SYNC_QUEUE_FILE);
    const queue: string[] = JSON.parse(queueData);

    if (queue.length === 0) {
      return false; // Queue is empty
    }

    // Get the next item
    const localId = queue[0];
    const fileDir = `${PENDING_UPLOADS_DIR}${localId}/`;

    // Check if the file directory exists
    const dirInfo = await FileSystem.getInfoAsync(fileDir);
    if (!dirInfo.exists) {
      // Remove from queue and skip
      queue.shift();
      await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
      return queue.length > 0; // Return true if there are more items
    }

    // Read metadata
    const metadataRaw = await FileSystem.readAsStringAsync(`${fileDir}metadata.json`);
    const metadata = JSON.parse(metadataRaw);

    // Don't re-process if already completed or errored too recently
    if (metadata.status === 'completed') {
        console.log(`Skipping already completed file ${localId}`);
        queue.shift();
        await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
        return queue.length > 0;
    }
    // Add logic here to check metadata.lastAttempt if status is 'error' to avoid rapid retries
    // const retryThreshold = 5 * 60 * 1000; // e.g., 5 minutes
    // if (metadata.status === 'error' && metadata.lastAttempt && (Date.now() - new Date(metadata.lastAttempt).getTime()) < retryThreshold) {
    //     console.log(`Skipping recently errored file ${localId}`);
    //     // Optionally move to end instead of skipping forever
    //     // queue.push(queue.shift());
    //     // await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
    //     return queue.length > 0;
    // }

    // Create a SharedFile object
    const sharedFile: SharedFile = {
      name: metadata.name,
      mimeType: metadata.mimeType,
    };

    // Find the content file
    const contentPathTxt = `${fileDir}content.txt`;
    const contentInfoTxt = await FileSystem.getInfoAsync(contentPathTxt);
    let contentFileUri: string | undefined;

    if (contentInfoTxt.exists) {
      // Text file saved locally
      sharedFile.text = await FileSystem.readAsStringAsync(contentPathTxt);
      // Even for text, we might need a file URI for the upload function if it expects one
      // For the new flow, text is handled separately, so this might not be needed
    } else {
      // Find the binary file in the directory
      const dirContents = await FileSystem.readDirectoryAsync(fileDir);
      const fileNames = dirContents.filter(name => !name.endsWith('.json') && !name.endsWith('.txt'));

      if (fileNames.length > 0) {
        contentFileUri = `${fileDir}${fileNames[0]}`;
        sharedFile.uri = contentFileUri;
      } else {
        console.error(`No content file found for ${localId}, removing from queue.`);
        metadata.status = 'error';
        metadata.error = 'Local content file missing';
        await FileSystem.writeAsStringAsync(`${fileDir}metadata.json`, JSON.stringify(metadata));
        queue.shift();
        await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
        return queue.length > 0;
      }
    }

    // Try to process the file using the updated handleFileProcess
    try {
      console.log(`Processing queued file ${localId} with handleFileProcess...`);
      // Use handleFileProcess which now incorporates the new flow
      const result = await handleFileProcess(sharedFile, token, (status, details) => {
          console.log(`Sync Queue Status Update for ${localId}: ${status}`, details);
          // Update metadata status in real-time if needed
          if (metadata.status !== status) {
             metadata.status = status;
             if (details?.fileId) metadata.serverFileId = details.fileId;
             // Avoid writing too frequently here, maybe only on final states
             // FileSystem.writeAsStringAsync(`${fileDir}metadata.json`, JSON.stringify(metadata));
          }
      });

      metadata.lastAttempt = new Date().toISOString();

      // Update metadata based on final result
      if (result.status === 'completed') {
        metadata.status = 'completed';
        metadata.serverFileId = result.fileId;
        // If text was processed, store it (or a reference)
        if (typeof result.text === 'string') {
            metadata.processedTextPreview = generateTextPreview(result.text, 50); // Store preview
        } else if (result.text?.extractedText) {
             metadata.processedTextPreview = generateTextPreview(result.text.extractedText, 50);
        }
        metadata.processedAt = new Date().toISOString();
        metadata.error = undefined; // Clear previous errors

        await FileSystem.writeAsStringAsync(`${fileDir}metadata.json`, JSON.stringify(metadata));
        queue.shift(); // Remove from queue on success
        await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
        console.log(`Successfully processed queued file ${localId}`);

      } else if (result.status === 'error') {
        metadata.status = 'error';
        metadata.error = result.error || 'Unknown processing error';

        await FileSystem.writeAsStringAsync(`${fileDir}metadata.json`, JSON.stringify(metadata));
        // Move to the end of the queue on error
        queue.push(queue.shift()!); // Move failed item to the end
        await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
      }
      // else: still processing, leave it in the queue

    } catch (processError) {
      console.error(`Critical error processing queued file ${localId}:`, processError);
      metadata.status = 'error';
      metadata.error = processError instanceof Error ? processError.message : 'Critical processing error';
      metadata.lastAttempt = new Date().toISOString();

      await FileSystem.writeAsStringAsync(`${fileDir}metadata.json`, JSON.stringify(metadata));
       // Move to the end of the queue on critical error
      queue.push(queue.shift()!); // Move failed item to the end
      await FileSystem.writeAsStringAsync(SYNC_QUEUE_FILE, JSON.stringify(queue));
    }

    return queue.length > 0; // Return true if there are more items

  } catch (error) {
    console.error('Error processing sync queue item:', error);
    // If we had an error reading the queue itself, maybe return false to stop processing
    return false;
  }
};

/**
 * Start processing the sync queue in the background
 */
export const startBackgroundSync = async (token: string): Promise<void> => {
  let isProcessing = false;
  
  // Process one item at a time with a delay between items
  const processNextItem = async () => {
    if (isProcessing) return;
    
    isProcessing = true;
    try {
      const hasMoreItems = await processSyncQueue(token);
      if (hasMoreItems) {
        // Schedule next item with a delay
        setTimeout(processNextItem, 5000);
      }
    } catch (error) {
      console.error('Error in background sync:', error);
    } finally {
      isProcessing = false;
    }
  };
  
  // Start processing
  processNextItem();
};

/**
 * Handles a shared file locally first, then queues for background processing
 */
export const handleSharedFile = async (
  file: SharedFile,
  onLocalSaveComplete?: (preview: {
    previewText?: string;
    thumbnailUri?: string;
    previewType: 'text' | 'image' | 'other';
  }) => void
): Promise<string> => {
  try {
    // Save locally first
    const { localId, preview } = await saveFileLocally(file);
    
    // Notify that local save is complete, with preview data
    onLocalSaveComplete?.(preview);
    
    return localId;
  } catch (error) {
    console.error('Error handling shared file:', error);
    throw error;
  }
};

/**
 * Generate a text preview/snippet from full text
 */
export const generateTextPreview = (text: string, maxLength: number = 150): string => {
  if (!text || text.length <= maxLength) return text;
  
  // Try to find a good break point (end of sentence or paragraph)
  const breakPoints = [
    text.indexOf('\n\n', maxLength / 2),
    text.indexOf('. ', maxLength / 2),
    text.indexOf('? ', maxLength / 2),
    text.indexOf('! ', maxLength / 2),
  ].filter(point => point !== -1 && point < maxLength);
  
  // Use the furthest break point that's within our limit
  const breakPoint = breakPoints.length ? Math.max(...breakPoints) + 1 : maxLength;
  
  return text.substring(0, breakPoint) + '...';
};

/**
 * Generate a thumbnail path for an image or create a text preview
 */
export const generatePreview = async (file: SharedFile, localId: string): Promise<{
  previewText?: string;
  thumbnailUri?: string;
  previewType: 'text' | 'image' | 'other';
}> => {
  // Create previews directory if needed
  const previewsDir = `${FileSystem.documentDirectory}previews/`;
  const dirInfo = await FileSystem.getInfoAsync(previewsDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(previewsDir, { intermediates: true });
  }
  
  // For text content, create a text preview
  if (file.text) {
    return {
      previewText: generateTextPreview(file.text),
      previewType: 'text'
    };
  }
  
  // For images, create a thumbnail
  if (file.uri && file.mimeType?.startsWith('image/')) {
    try {
      // Copy the image to the previews directory as the thumbnail
      // In a production app, you'd want to resize this to a smaller size
      const thumbnailUri = `${previewsDir}${localId}-thumb.jpg`;
      await FileSystem.copyAsync({
        from: file.uri,
        to: thumbnailUri
      });
      
      return {
        thumbnailUri,
        previewType: 'image'
      };
    } catch (error) {
      console.error('Error creating thumbnail:', error);
    }
  }
  
  // For other file types
  return {
    previewText: file.name || 'File',
    previewType: 'other'
  };
};

/**
 * Get a list of all pending and completed local files
 */
export const getLocalFiles = async (): Promise<{
  id: string;
  name: string;
  mimeType: string;
  status: string;
  createdAt: string;
  previewText?: string;
  thumbnailUri?: string;
  previewType: 'text' | 'image' | 'other';
  error?: string;
}[]> => {
  try {
    // Ensure directory exists
    await ensurePendingUploadsDir();
    
    // Read all subdirectories
    const dirs = await FileSystem.readDirectoryAsync(PENDING_UPLOADS_DIR);
    
    const localFiles = [];
    
    // Read metadata for each file
    for (const dir of dirs) {
      try {
        const metadataPath = `${PENDING_UPLOADS_DIR}${dir}/metadata.json`;
        const metadataInfo = await FileSystem.getInfoAsync(metadataPath);
        
        if (metadataInfo.exists) {
          const metadataRaw = await FileSystem.readAsStringAsync(metadataPath);
          const metadata = JSON.parse(metadataRaw);
          
          localFiles.push({
            id: metadata.localId || dir,
            name: metadata.name || 'Unnamed file',
            mimeType: metadata.mimeType || 'application/octet-stream',
            status: metadata.status || 'pending',
            createdAt: metadata.createdAt || new Date().toISOString(),
            previewText: metadata.textPreview,
            thumbnailUri: metadata.thumbnailUri,
            previewType: metadata.previewType || 'other',
            error: metadata.error
          });
        }
      } catch (error) {
        console.error(`Error reading metadata for ${dir}:`, error);
      }
    }
    
    // Sort by creation date, newest first
    return localFiles.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error getting local files:', error);
    return [];
  }
};