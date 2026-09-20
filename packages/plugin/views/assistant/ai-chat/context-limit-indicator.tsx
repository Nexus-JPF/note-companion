import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { logger } from "../../../services/logger";
import { useContextItems } from "./use-context-items";
import {
  cleanup,
  getTokenCount,
  initializeTokenCounter,
} from "../../../utils/token-counter";

interface TokenStats {
  contextSize: number;
  percentUsed: number;
}

export function ContextLimitIndicator({
  unifiedContext,
  maxContextSize,
}: {
  unifiedContext: string;
  maxContextSize: number;
}) {
  const [stats, setStats] = React.useState<TokenStats>({
    contextSize: 0,
    percentUsed: 0,
  });
  const [error, setError] = React.useState<string>();
  const [counterReady, setCounterReady] = React.useState(false);
  const { isLightweightMode, toggleLightweightMode } = useContextItems();

  React.useEffect(() => {
    void initializeTokenCounter().then(() => setCounterReady(true));
    return () => cleanup();
  }, []);

  const calculateTokens = useDebouncedCallback((text: string) => {
    if (!text || !counterReady) return;

    try {
      const tokens = getTokenCount(text);
      logger.debug("tokens", { tokens });
      setStats({
        contextSize: tokens,
        percentUsed: (tokens / maxContextSize) * 100,
      });
    } catch {
      setError("Token counting failed");
    }
  }, 300);

  // Update tokens when context changes
  React.useEffect(() => {
    calculateTokens(unifiedContext);
  }, [unifiedContext, counterReady, calculateTokens]);

  if (error) {
    return (
      <div className="mt-2 p-2 rounded text-xs text-[--text-error] border border-[--text-error]">
        {error}
      </div>
    );
  }

  const isOverLimit = stats.contextSize > maxContextSize;
  const shouldWarn = stats.percentUsed > 80;

  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

  return (
    <div className="mt-2 space-y-2 flex">
      <div className="relative">
        <div
          className={`p-2 min-w-max rounded text-xs flex gap-1 items-center justify-between cursor-pointer hover:bg-[--background-modifier-hover] transition-colors
          ${
            isOverLimit
              ? "border border-[--text-error] text-[--text-error]"
              : shouldWarn
              ? "border border-[--text-warning] text-[--text-warning]"
              : "border border-[--background-modifier-border] text-[--text-muted]"
          }`}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          <span>
            {isOverLimit
              ? "Context size exceeds maximum"
              : shouldWarn
              ? "Context size nearing limit"
              : "Context used"}
          </span>
          <span className="font-mono">{stats.percentUsed.toFixed(0)}%</span>
        </div>

        {/* Enhanced menu-style tooltip - renders above, stays open on hover */}
        <div
          className={`absolute left-0 bottom-full mb-1 w-72 bg-[--background-secondary] border border-[--background-modifier-border] rounded-md shadow-lg transition-opacity z-20 ${
            isTooltipOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          <div
            onClick={toggleLightweightMode}
            className={`w-full px-4 py-3.5 text-left text-xs flex items-center gap-3 hover:bg-[--background-modifier-hover] cursor-pointer rounded-md
              ${
                isLightweightMode
                  ? "text-[--interactive-accent]"
                  : "text-[--text-normal]"
              }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
              ${
                isLightweightMode
                  ? "border-[--interactive-accent] bg-[--interactive-accent]"
                  : "border-[--text-muted] bg-[--background-primary]"
              }`}
            >
              {isLightweightMode && (
                <svg
                  className="w-3.5 h-3.5 text-[--text-on-accent]"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="font-medium">Disable Context</div>
              <div className="text-[--text-muted] text-[11px] leading-relaxed">
                Removes file content from context while preserving metadata.
                Useful for batch operations like moving, renaming, or tagging
                files.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
