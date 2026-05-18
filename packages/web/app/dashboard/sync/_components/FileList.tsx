'use client';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { FileCard } from './FileCard';
import type { UploadedFile } from '@/drizzle/schema';
import { Button } from '@/components/ui/button';

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  RefreshCw,
  Filter,
  Grid,
  List,
  ArrowUpDown,
  Clock,
  Copy,
  Check,
  FileText,
  FileImage,
  Eye,
  Download,
  UploadCloud,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getFiles, deleteFile } from '../actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from './StatusBadge';

interface FileListProps {
  pageSize?: number;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export function FileList({ pageSize = 12 }: FileListProps) {
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchFiles = async (shouldShowLoading = true) => {
    try {
      if (shouldShowLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Use server action instead of fetch
      const result = await getFiles({ page, limit: pageSize });

      if ('error' in result) {
        throw new Error(result.error);
      }

      setFiles(result.files as UploadedFile[]);
      filterAndSortFiles(
        result.files as UploadedFile[],
        searchQuery,
        statusFilter,
        typeFilter,
        sortBy,
        sortOrder
      );
      setPagination(result.pagination);
    } catch (err: any) {
      // Handle Server Action deployment mismatch errors
      if (err?.message?.includes('Failed to find Server Action') ||
          err?.message?.includes('workers')) {
        setError('The application was recently updated. Please refresh the page and try again.');
        console.error('Server Action deployment mismatch:', err);
      } else {
        setError('Failed to load files. Please try again.');
        console.error('Error fetching files:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAndSortFiles = (
    filesArray: UploadedFile[],
    query: string,
    status: string | null,
    type: string | null,
    sort: SortBy,
    order: SortOrder
  ) => {
    // Apply filters
    let result = filesArray.filter((file) => {
      const matchesSearch = query
        ? file.originalName.toLowerCase().includes(query.toLowerCase()) ||
          (file.textContent &&
            file.textContent.toLowerCase().includes(query.toLowerCase()))
        : true;

      const matchesStatus = status ? file.status === status : true;
      const matchesType = type ? file.fileType.includes(type) : true;

      return matchesSearch && matchesStatus && matchesType;
    });

    // Apply sort
    result = [...result].sort((a, b) => {
      let comparison = 0;

      if (sort === 'date') {
        comparison =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sort === 'name') {
        comparison = a.originalName.localeCompare(b.originalName);
      } else if (sort === 'type') {
        comparison = a.fileType.localeCompare(b.fileType);
      }

      return order === 'asc' ? -comparison : comparison;
    });

    setFilteredFiles(result);
  };

  useEffect(() => {
    fetchFiles();
  }, [page, pageSize]);

  useEffect(() => {
    filterAndSortFiles(
      files,
      searchQuery,
      statusFilter,
      typeFilter,
      sortBy,
      sortOrder
    );
  }, [searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  const handleDelete = async (id: number) => {
    try {
      // Use server action instead of fetch
      const result = await deleteFile(id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete file');
      }

      // Refresh the file list
      fetchFiles();
    } catch (err: any) {
      // Handle Server Action deployment mismatch errors
      if (err?.message?.includes('Failed to find Server Action') ||
          err?.message?.includes('workers')) {
        alert('The application was recently updated. Please refresh the page and try again.');
      } else {
        console.error('Error deleting file:', err);
        alert('Failed to delete file. Please try again.');
      }
    }
  };

  const handleView = (file: UploadedFile) => {
    setSelectedFile(file);
    setPreviewOpen(true);
  };

  const handleExternalView = (file: UploadedFile) => {
    // Open file preview or download in a new tab
    window.open(file.blobUrl, '_blank');
  };

  const handleRefresh = () => {
    fetchFiles(false);
  };

  const toggleSortOrder = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const getUniqueFileTypes = () => {
    const types = new Set<string>();
    files.forEach((file) => {
      if (file.fileType.includes('image')) {
        types.add('image');
      } else if (file.fileType.includes('pdf')) {
        types.add('pdf');
      } else {
        types.add(file.fileType);
      }
    });
    return Array.from(types);
  };

  const getUniqueStatuses = () => {
    return Array.from(new Set(files.map((file) => file.status)));
  };

  const renderFilterBar = () => (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2 items-center flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className={cn('h-10 px-2', refreshing && 'animate-spin')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant={statusFilter === null ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(null)}
                    >
                      All
                    </Button>
                    {getUniqueStatuses().map((status) => (
                      <Button
                        key={status}
                        variant={
                          statusFilter === status ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">File Type</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant={typeFilter === null ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter(null)}
                    >
                      All
                    </Button>
                    {getUniqueFileTypes().map((type) => (
                      <Button
                        key={type}
                        variant={typeFilter === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter(type)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex items-center border rounded-md">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-r-none',
              sortBy === 'date' && 'bg-slate-100'
            )}
            onClick={() => setSortBy('date')}
          >
            Date
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-none border-x',
              sortBy === 'name' && 'bg-slate-100'
            )}
            onClick={() => setSortBy('name')}
          >
            Name
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-l-none',
              sortBy === 'type' && 'bg-slate-100'
            )}
            onClick={() => setSortBy('type')}
          >
            Type
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          className="h-9 w-9"
        >
          <ArrowUpDown
            className={cn(
              'h-4 w-4 transition-transform',
              sortOrder === 'asc' ? 'rotate-0' : 'rotate-180'
            )}
          />
        </Button>
        <div className="flex border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-r-none h-9 w-9',
              viewMode === 'grid' && 'bg-slate-100'
            )}
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-l-none border-l h-9 w-9',
              viewMode === 'list' && 'bg-slate-100'
            )}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderFilePreview = () => {
    if (!selectedFile) return null;

    return (
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl min-w-[65vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">
              <div className="flex items-center gap-2 flex-wrap pb-1">
                <span className="truncate">{selectedFile.originalName}</span>
                <StatusBadge status={selectedFile.status} />
              </div>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(selectedFile.createdAt).toLocaleString()}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-slate-50 rounded-md">
            {selectedFile.fileType.includes('image') ? (
              <div className="flex justify-center items-center h-full bg-white p-4 rounded-lg shadow-sm">
                <img
                  src={selectedFile.blobUrl}
                  alt={selectedFile.originalName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : selectedFile.textContent ? (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow-sm rounded-lg p-8 my-4">
                  <div className="mb-6 pb-4 border-b flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-medium">
                        {selectedFile.originalName}
                      </h2>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          {new Date(selectedFile.createdAt).toLocaleString()}
                        </div>
                        <div>•</div>
                        <div>
                          {selectedFile.fileType.split('/')[1] ||
                            selectedFile.fileType}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 h-8"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            selectedFile.textContent || ''
                          );
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy text
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 h-8"
                        onClick={() => handleExternalView(selectedFile)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                    {/* Check if the content is likely markdown */}
                    {selectedFile.textContent.includes('#') ||
                    selectedFile.textContent.includes('**') ||
                    selectedFile.textContent.includes('- ') ||
                    selectedFile.textContent.includes('```') ||
                    selectedFile.originalName.endsWith('.md') ? (
                      // @ts-expect-error - react-markdown types not fully compatible with React 19
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedFile.textContent}
                      </ReactMarkdown>
                    ) : (
                      /* For plain text, render with proper paragraphs */
                      selectedFile.textContent
                        .split('\n\n')
                        .map((paragraph, i) => (
                          <p key={i} className="mb-4 text-base">
                            {paragraph.split('\n').map((line, j) => (
                              <React.Fragment key={j}>
                                {line}
                                {j < paragraph.split('\n').length - 1 && <br />}
                              </React.Fragment>
                            ))}
                          </p>
                        ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground">No preview available</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleExternalView(selectedFile)}
                >
                  Open in browser
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end p-4 border-t bg-white">
            {selectedFile.fileType.includes('image') && (
              <Button
                variant="outline"
                onClick={() => handleExternalView(selectedFile)}
              >
                Open in browser
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-red-600">{error}</p>
        {/* @ts-expect-error */}
        <Button onClick={fetchFiles}>Try Again</Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6 bg-slate-50 rounded-xl text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
          <UploadCloud className="h-10 w-10 text-violet-500" />
        </div>
        <div className="max-w-md">
          <h3 className="text-xl font-semibold mb-2">
            Welcome to Note Companion Sync
          </h3>
          <p className="text-gray-600 mb-4">
            Note Companion Sync is a secure way to create OCR from your images
            and documents.
          </p>
          <div className="flex flex-col space-y-2 items-center">
            <div className="flex items-center bg-blue-50 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-blue-500 mr-2" />
              <span className="text-sm text-blue-700">
                Coming soon: Easy screenshot capturing with our mobile app
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderFilterBar()}

      {filteredFiles.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            No files match your search criteria
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter(null);
              setTypeFilter(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} onView={handleView} />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">File Name</th>
                <th className="text-left p-3 text-sm font-medium">Type</th>
                <th className="text-left p-3 text-sm font-medium">Status</th>
                <th className="text-left p-3 text-sm font-medium">Date</th>
                <th className="text-right p-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleView(file)}
                >
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      {file.fileType.includes('image') ? (
                        <FileImage className="h-5 w-5 text-blue-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-amber-500" />
                      )}
                      <span
                        className="font-medium truncate max-w-[200px]"
                        title={file.originalName}
                      >
                        {file.originalName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {file.fileType.split('/')[1] || file.fileType}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={file.status} />
                  </td>
                  <td className="p-3 text-sm">
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(file.createdAt))}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(file);
                        }}
                        className="text-blue-600"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="h-9 px-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center">
            <span className="text-sm">
              Page <span className="font-medium">{page}</span> of{' '}
              <span className="font-medium">{pagination.totalPages}</span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === pagination.totalPages}
            className="h-9 px-4"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {renderFilePreview()}
    </div>
  );
}
