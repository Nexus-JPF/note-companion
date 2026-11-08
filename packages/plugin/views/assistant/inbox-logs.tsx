import * as React from "react";
import {
  FileRecord,
  FileStatus,
} from "../../inbox/services/record-manager";
import {
  Clock,
  Play,
  Check,
  AlertCircle,
  Ban,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { usePlugin } from "./provider";
import { Inbox } from "../../inbox";
import {
  VALID_AUDIO_EXTENSIONS,
  VALID_IMAGE_EXTENSIONS,
} from "../../constants";
import { TFile, Notice } from "obsidian";
import { ProcessingTimeline } from "./organizer/components/processing-timeline";
import { UndoButton } from "./organizer/components/undo-button";
import { RecentIssuesPanel } from "./inbox-logs/recent-issues-panel";

// Add this helper component for the filename display
const FileNameDisplay: React.FC<{ record: FileRecord }> = ({ record }) => {
  const hasNewName = record.newName && record.originalName !== record.newName;

  if (!hasNewName) {
    return (
      <span className="text-[--text-accent]">
        {record.originalName || "No file"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[--text-muted] line-through">
        {record.originalName}
      </span>
      <span className="text-[--text-muted]">→</span>
      <span className="text-[--text-accent]">{record.newName}</span>
    </div>
  );
};

// Helper function to extract error summary from FileRecord
const getErrorSummary = (record: FileRecord): string | null => {
  if (record.status !== "error") {
    return null;
  }

  // Search through logs for entries with error property
  for (const logEntry of Object.values(record.logs)) {
    if (logEntry.error) {
      const errorMessage = logEntry.error.message;
      // Truncate to ~50 characters if needed
      if (errorMessage.length > 50) {
        return errorMessage.substring(0, 47) + "...";
      }
      return errorMessage;
    }
  }

  return null;
};

// Add this component for essential information display
const EssentialInfoDisplay: React.FC<{ record: FileRecord }> = ({ record }) => {
  const plugin = usePlugin();
  const hasRename = record.newName && record.originalName !== record.newName;
  const hasMove = record.newPath;

  // Helper function to find action logs and get timestamps
  const getActionTimestamp = (actionContains: string): string | null => {
    const found = Object.entries(record.logs).find(([actionKey]) =>
      actionKey.includes(actionContains)
    );
    return found ? (found[1]).timestamp : null;
  };

  // Format timestamp using moment
  const formatTimestamp = (ts: string | null): string => {
    return ts ? window.moment(ts).format("HH:mm:ss") : "";
  };

  // Get file extension
  const fileExtension =
    record.originalName.split(".").pop()?.toLowerCase() || "";

  // Check for specific actions in the logs
  const hasTranscribedAudio = Object.keys(record.logs).some(
    action =>
      action.includes("EXTRACT_DONE") &&
      VALID_AUDIO_EXTENSIONS.some(ext => fileExtension === ext)
  );

  const audioTimestamp = hasTranscribedAudio
    ? getActionTimestamp("EXTRACT_DONE")
    : null;

  const hasProcessedImage = Object.keys(record.logs).some(
    action =>
      action.includes("EXTRACT_DONE") &&
      VALID_IMAGE_EXTENSIONS.some(ext => fileExtension === ext)
  );

  const imageTimestamp = hasProcessedImage
    ? getActionTimestamp("EXTRACT_DONE")
    : null;

  const hasYouTubeTranscript = Object.keys(record.logs).some(action =>
    action.includes("FETCH_YOUTUBE")
  );

  const youtubeTimestamp = hasYouTubeTranscript
    ? getActionTimestamp("FETCH_YOUTUBE_DONE")
    : null;

  const hasFormatted =
    record.formatted ||
    Object.keys(record.logs).some(action => action.includes("FORMATTING_DONE"));

  const formattingTimestamp = hasFormatted
    ? getActionTimestamp("FORMATTING_DONE")
    : null;

  if (
    !hasRename &&
    !hasMove &&
    !hasTranscribedAudio &&
    !hasProcessedImage &&
    record.tags.length === 0 &&
    !hasYouTubeTranscript &&
    !hasFormatted
  ) {
    return null;
  }

  return (
    <div className="space-y-2">
      {hasRename && (
        <div className="text-sm">
          Renamed as{" "}
          <span
            className="text-[--text-accent] cursor-pointer hover:underline"
            onClick={() => {
              if (record.file) {
                void plugin.app.workspace.getLeaf().openFile(record.file);
              } else {
                const filePath = record.newPath
                  ? `${record.newPath}/${record.newName || record.originalName}`
                  : record.newName || record.originalName;
                const file = plugin.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                  void plugin.app.workspace.getLeaf().openFile(file);
                } else {
                  new Notice("File not found");
                }
              }
            }}
          >
            {record.newName}
          </span>{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(getActionTimestamp("RENAME_DONE"))}
          </span>
        </div>
      )}

      {hasMove && (
        <div className="text-sm">
          Moved to{" "}
          <span
            className="text-[--text-accent] cursor-pointer hover:underline"
            onClick={() => {
              if (record.file) {
                void plugin.app.workspace.getLeaf().openFile(record.file);
              } else {
                // Try to construct path from newPath and newName/originalName
                const fileName = record.newName || record.originalName;
                const filePath = record.newPath
                  ? `${record.newPath}/${fileName}${
                      fileName.endsWith(".md") ? "" : ".md"
                    }`
                  : fileName;
                const file = plugin.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                  void plugin.app.workspace.getLeaf().openFile(file);
                } else {
                  new Notice("File not found");
                }
              }
            }}
          >
            {record.newPath}
          </span>{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(getActionTimestamp("MOVING_DONE"))}
          </span>
        </div>
      )}

      {hasTranscribedAudio && (
        <div className="text-sm">
          Transcribed audio{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(audioTimestamp)}
          </span>
        </div>
      )}

      {hasProcessedImage && (
        <div className="text-sm">
          Processed image{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(imageTimestamp)}
          </span>
        </div>
      )}

      {hasFormatted && (
        <div className="text-sm">
          Note formatted as{" "}
          <span
            className="text-[--text-accent] cursor-pointer hover:underline"
            onClick={() => {
              // Open the template file when clicked
              if (record.classification) {
                const templatePath = `${plugin.settings.templatePaths}/${record.classification}.md`;
                const templateFile =
                  plugin.app.vault.getAbstractFileByPath(templatePath);
                if (templateFile instanceof TFile) {
                  void plugin.app.workspace
                    .getLeaf()
                    .openFile(templateFile);
                } else {
                  // If template file not found, show notification
                  new Notice(`Template file not found: ${templatePath}`);
                }
              }
            }}
          >
            {record.classification || "document"}
          </span>{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(formattingTimestamp)}
          </span>
        </div>
      )}

      {record.tags.length > 0 && (
        <div className="text-sm">Added tags: {record.tags.join(", ")}</div>
      )}

      {hasYouTubeTranscript && (
        <div className="text-sm">
          Extracted YouTube transcript{" "}
          <span className="text-[--text-muted] text-xs">
            {formatTimestamp(youtubeTimestamp)}
          </span>
        </div>
      )}
    </div>
  );
};

// Helper function to get queue position
function getQueuePosition(record: FileRecord): { position: number; total: number } | null {
  try {
    const inbox = Inbox.getInstance();
    const allRecords = inbox.getAllFiles();
    const queued = allRecords.filter((r) => r.status === "queued");
    const processing = allRecords.filter((r) => r.status === "processing");

    if (record.status === "queued") {
      const position = queued.findIndex((r) => r.id === record.id) + 1;
      const total = queued.length + processing.length;
      return total > 1 ? { position, total } : null;
    }
    if (record.status === "processing") {
      const position = queued.length + processing.findIndex((r) => r.id === record.id) + 1;
      const total = queued.length + processing.length;
      return total > 1 ? { position, total } : null;
    }
    return null;
  } catch {
    // Silently handle errors (Inbox might not be initialized)
    return null;
  }
}

// Main file card component - compressed, dense list item
function FileCard({ record }: { record: FileRecord }) {
  const plugin = usePlugin();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const errorSummary = getErrorSummary(record);
  const queuePosition = getQueuePosition(record);

  // Check if there's content to show when expanded
  const hasExpandableContent =
    record.status === "processing" ||
    record.status === "completed" ||
    record.status === "error";

  return (
    <div className="border-b border-[--background-modifier-border] hover:bg-[--background-modifier-hover]">
      <div
        className="px-3 py-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Compact header - single line */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Expand/collapse chevron - only show if there's expandable content */}
            {hasExpandableContent && (
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[--text-muted]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[--text-muted]" />
                )}
              </div>
            )}
            <div
              className="cursor-pointer flex items-center gap-2 flex-1 min-w-0"
              onClick={e => {
                e.stopPropagation();
                if (record.file) {
                  // Open the actual file if it exists
                  void plugin.app.workspace.getLeaf().openFile(record.file);
                } else {
                  // Fallback: try to open by path if file reference is missing
                  const filePath = record.newPath
                    ? `${record.newPath}/${
                        record.newName || record.originalName
                      }`
                    : record.originalName;
                  const file = plugin.app.vault.getAbstractFileByPath(filePath);
                  if (file instanceof TFile) {
                    void plugin.app.workspace.getLeaf().openFile(file);
                  } else {
                    new Notice("File not found or has been moved");
                  }
                }
              }}
            >
              <StatusBadge status={record.status} />
              <FileNameDisplay record={record} />
              {queuePosition && (
                <span className="text-[--text-muted] text-xs">
                  (Queue: {queuePosition.position}/{queuePosition.total})
                </span>
              )}
              {errorSummary && (
                <span className="text-[--text-error] text-xs truncate">
                  • {errorSummary}
                </span>
              )}
              {record.dismissed && (
                <span className="text-[--text-faint] text-xs flex-shrink-0">
                  dismissed
                </span>
              )}
            </div>
          </div>
          <UndoButton record={record} plugin={plugin} />
        </div>

        {/* Essential info - only when expanded */}
        {isExpanded && (
          <div className="mt-2 space-y-2">
            <EssentialInfoDisplay record={record} />

            {/* Processing Timeline */}
            {(record.status === "processing" ||
              record.status === "completed" ||
              record.status === "error") && (
              <div className="mt-4 -mx-3 px-3">
                <ProcessingTimeline record={record} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Status badge component
const StatusBadge: React.FC<{ status: FileStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-[--text-success]";
      case "error":
        return "bg-[--text-error]";
      case "processing":
        return "bg-[--text-accent]";
      default:
        return "bg-[--text-muted]";
    }
  };

  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{status}</span>
      <span
        className={`w-2 h-2 rounded-full ${getStatusColor()}`}
        aria-hidden="true"
      />
    </span>
  );
};

// Analytics component
const InboxAnalytics: React.FC<{
  analytics: ReturnType<typeof Inbox.prototype.getAnalytics>;
}> = ({ analytics }) => {
  const { byStatus } = analytics;

  // Split statuses into main flow and exceptions
  const mainFlow: Array<{
    status: FileStatus;
    icon: React.ReactNode;
  }> = [
    { status: "queued", icon: <Clock className="w-4 h-4" /> },
    { status: "processing", icon: <Play className="w-4 h-4" /> },
    { status: "completed", icon: <Check className="w-4 h-4" /> },
  ];

  const exceptions: Array<{
    status: FileStatus;
    icon: React.ReactNode;
  }> = [
    { status: "error", icon: <AlertCircle className="w-4 h-4" /> },
    { status: "bypassed", icon: <Ban className="w-4 h-4" /> },
  ];

  const StatusBox = ({
    status,
    icon,
  }: {
    status: FileStatus;
    icon: React.ReactNode;
  }) => (
    <div
      key={status}
      className="bg-[--background-primary] p-4 rounded text-center flex flex-col items-center"
    >
      <div className="text-sm capitalize">{status}</div>
      <div className="font-semibold">{byStatus[status] || 0}</div>
      <div className="mt-1 text-[--text-muted]">{icon}</div>
    </div>
  );

  return (
    <div className="bg-[--background-secondary] ">
      <div className="space-y-2">
        {/* Main flow row */}
        <div className="grid grid-cols-3 gap-2">
          {mainFlow.map(({ status, icon }) => (
            <StatusBox key={status} status={status} icon={icon} />
          ))}
        </div>

        {/* Exceptions row */}
        <div className="grid grid-cols-2 gap-2">
          {exceptions.map(({ status, icon }) => (
            <StatusBox key={status} status={status} icon={icon} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Update types
type DateRange =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "all"
  | "custom";

interface DateFilter {
  range: DateRange;
  startDate: string;
  endDate: string;
}

// Enhanced date filter component
const DateFilterSelect: React.FC<{
  value: DateFilter;
  onChange: (filter: DateFilter) => void;
}> = ({ value, onChange }) => {
  const ranges: Array<{ value: DateRange; label: string }> = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7days", label: "Last 7 days" },
    { value: "last30days", label: "Last 30 days" },
    { value: "custom", label: "Pick date" },
    { value: "all", label: "All time" },
  ];

  const getDateRange = (
    range: DateRange,
    customDate?: string
  ): { startDate: string; endDate: string } => {
    let end = window.moment().endOf("day");
    let start = window.moment().startOf("day");

    switch (range) {
      case "today":
        break;
      case "yesterday":
        start = start.subtract(1, "day");
        end.subtract(1, "day");
        break;
      case "last7days":
        start = start.subtract(6, "days");
        break;
      case "last30days":
        start = start.subtract(29, "days");
        break;
      case "custom":
        if (customDate) {
          start = window.moment(customDate).startOf("day");
          end = window.moment(customDate).endOf("day");
        }
        break;
      case "all":
        start = window.moment(0);
        break;
    }

    return {
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
    };
  };

  const handleRangeChange = (range: DateRange) => {
    const dates = getDateRange(range);
    onChange({
      range,
      ...dates,
    });
  };

  const handleDateChange = (date: string) => {
    const dates = getDateRange("custom", date);
    onChange({
      range: "custom",
      ...dates,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[--text-muted]" />
        <select
          value={value.range}
          onChange={e => handleRangeChange(e.target.value as DateRange)}
          className="pl-2 pr-8 h-min py-2 bg-[--background-secondary] rounded-l border border-[--background-modifier-border] text-sm appearance-none"
        >
          {ranges.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Calendar picker - only shown when 'custom' is selected */}
      {value.range === "custom" && (
        <input
          type="date"
          value={value.startDate}
          onChange={e => handleDateChange(e.target.value)}
          className="py-2 pl-6 pr-2 bg-[--background-secondary] rounded-r border border-[--background-modifier-border] text-sm w-min"
          max={window.moment().format("YYYY-MM-DD")}
        />
      )}
    </div>
  );
};

// Update SearchBar props
interface SearchBarProps {
  onSearch: (query: string) => void;
  onStatusFilter: (status: FileStatus | "") => void;
  onDateFilter: (filter: DateFilter) => void;
  selectedStatus: FileStatus | "";
  dateFilter: DateFilter;
}

// Update SearchBar component
const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onStatusFilter,
  onDateFilter,
  selectedStatus,
  dateFilter,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const statuses: Array<FileStatus | ""> = [
    "",
    "queued",
    "processing",
    "completed",
    "error",
    "bypassed",
  ];

  return (
    <div className="bg-[--background-primary] p-4 border border-[--background-modifier-border] space-y-3">
      {/* Search input row */}
      <div className="pl-10 relative flex-1">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[--text-muted]" />
        <input
          type="text"
          placeholder="Search files, tags, or actions..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 h-min py-2 bg-[--background-secondary] rounded border border-[--background-modifier-border] text-sm"
        />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3">
        <div className="relative w-[200px]">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[--text-muted]" />
          <select
            value={selectedStatus}
            onChange={e => onStatusFilter(e.target.value as FileStatus | "")}
            className="w-full pl-9 pr-4 h-min py-2 bg-[--background-secondary] rounded border border-[--background-modifier-border] text-sm appearance-none"
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status
                  ? status.charAt(0).toUpperCase() + status.slice(1)
                  : "All Status"}
              </option>
            ))}
          </select>
        </div>
        <DateFilterSelect value={dateFilter} onChange={onDateFilter} />
      </div>
    </div>
  );
};

// Main component
export const InboxLogs: React.FC = () => {
  const plugin = usePlugin();
  const [records, setRecords] = React.useState<FileRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = React.useState<FileRecord[]>(
    []
  );
  const [analytics, setAnalytics] =
    React.useState<ReturnType<typeof Inbox.prototype.getAnalytics>>();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<FileStatus | "">("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>({
    range: "today",
    startDate: window.moment().format("YYYY-MM-DD"),
    endDate: window.moment().format("YYYY-MM-DD"),
  });

  // Memoize filterRecords to prevent recreation on every render
  const filterRecords = React.useCallback(
    (records: FileRecord[]) => {
      return records.filter(record => {
        const matchesSearch = searchQuery
          .toLowerCase()
          .split(" ")
          .every(
            term =>
              record.file?.basename.toLowerCase().includes(term) ||
              record?.tags.some(tag => tag.toLowerCase().includes(term)) ||
              Object.keys(record.logs).some(action =>
                action.toLowerCase().includes(term)
              ) ||
              record.classification?.toLowerCase().includes(term)
          );

        const matchesStatus = !statusFilter || record.status === statusFilter;

        const matchesDate =
          dateFilter.range === "all" ||
          Object.values(record.logs).some(log => {
            const logDate = window.moment(log.timestamp);
            return logDate.isBetween(
              window.moment(dateFilter.startDate).startOf("day"),
              window.moment(dateFilter.endDate).endOf("day"),
              "day",
              "[]"
            );
          });

        return matchesSearch && matchesStatus && matchesDate;
      });
    },
    [
      searchQuery,
      statusFilter,
      dateFilter.range,
      dateFilter.startDate,
      dateFilter.endDate,
    ]
  );

  // Add a function to check if records have changed
  const haveRecordsChanged = (
    oldRecords: FileRecord[],
    newRecords: FileRecord[]
  ) => {
    if (oldRecords.length !== newRecords.length) return true;

    return newRecords.some((newRecord, index) => {
      const oldRecord = oldRecords[index];
      return (
        newRecord.status !== oldRecord.status ||
        newRecord.tags.length !== oldRecord.tags.length ||
        Object.keys(newRecord.logs).length !==
          Object.keys(oldRecord.logs).length ||
        newRecord.newName !== oldRecord.newName ||
        newRecord.newPath !== oldRecord.newPath
      );
    });
  };

  // Update filtered records when filters change
  React.useEffect(() => {
    setFilteredRecords(filterRecords(records));
  }, [filterRecords, records]);

  // Fetch data periodically
  React.useEffect(() => {
    const fetchData = () => {
      const newFiles = plugin.inbox.getAllFiles();
      const newAnalytics = plugin.inbox.getAnalytics();

      // Only update if something has changed
      if (haveRecordsChanged(records, newFiles)) {
        setRecords(newFiles);
      }

      // Update analytics only if they've changed
      if (JSON.stringify(analytics) !== JSON.stringify(newAnalytics)) {
        setAnalytics(newAnalytics);
      }
    };

    fetchData();
    const intervalId = window.setInterval(fetchData, 1000);
    return () => window.clearInterval(intervalId);
  }, [plugin.inbox, records, analytics]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleStatusFilter = (status: FileStatus | "") => {
    setStatusFilter(status);
  };

  const handleDateFilter = (filter: DateFilter) => {
    setDateFilter(filter);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Analytics - compact, no padding */}
      {analytics && (
        <div className="border-b border-[--background-modifier-border]">
          <InboxAnalytics analytics={analytics} />
        </div>
      )}

      {/* Recent Issues Panel - NEW */}
      <RecentIssuesPanel plugin={plugin} />

      {/* Search bar - flush */}
      <div className="border-b border-[--background-modifier-border] px-3 py-2">
        <SearchBar
          onSearch={handleSearch}
          onStatusFilter={handleStatusFilter}
          onDateFilter={handleDateFilter}
          selectedStatus={statusFilter}
          dateFilter={dateFilter}
        />
      </div>

      {/* Date indicator - minimal */}
      {dateFilter.range !== "all" && (
        <div className="text-xs text-[--text-muted] px-3 py-1 border-b border-[--background-modifier-border]">
          {dateFilter.range === "custom" ? (
            <>{window.moment(dateFilter.startDate).format("MMM D, YYYY")}</>
          ) : (
            <>
              {window.moment(dateFilter.startDate).format("MMM D")}
              {dateFilter.startDate !== dateFilter.endDate &&
                ` - ${window.moment(dateFilter.endDate).format("MMM D")}`}
            </>
          )}
        </div>
      )}

      {/* File list - dense, flush edges */}
      <div className="flex-1 overflow-y-auto">
        {filteredRecords.map(record => (
          <FileCard key={record.id} record={record} />
        ))}
        {filteredRecords.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs text-[--text-muted]">
            {records.length === 0 ? "No records found" : "No matching records"}
          </div>
        )}
      </div>
    </div>
  );
};
