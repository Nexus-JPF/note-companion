import React, { useRef } from "react";
import { logger } from "../../../../services/logger";
import { ToolHandlerProps } from "./types";
import { usePlugin } from "../../provider";
import type {
  ScreenpipeSearchParams,
  ScreenpipeResult,
} from "../../../../services/screenpipe-client";

export function ScreenpipeHandler({
  toolInvocation,
  handleAddResult,
  app,
}: ToolHandlerProps) {
  const hasFetchedRef = useRef(false);
  const retryCountRef = useRef(0);
  const [status, setStatus] = React.useState<string>("Initializing ScreenPipe search...");
  const [error, setError] = React.useState<string | null>(null);
  const plugin = usePlugin();
  const pluginRef = useRef(plugin);
  
  // Keep plugin ref updated
  React.useEffect(() => {
    pluginRef.current = plugin;
  }, [plugin]);
  
  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log("[ScreenPipe Handler] Component mounted", {
      toolCallId: toolInvocation.toolCallId,
      toolName: toolInvocation.toolName,
      hasPlugin: !!plugin,
    });
  }, []);

  React.useEffect(() => {
    // CRITICAL: Check immediately if already executed - before any async operations
    if (hasFetchedRef.current) {
      console.log("[ScreenPipe Handler] Already executed, skipping useEffect");
      return;
    }
    
    // If result already exists, don't execute
    if ("result" in toolInvocation) {
      console.log("[ScreenPipe Handler] Result already exists, skipping");
      return;
    }
    
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const execute = async () => {
      // Double-check before executing
      if (hasFetchedRef.current || !isMounted) {
        console.log("[ScreenPipe Handler] Already executed or unmounted, skipping");
        return;
      }
      
      // Use plugin from ref to get latest value
      const currentPlugin = pluginRef.current;
      
      // Wait a bit for plugin context to be available if needed (max 10 retries = 1 second)
      if (!currentPlugin) {
        if (retryCountRef.current >= 10) {
          if (!isMounted || hasFetchedRef.current) return;
          const errorMsg = "Plugin context not available after retries";
          console.error("[ScreenPipe Handler]", errorMsg);
          hasFetchedRef.current = true; // Mark FIRST before any state updates
          setStatus("Error");
          setError(errorMsg);
          handleAddResult(JSON.stringify({ error: errorMsg }));
          return;
        }
        
        if (!isMounted || hasFetchedRef.current) return;
        retryCountRef.current += 1;
        console.log("[ScreenPipe Handler] Plugin not available yet, retrying...", retryCountRef.current);
        setStatus(`Waiting for plugin context... (${retryCountRef.current}/10)`);
        // Retry after a short delay
        timeoutId = setTimeout(() => {
          if (isMounted && !hasFetchedRef.current && retryCountRef.current < 10) {
            execute();
          }
        }, 100);
        return;
      }
      
      // Mark as executing IMMEDIATELY to prevent re-execution
      if (hasFetchedRef.current || !isMounted) return;
      hasFetchedRef.current = true;
      
      // Reset retry count if plugin is available
      retryCountRef.current = 0;
      
      if (!isMounted) return;
      setStatus("Checking settings...");
      
      logger.debug("ScreenPipe handler executing", {
        toolCallId: toolInvocation.toolCallId,
        toolName: toolInvocation.toolName,
        args: toolInvocation.args,
        hasPlugin: !!currentPlugin,
        enableScreenpipe: currentPlugin?.settings?.enableScreenpipe,
        fullToolInvocation: toolInvocation,
      });
      
      console.log("[ScreenPipe Handler] Starting execution", {
        toolCallId: toolInvocation.toolCallId,
        toolName: toolInvocation.toolName,
        args: toolInvocation.args,
        hasPlugin: !!currentPlugin,
        enableScreenpipe: currentPlugin?.settings?.enableScreenpipe,
      });

      try {
        // Check if plugin is available
        if (!currentPlugin) {
          const errorMsg = "Plugin context not available";
          logger.error("ScreenPipe handler:", errorMsg);
          setStatus("Error");
          setError(errorMsg);
          handleAddResult(JSON.stringify({ error: errorMsg }));
          return;
        }

        // Check if ScreenPipe is enabled
        if (!currentPlugin.settings.enableScreenpipe) {
          setStatus("ScreenPipe disabled");
          const errorMsg = "ScreenPipe integration is disabled. Enable it in Settings > Experiments > Integrations.";
          setError(errorMsg);
          logger.debug("ScreenPipe handler: Disabled, sending error result");
          handleAddResult(JSON.stringify({ error: errorMsg }));
          return;
        }

        setStatus("Loading ScreenPipe client...");
        const { ScreenpipeClient } = await import(
          "../../../../services/screenpipe-client"
        );
        const client = new ScreenpipeClient(currentPlugin.settings.screenpipeApiUrl);

        setStatus("Checking ScreenPipe connection...");
        // Check if ScreenPipe is available
        const isAvailable = await client.isAvailable();
        if (!isAvailable) {
          setStatus("ScreenPipe not available");
          const errorMsg = `ScreenPipe is not running. Please start ScreenPipe on ${currentPlugin.settings.screenpipeApiUrl}`;
          setError(errorMsg);
          logger.debug("ScreenPipe handler: Not available, sending error result");
          handleAddResult(JSON.stringify({ error: errorMsg }));
          return;
        }

        setStatus("Searching ScreenPipe...");
        // Execute search - normalize empty strings to undefined
        const rawArgs = toolInvocation.args as any;
        const normalizedArgs: ScreenpipeSearchParams = {
          q: rawArgs.q && rawArgs.q.trim() !== '' ? rawArgs.q : undefined,
          content_type: rawArgs.content_type && rawArgs.content_type !== '' ? rawArgs.content_type : undefined,
          limit: rawArgs.limit || 10,
          start_time: rawArgs.start_time && rawArgs.start_time.trim() !== '' ? rawArgs.start_time : undefined,
          end_time: rawArgs.end_time && rawArgs.end_time.trim() !== '' ? rawArgs.end_time : undefined,
          app_name: rawArgs.app_name && rawArgs.app_name.trim() !== '' ? rawArgs.app_name : undefined,
          window_name: rawArgs.window_name && rawArgs.window_name.trim() !== '' ? rawArgs.window_name : undefined,
        };
        logger.debug("ScreenPipe handler: Executing search with normalized args:", normalizedArgs);
        const results = await client.search(normalizedArgs);
        logger.debug("ScreenPipe handler: Search returned", results.length, "results");

        if (results.length === 0) {
          setStatus("No results found");
          logger.debug("ScreenPipe handler: No results, sending empty result");
          handleAddResult(
            JSON.stringify({
              message: "No results found in ScreenPipe for the given criteria.",
              results: [],
            })
          );
          return;
        }

        setStatus("Formatting results...");
        // Format results for AI
        const formattedResults = results.map((r: ScreenpipeResult) => ({
          type: r.type,
          timestamp: r.content.timestamp,
          app: r.content.app_name,
          window: r.content.window_name,
          text: r.content.text || r.content.transcription,
          preview:
            (r.content.text || r.content.transcription || "").substring(
              0,
              200
            ) + "...",
        }));

        setStatus("Complete");
        logger.debug("ScreenPipe handler: Sending formatted results:", formattedResults.length);
        handleAddResult(JSON.stringify(formattedResults));
      } catch (error) {
        logger.error("ScreenPipe search error:", error);
        setStatus("Error occurred");
        const errorMessage = error instanceof Error ? error.message : "Failed to search ScreenPipe";
        setError(errorMessage);
        // CRITICAL: Always call handleAddResult, even on error
        logger.debug("ScreenPipe handler: Sending error result:", errorMessage);
        handleAddResult(JSON.stringify({ error: errorMessage }));
      }
    };

    // Execute once
    execute();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [toolInvocation.toolCallId]); // Only depend on toolCallId to prevent re-execution

  const isComplete = "result" in toolInvocation;
  const result = toolInvocation.result;

  // Parse result to count results
  let resultCount = 0;
  if (isComplete && result) {
    try {
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      const parsed = JSON.parse(resultStr);
      const results = Array.isArray(parsed) ? parsed : parsed.data || [];
      resultCount = results.length;
    } catch (e) {
      // If parsing fails, try to use result directly
      resultCount = Array.isArray(result) ? result.length : 0;
    }
  }

  // Always render something visible - never return empty/null
  return (
    <div className="text-sm p-2">
      <div className="text-[--text-normal] mb-2 font-medium">
        {isComplete ? "✓ ScreenPipe search complete" : `⏳ ${status}`}
      </div>
      {error && (
        <div className="text-xs text-[--text-error] mt-2 p-2 bg-[--background-secondary] rounded border border-[--background-modifier-border]">
          <strong>Error:</strong> {error}
        </div>
      )}
      {isComplete && resultCount > 0 && (
        <div className="text-xs text-[--text-muted] mt-1">
          Found {resultCount} result{resultCount > 1 ? 's' : ''}
        </div>
      )}
      {isComplete && resultCount === 0 && !error && (
        <div className="text-xs text-[--text-muted] mt-1">
          No results found
        </div>
      )}
      {!isComplete && !error && (
        <div className="text-xs text-[--text-muted] mt-1 italic">
          {status || "Initializing..."}
        </div>
      )}
    </div>
  );
}
