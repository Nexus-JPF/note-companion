import * as React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { FileText, FileImage } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { UploadedFile } from "@/drizzle/schema";

interface FileCardProps {
  file: UploadedFile;
  onView: (file: UploadedFile) => void;
}

export function FileCard({ file, onView }: FileCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const getFileIcon = () => {
    if (file.fileType.includes('image')) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-amber-500" />;
  };

  const renderPreview = () => {
    // Magic diagrams: show the generated image rather than the original upload
    if (file.processType === 'magic-diagram' && file.generatedImageUrl) {
      return (
        <div className="mt-2 rounded-md overflow-hidden bg-slate-50 flex justify-center items-center h-40">
          <img
            src={file.generatedImageUrl}
            alt={`Generated diagram for ${file.originalName}`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    // For images, show the actual image
    if (file.fileType.includes('image')) {
      return (
        <div className="mt-2 rounded-md overflow-hidden bg-slate-50 flex justify-center items-center h-40">
          <img 
            src={file.blobUrl} 
            alt={file.originalName} 
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    // For text content, show a nice preview
    if (file.textContent) {
      const previewText = file.textContent.length > 200 
        ? file.textContent.substring(0, 200) + '...' 
        : file.textContent;
      
      return (
        <div className="mt-2 p-3 bg-slate-50 rounded-md overflow-hidden text-sm text-slate-800">
          <p className="line-clamp-4">{previewText}</p>
        </div>
      );
    }

    // Default preview (file icon)
    return (
      <div className="mt-2 h-20 flex items-center justify-center bg-slate-50 rounded-md">
        {getFileIcon()}
        <span className="ml-2 text-sm text-slate-600">No preview available</span>
      </div>
    );
  };

  return (
    <Card 
      className="w-full hover:shadow-md transition-shadow duration-200 cursor-pointer" 
      onClick={() => onView(file)}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start flex-wrap">
          <div className="flex items-start space-x-2 mb-2">
            {getFileIcon()}
            <div>
              <h3 className="font-medium leading-tight truncate max-w-[180px]" title={file.originalName}>
                {file.originalName}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(new Date(file.createdAt))}
              </p>
            </div>
          </div>
          <div className="min-w-fit">
            <StatusBadge status={file.status} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {renderPreview()}
        
        {file.error && (
          <p className="mt-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            {file.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
