import { NextRequest, NextResponse } from 'next/server';
import { db, uploadedFiles } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { signR2Url } from '@/lib/r2-client';

export async function GET(req: NextRequest) {
  try {
    // Get the current user ID from authentication
    const { userId } = await handleAuthorizationV2(req);
    
    // Query the database for the most recent files belonging to the current user
    const recentFiles = await db
      .select({
        id: uploadedFiles.id,
        name: uploadedFiles.originalName,
        type: uploadedFiles.fileType,
        date: uploadedFiles.updatedAt,
        path: uploadedFiles.blobUrl,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId)) // Filter by the current user ID
      .orderBy(desc(uploadedFiles.updatedAt))
      .limit(10); // Get the 10 most recent files
    
    // Transform the data if needed
    const formattedFiles = await Promise.all(
      recentFiles.map(async file => ({
        id: file.id,
        name: file.name,
        type: file.type === 'pdf' ? 'file' : (file.type === 'image' ? 'image' : 'markdown'),
        date: file.date ? new Date(file.date).toISOString() : new Date().toISOString(),
        // Links to stored files are signed on the way out (they expire)
        path: file.path ? await signR2Url(file.path) : '',
      }))
    );

    return NextResponse.json(formattedFiles);
  } catch (error) {
    console.error('Error fetching recent files:', error);
    
    // Return empty array with error code
    return NextResponse.json([], { status: 500 });
  }
}
