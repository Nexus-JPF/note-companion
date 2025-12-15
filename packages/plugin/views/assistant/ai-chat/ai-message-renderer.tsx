import React from "react";
import { App, getLinkpath } from "obsidian";
import ReactMarkdown from "react-markdown";
import { usePlugin } from "../provider";

interface AIMarkdownProps {
  content: string;
  app: App;
}

export const AIMarkdown: React.FC<AIMarkdownProps> = ({ content, app }) => {
  const plugin = usePlugin();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Post-process content to convert note titles to Obsidian links
  const processedContent = React.useMemo(() => {
    // Get all markdown files from vault
    const allFiles = app.vault.getMarkdownFiles();
    const fileNames = new Set(allFiles.map(file => file.basename));

    let processed = content;

    // Skip processing if content already has Obsidian links (AI already formatted it)
    if (processed.includes("[[")) {
      return processed;
    }

    // Pattern 1: "Title: Note Name" -> "Title: [[Note Name]]"
    processed = processed.replace(
      /Title:\s*([^\n]+?)(?:\n|$|\.|,|;)/g,
      (match, title) => {
        const trimmedTitle = title.trim();
        // Remove trailing punctuation for matching
        const cleanTitle = trimmedTitle.replace(/[.,;:!?]+$/, "");
        if (fileNames.has(cleanTitle) && cleanTitle.length > 2) {
          const suffix = trimmedTitle.slice(cleanTitle.length);
          return `Title: [[${cleanTitle}]]${suffix}`;
        }
        return match;
      }
    );

    // Pattern 2: "I found a note related to 'Note Name'" or similar patterns
    processed = processed.replace(
      /(?:found|found a note|note related to|note titled|note called)[:\s]+['"]?([^'":\n]+?)['"]?(?:\s|$|\.|,|;)/gi,
      (match, title) => {
        const trimmedTitle = title.trim();
        const cleanTitle = trimmedTitle.replace(/[.,;:!?]+$/, "");
        if (fileNames.has(cleanTitle) && cleanTitle.length > 2) {
          return match.replace(trimmedTitle, `[[${cleanTitle}]]`);
        }
        return match;
      }
    );

    return processed;
  }, [content, app]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return;
      e.preventDefault();
      e.stopPropagation();

      // Try data-href first (Obsidian links), then href (markdown links)
      let linkpath =
        link.getAttribute("data-href") || link.getAttribute("href");

      if (!linkpath) return;

      // Handle markdown links that might have full URLs
      if (linkpath.startsWith("http://") || linkpath.startsWith("https://")) {
        window.open(linkpath, "_blank");
        return;
      }

      // Handle Obsidian-style links
      if (linkpath.startsWith("[[")) {
        linkpath = linkpath.replace(/^\[\[/, "").replace(/\]\]$/, "");
      }

      // Remove markdown file extension if present
      linkpath = linkpath.replace(/\.(md|markdown)$/, "");

      try {
        plugin.app.workspace.openLinkText(linkpath, "", true);
      } catch (error) {
        console.error("Error opening link:", error);
      }
    };

    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [plugin.app]);

  return (
    <div className="markdown-preview-view" ref={containerRef}>
      {processedContent.split(/(\[\[.*?\]\])/g).map((part, i) => {
        if (part.startsWith("[[") && part.endsWith("]]")) {
          const inner = part.slice(2, -2);
          const [target, alias] = inner.split("|");

          const linkpath = getLinkpath(target.trim());
          // get rid of extension if present for display text
          const displayText =
            alias?.trim() || target.trim().replace(/\.(md|markdown)$/, "");

          return (
            <a
              key={i}
              href={linkpath}
              className="internal-link text-[--text-accent] hover:text-[--text-accent-hover] underline cursor-pointer"
              data-href={linkpath}
              rel="noopener"
              aria-label={`Open note ${displayText}`}
            >
              {displayText}
            </a>
          );
        }

        return (
          <ReactMarkdown
            key={i}
            components={{
              a: ({ href, children, ...props }) => (
                <a
                  {...props}
                  href={href || ""}
                  className="text-[--text-accent] hover:text-[--text-accent-hover] underline cursor-pointer"
                >
                  {children}
                </a>
              ),
              code: ({ inline, children, ...props }) =>
                inline ? (
                  <code
                    {...props}
                    className="inline-code bg-[--background-modifier-form-field] px-1 py-0.5 rounded text-[--text-accent]"
                  >
                    {children}
                  </code>
                ) : (
                  <pre className="code-block bg-[--background-secondary] p-3 rounded border border-[--background-modifier-border] overflow-x-auto">
                    <code {...props}>{children}</code>
                  </pre>
                ),
              p: ({ children, ...props }) => (
                <p {...props} className="mb-2 last:mb-0 leading-relaxed">
                  {children}
                </p>
              ),
              strong: ({ children, ...props }) => (
                <strong
                  {...props}
                  className="font-semibold text-[--text-normal]"
                >
                  {children}
                </strong>
              ),
              em: ({ children, ...props }) => (
                <em {...props} className="italic">
                  {children}
                </em>
              ),
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};
