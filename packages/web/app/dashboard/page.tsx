'use client';

import { ManageSubscriptionLink } from "@/components/manage-subscription-link";
import * as React from 'react';
import { Link } from '@/components/ui/link';
import {
  CreditCard,
  FileText,
  Upload,
  Zap,
  Files,
  Image,
  Calendar,
  FileSymlink,
  RefreshCw,
  Key,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== new Date().getFullYear() && {
        year: 'numeric',
      }),
    });
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
                {['active', 'trialing', 'past_due', 'unpaid'].includes(
                  apiUsage.subscriptionStatus
                ) &&
                  apiUsage.currentPlan !== 'Free Plan' && (
                  <Button variant="outline" size="sm" asChild>
                    <ManageSubscriptionLink>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage or cancel subscription
                    </ManageSubscriptionLink>
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

      {/* Mobile app card: see mobile-app-card.tsx — add <MobileAppCard /> when ready */}

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
                    onChange={(e) => { void handleFileUpload(e); }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {recentFiles.map((file) => {
                const row = (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file.type)}
                      <span className="text-sm font-medium truncate">
                        {file.name}
                      </span>
                      {file.path && (
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                    <span
                      className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
                      title={new Date(file.date).toLocaleString()}
                    >
                      {formatDate(file.date)}
                    </span>
                  </>
                );
                const rowClass =
                  'group flex items-center justify-between gap-4 px-2 py-2 rounded-md hover:bg-slate-50';
                return file.path ? (
                  <a
                    key={file.id}
                    href={file.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={rowClass}
                  >
                    {row}
                  </a>
                ) : (
                  <div key={file.id} className={rowClass}>
                    {row}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
