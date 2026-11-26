import { ItemView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { Root, createRoot } from "react-dom/client";
import { AssistantView } from "./organizer/organizer";
import FileOrganizer from "../..";
import { InboxLogs } from "./inbox-logs";
import { SectionHeader } from "./section-header";
import { AppContext } from "./provider";
import AIChatSidebar from "./ai-chat/container";
import { SyncTab } from "./synchronizer/sync-tab";
import { MeetingsTab } from "./meetings";
import { StyledContainer } from "../../components/ui/utils";
import { tw } from "../../lib/utils";
import { Sparkles, Inbox, MessageSquare, Cloud, Mic } from "lucide-react";
import { UpgradeButton } from "../../components/upgrade-button";
import { MarketingConsentPrompt } from "../../components/marketing-consent-prompt";
import { UsageData } from "../..";
import { Inbox as InboxService } from "../../inbox";
import { FREE_TIER_TOKEN_LIMIT } from "../../constants";

export const ORGANIZER_VIEW_TYPE = "fo2k.assistant.sidebar2";

type Tab = "organizer" | "inbox" | "chat" | "sync" | "meetings";

function TabContent({
  activeTab,
  plugin,
  leaf,
  showSyncTab,
  onTokenLimitError,
}: {
  activeTab: Tab;
  plugin: FileOrganizer;
  leaf: WorkspaceLeaf;
  showSyncTab: boolean;
  onTokenLimitError?: (error: string) => void;
}) {
  return (
    <div className={tw("flex flex-col h-full w-full")}>
      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "organizer" ? "block" : "hidden"
        )}
      >
        <AssistantView
          plugin={plugin}
          leaf={leaf}
          onTokenLimitError={onTokenLimitError}
        />
      </div>

      <div
        className={tw(
          "flex-1 min-h-0 w-full flex flex-col",
          activeTab === "inbox" ? "block" : "hidden"
        )}
      >
        <SectionHeader text="Inbox Processing" icon="📥 " />
        <InboxLogs />
      </div>

      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "chat" ? "flex flex-col" : "hidden"
        )}
      >
        <AIChatSidebar
          plugin={plugin}
          apiKey={plugin.settings.API_KEY}
          onTokenLimitError={onTokenLimitError}
          isChatTabActive={activeTab === "chat"}
        />
      </div>

      {showSyncTab && (
        <div
          className={tw(
            "flex-1 min-h-0 w-full",
            activeTab === "sync" ? "block" : "hidden"
          )}
        >
          <SyncTab plugin={plugin} onTokenLimitError={onTokenLimitError} />
        </div>
      )}

      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "meetings" ? "block" : "hidden"
        )}
      >
        <MeetingsTab plugin={plugin} />
      </div>
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  icon,
  children,
  badge,
}: {
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "px-4 py-2 text-sm transition-all relative flex items-center gap-2",
        isActive
          ? "text-[--text-normal] font-medium"
          : "text-[--text-muted] hover:text-[--text-normal]"
      )}
      style={
        isActive
          ? {
              borderBottom: "2px solid var(--interactive-accent)",
              marginBottom: "-1px",
            }
          : undefined
      }
    >
      {icon && <span className={tw("w-4 h-4 flex-shrink-0")}>{icon}</span>}
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className={tw(
            "ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[--interactive-accent] text-[--text-on-accent] font-medium min-w-[1.25rem] text-center"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AssistantContent({
  plugin,
  leaf,
  initialTab,
  onTabChange,
}: {
  plugin: FileOrganizer;
  leaf: WorkspaceLeaf;
  initialTab: Tab;
  onTabChange: (setTab: (tab: Tab) => void) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);
  const [usageData, setUsageData] = React.useState<UsageData | null>(null);
  const [forceShowUpgrade, setForceShowUpgrade] = React.useState(false);
  const [processingCount, setProcessingCount] = React.useState(0);

  React.useEffect(() => {
    onTabChange(setActiveTab);
  }, [onTabChange]);

  // Fetch usage data on mount
  React.useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await plugin.fetchUsageStats();
        if (data) {
          setUsageData(data);
        }
      } catch (error) {
        console.error("Failed to fetch usage data:", error);
      }
    };

    if (plugin.settings.API_KEY) {
      void fetchUsage();
    }
  }, [plugin]);

  // Track processing count for Inbox badge
  React.useEffect(() => {
    const updateProcessingCount = () => {
      try {
        const inbox = InboxService.getInstance();
        const analytics = inbox.getAnalytics();
        const activeCount =
          analytics.queueStats.processing + analytics.queueStats.queued;
        setProcessingCount(activeCount);
      } catch {
        // Silently handle errors (Inbox might not be initialized)
        setProcessingCount(0);
      }
    };

    updateProcessingCount();
    const interval = window.setInterval(updateProcessingCount, 500);

    // Listen to workspace events
    const handler = () => updateProcessingCount();
    plugin.app.workspace.on("file-organizer:processing-step", handler);

    return () => {
      window.clearInterval(interval);
      plugin.app.workspace.off("file-organizer:processing-step", handler);
    };
  }, [plugin]);

  // Helper function to check if upgrade button should be shown
  const shouldShowUpgradeButton = () => {
    // Force show if token limit error occurred
    if (forceShowUpgrade) return true;

    if (!usageData) return false;

    const isFreeTier =
      usageData.currentPlan === "Free Plan" ||
      usageData.currentPlan === "Free" ||
      usageData.maxTokenUsage === FREE_TIER_TOKEN_LIMIT;

    if (!isFreeTier) return false;

    const usagePercent = usageData.tokenUsage / usageData.maxTokenUsage;
    return usagePercent >= 0.8; // 80% threshold
  };

  // Handle token limit errors from child components; only show Upgrade for free tier (100K)
  const handleTokenLimitError = React.useCallback(
    (_error: string) => {
      plugin
        .fetchUsageStats()
        .then(data => {
          if (data) {
            setUsageData(data);
            if (data.maxTokenUsage === FREE_TIER_TOKEN_LIMIT) {
              setForceShowUpgrade(true);
            }
          }
        })
        .catch(console.error);
    },
    [plugin]
  );

  const showSyncTab = plugin.settings.showSyncTab;

  return (
    <div className={tw("flex flex-col h-full w-full")}>
      {/* Native tab navigation */}
      <div
        className={tw(
          "flex gap-0 px-3 pt-2 pb-0 border-b border-[--background-modifier-border] bg-[--background-primary] items-center justify-between"
        )}
      >
        <div className={tw("flex gap-0")}>
          <TabButton
            isActive={activeTab === "organizer"}
            onClick={() => setActiveTab("organizer")}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Organizer
          </TabButton>
          <TabButton
            isActive={activeTab === "inbox"}
            onClick={() => setActiveTab("inbox")}
            icon={<Inbox className="w-4 h-4" />}
            badge={processingCount}
          >
            Inbox
          </TabButton>
          <TabButton
            isActive={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
            icon={<MessageSquare className="w-4 h-4" />}
          >
            Chat
          </TabButton>
          <TabButton
            isActive={activeTab === "meetings"}
            onClick={() => setActiveTab("meetings")}
            icon={<Mic className="w-4 h-4" />}
          >
            Meetings
          </TabButton>
          {showSyncTab && (
            <TabButton
              isActive={activeTab === "sync"}
              onClick={() => setActiveTab("sync")}
              icon={<Cloud className="w-4 h-4" />}
            >
              Sync
            </TabButton>
          )}
        </div>

        {/* Upgrade button - visible when free tier user is at 80%+ usage or token limit error occurred */}
        {shouldShowUpgradeButton() && (
          <div className={tw("ml-auto")}>
            <UpgradeButton
              plugin={plugin}
              variant="compact"
              showMessage={true}
              usageData={usageData}
              isForced={forceShowUpgrade}
            />
          </div>
        )}
      </div>

      <MarketingConsentPrompt plugin={plugin} />

      {/* Content area - no padding */}
      <div className={tw("flex-1 min-h-0 w-full overflow-hidden")}>
        <TabContent
          activeTab={activeTab}
          plugin={plugin}
          leaf={leaf}
          showSyncTab={showSyncTab}
          onTokenLimitError={handleTokenLimitError}
        />
      </div>
    </div>
  );
}

export class AssistantViewWrapper extends ItemView {
  root: Root | null = null;
  plugin: FileOrganizer;
  private activeTab: Tab = "organizer";
  private setActiveTab: (tab: Tab) => void = () => {};

  constructor(leaf: WorkspaceLeaf, plugin: FileOrganizer) {
    super(leaf);
    this.plugin = plugin;

    // Register commands
    this.plugin.addCommand({
      id: "open-organizer-tab",
      name: "Open organizer tab",
      callback: () => this.activateTab("organizer"),
    });

    this.plugin.addCommand({
      id: "open-inbox-tab",
      name: "Open inbox tab",
      callback: () => this.activateTab("inbox"),
    });

    this.plugin.addCommand({
      id: "open-chat-tab",
      name: "Open chat tab",
      callback: () => this.activateTab("chat"),
    });

    this.plugin.addCommand({
      id: "open-meetings-tab",
      name: "Open meetings tab",
      callback: () => this.activateTab("meetings"),
    });

    // Only register sync tab command if enabled in settings
    if (this.plugin.settings.showSyncTab) {
      this.plugin.addCommand({
        id: "open-sync-tab",
        name: "Open sync tab",
        callback: () => this.activateTab("sync"),
      });
    }
  }

  activateTab(tab: Tab) {
    // Ensure view is open
    void this.plugin.app.workspace.revealLeaf(this.leaf);

    // Update tab
    this.activeTab = tab;
    this.setActiveTab(tab);
  }

  getViewType(): string {
    return ORGANIZER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Note companion";
  }

  getIcon(): string {
    return "sparkle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.addClass("fo2k-view");
    this.root = createRoot(container);
    this.render();
  }

  render(): void {
    this.root?.render(
      <AppContext.Provider value={{ plugin: this.plugin, root: this.root }}>
        <React.StrictMode>
          <StyledContainer>
            <AssistantContent
              plugin={this.plugin}
              leaf={this.leaf}
              initialTab={this.activeTab}
              onTabChange={setTab => {
                this.setActiveTab = setTab;
              }}
            />
          </StyledContainer>
        </React.StrictMode>
      </AppContext.Provider>
    );
  }

  async onClose(): Promise<void> {
    this.containerEl.children[1].removeClass("fo2k-view");
    this.root?.unmount();
  }
}
