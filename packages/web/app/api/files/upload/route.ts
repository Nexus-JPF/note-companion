import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { mkdir } from "fs/promises";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";

// Function to ensure directory exists
async function ensureDir(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/** Keep only a plain file name: no directories, no path tricks. */
function safeFileName(name: unknown): string {
  const base = path.basename(String(name ?? '')).replace(/[^\w.\- ]/g, '_').slice(0, 200);
  return base && base !== '.' && base !== '..' ? base : 'file';
}

export async function POST(request: NextRequest) {
  try {
    // Only signed-in users (API key or Clerk session) may upload
    await handleAuthorizationV2(request);

    // Get upload directory from environment or use default
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    
    // Ensure the upload directory exists
    await ensureDir(uploadDir);
    
    // Parse the form data (multipart/form-data)
    const formData = await request.formData();
    const files = formData.getAll('files');
    
    // Process each file
    const uploadedFiles = await Promise.all(
      files.map(async (file: any) => {
        const fileName = safeFileName(file.name);
        const fileType = fileName.split('.').pop() || 'unknown';
        const uniqueFileName = `${uuidv4()}-${fileName}`;
        const filePath = path.join(uploadDir, uniqueFileName);
        
        // Convert file to buffer and save it
        const buffer = Buffer.from(await file.arrayBuffer());
        // @ts-ignore
        fs.writeFileSync(filePath, buffer);
        
        // Get file size and other metadata
        const stats = fs.statSync(filePath);
        
        return {
          id: uniqueFileName.split('-')[0],
          name: fileName,
          path: filePath.replace(process.cwd(), ''),
          type: fileType === 'md' ? 'markdown' : 
                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType) ? 'image' : 'file',
          size: stats.size,
          date: new Date().toISOString()
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status?: unknown }).status;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status }
        );
      }
    }
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
