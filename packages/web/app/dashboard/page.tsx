'use client';

import * as React from 'react';
import { Link } from '@/components/ui/link';
import {
  CreditCard,
  FileText,
  Smartphone,
  Upload,
  Zap,
  ExternalLink,
  Files,
  Image,
  Calendar,
  FileSymlink,
  RefreshCw,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function DashboardPage() {
  const [apiUsage, setApiUsage] = React.useState({
    tokenUsage: 0,
    maxTokenUsage: 0,
    audioTranscriptionMinutes: 0,
    maxAudioTranscriptionMinutes: 0,
    subscriptionStatus: '',
    currentPlan: '',
    nextReset: '',
    isActive: false,
  });
  const [recentFiles, setRecentFiles] = React.useState<
    Array<{
      id: number;
      name: string;
      type: string;
      date: string;
      path: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch data on component mount
  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch API usage data
        const usageResponse = await fetch('/api/usage', {});

        if (!usageResponse.ok) {
          throw new Error('Failed to fetch API usage data');
        }
        const usageData = await usageResponse.json();
        setApiUsage(usageData);

        // Fetch recent files
        const filesResponse = await fetch('/api/files/recent');
        if (!filesResponse.ok) {
          throw new Error('Failed to fetch recent files');
        }
        const filesData = await filesResponse.json();
        setRecentFiles(filesData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Helper to get icon based on file type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'markdown':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'image':
        return <Image className="h-4 w-4 text-purple-500" />;
      default:
        return <FileSymlink className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format date in a readable way
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  // Calculate percentage for progress bars
  const calculatePercentage = (current: number, max: number) => {
    return Math.min(Math.round((current / max) * 100), 100);
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      // Refresh the recent files list
      const filesResponse = await fetch('/api/files/recent');
      if (!filesResponse.ok) {
        throw new Error('Failed to fetch recent files');
      }
      const filesData = await filesResponse.json();
      setRecentFiles(filesData);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 pt-6 bg-white">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted-foreground">
            Welcome to Note Companion - your centralized note management hub.
          </p>
        </div>
      </div>

      {/* API Usage Card */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle>API Usage</CardTitle>
          <CardDescription>
            {!isLoading && apiUsage.maxAudioTranscriptionMinutes > 0
              ? 'Your current token and transcription minutes usage'
              : 'Your current token usage'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Token Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(apiUsage.tokenUsage)} /{' '}
                    {formatNumber(apiUsage.maxTokenUsage)} tokens
                  </span>
                </div>
                <Progress
                  value={calculatePercentage(
                    apiUsage.tokenUsage,
                    apiUsage.maxTokenUsage
                  )}
                  className="h-2"
                />
              </div>

              {/* Audio Transcription Minutes Usage */}
              {apiUsage.maxAudioTranscriptionMinutes > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Audio Transcription Minutes
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {apiUsage.audioTranscriptionMinutes.toFixed(1)} /{' '}
                      {apiUsage.maxAudioTranscriptionMinutes} min
                    </span>
                  </div>
                  <Progress
                    value={calculatePercentage(
                      apiUsage.audioTranscriptionMinutes,
                      apiUsage.maxAudioTranscriptionMinutes
                    )}
                    className="h-2"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Current Plan</span>
                  </div>
                  <p className="text-xl font-bold">
                    {apiUsage.currentPlan || 'Free'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {apiUsage.subscriptionStatus || 'Active'}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Usage</span>
                  </div>
                  <p className="text-xl font-bold">
                    {calculatePercentage(
                      apiUsage.tokenUsage,
                      apiUsage.maxTokenUsage
                    )}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of your monthly allocation
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Next Reset</span>
                  </div>
                  <p className="text-xl font-bold">
                    {apiUsage.nextReset || 'Loading...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usage resets on this date
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {apiUsage.isActive && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/subscribers">
                      <Key className="mr-2 h-4 w-4" />
                      Get license key
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/pricing">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Upgrade Plan
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile App Card - Hidden for now */}
      {false && (
        <div className="grid gap-6 md:grid-cols-1">
          {/* New Mobile App Card */}
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle>Note Companion Mobile</CardTitle>
              {/* <CardDescription>Our brand new mobile experience</CardDescription> */}
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 flex items-center justify-center rounded-full bg-blue-50">
                  <Smartphone className="h-8 w-8 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Now in Beta</h3>
                  <p className="text-sm text-muted-foreground">
                    The Note Companion mobile app is now available for iOS.
                    Capture notes, screenshots, and sync them directly to your
                    vault with ease.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      iOS
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Share Extension
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Instant Sync
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button className="w-full" size="sm" asChild>
                <Link href="https://discord.gg/udQnCRFyus" target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Join early access through discord
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Recent Files Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recent Synced Files</CardTitle>
          <CardDescription>
            Your most recently synced files from the Note Companion database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p className="text-sm font-medium">Failed to load recent files</p>
              <p className="text-xs mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Files className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No files synced yet</p>
              <p className="text-xs mt-1">Upload files to see them here</p>
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="mx-auto">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.path}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{formatDate(file.date)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
