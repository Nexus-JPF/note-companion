import React, { useRef, useState } from "react";
import { logger } from "../../../../services/logger";
import { usePlugin } from "../../provider";
import { ToolInvocation } from "./types";
import { readResponseJson } from "../../../../lib/api-json";
import { obsidianFetch } from "../../../../lib/obsidian-fetch";

interface UrlFetchHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
}

export function UrlFetchHandler({
  toolInvocation,
  handleAddResult,
}: UrlFetchHandlerProps) {
  const plugin = usePlugin();
  const hasFetchedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  React.useEffect(() => {
    const run = async () => {
      if (hasFetchedRef.current || "result" in toolInvocation) {
        if ("result" in toolInvocation) {
          setStatus("success");
        }
        return;
      }
      hasFetchedRef.current = true;

      let url = (toolInvocation.args as { url?: string }).url;
      if (url && typeof (url as { then?: unknown }).then === "function") {
        handleAddResult(
          JSON.stringify({
            error: "Invalid url: received a Promise instead of a string",
          })
        );
        setStatus("error");
        return;
      }

      if (!url || typeof url !== "string") {
        handleAddResult(
          JSON.stringify({
            error: "url is required and must be a string",
          })
        );
        setStatus("error");
        return;
      }

      url = url.trim();
      if (!url) {
        handleAddResult(
          JSON.stringify({ error: "url cannot be empty" })
        );
        setStatus("error");
        return;
      }

      try {
        const apiKey = plugin.getApiKey()?.trim();
        if (!apiKey) {
          handleAddResult(
            JSON.stringify({
              error: "API key is missing; cannot fetch URL",
            })
          );
          setStatus("error");
          return;
        }

        const response = await obsidianFetch(
          `${plugin.getServerUrl()}/api/fetch-url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ url }),
          }
        );

        const data = await readResponseJson<{
          title?: string;
          content?: string;
          url?: string;
          error?: string;
        }>(response);

        if (!response.ok) {
          const msg =
            data.error ||
            `Request failed with status ${response.status}`;
          handleAddResult(JSON.stringify({ error: msg }));
          setStatus("error");
          return;
        }

        if (!data.content || typeof data.content !== "string") {
          handleAddResult(
            JSON.stringify({
              error: "Server returned no page content",
            })
          );
          setStatus("error");
          return;
        }

        const titleLine = data.title
          ? `Page title: ${data.title}\n`
          : "";
        const sourceLine = data.url ? `Source URL: ${data.url}\n\n` : "";

        const toolResult = `${titleLine}${sourceLine}Page content (plain text):\n\n${data.content}\n\nUse the content above to answer the user's question or provide the summary they asked for.`;

        handleAddResult(toolResult);
        setStatus("success");
      } catch (error) {
        logger.error("fetchUrlContent error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        handleAddResult(JSON.stringify({ error: message }));
        setStatus("error");
      }
    };

    void run();
  }, [toolInvocation.toolCallId]);

  if (status === "loading") {
    return (
      <div className="text-sm text-[--text-muted]">Fetching page content…</div>
    );
  }
  if (status === "success") {
    return (
      <div className="text-sm text-[--text-muted]">
        Page content retrieved
      </div>
    );
  }
  return (
    <div className="text-sm text-[--text-error]">
      Failed to fetch page content
    </div>
  );
}
