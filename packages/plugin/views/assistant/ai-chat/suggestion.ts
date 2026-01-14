import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import MentionList from "./mentions";
import Fuse from "fuse.js";

const suggestion = {
  items: ({ query, editor }: { query: string; editor: any }) => {
    const allFiles = editor.storage.mention.files || [];
    const allTags = editor.storage.mention.tags || [];
    const allFolders = editor.storage.mention.folders || [];

    // Tiptap's suggestion plugin truncates the query at the first space
    // Check if we have a stored full query (with spaces) from onUpdate
    // Note: query may contain underscores (visual) but we search with spaces
    let searchQuery = query;
    if (editor?.storage?.mention?.fullQuery) {
      // Use the stored search query (with spaces converted from underscores)
      searchQuery = editor.storage.mention.fullQuery;
    } else {
      // Convert any underscores in the query to spaces for searching
      // This handles the case where user typed underscores directly
      searchQuery = query.replace(/_/g, " ");
    }

    // Create a normalized version of items (with spaces removed) for better matching
    // This helps when Tiptap stops parsing at the first space
    const allItems = [...allFiles, ...allTags.slice(0, 3), ...allFolders];

    // Add normalized versions (without spaces) to help match files with spaces
    const itemsWithNormalized = allItems.map(item => ({
      ...item,
      titleNormalized: item.title?.replace(/\s+/g, "") || "",
    }));

    // If searchQuery contains spaces, also try matching without spaces
    const queryWithoutSpaces = searchQuery.replace(/\s+/g, "");
    const searchQueries = searchQuery.includes(" ")
      ? [searchQuery, queryWithoutSpaces]
      : [searchQuery];

    const fuse = new Fuse(itemsWithNormalized, {
      keys: [
        { name: "title", weight: 1 },
        { name: "titleNormalized", weight: 0.8 }, // Lower weight for normalized matches
      ],
      threshold: 0.4, // Slightly more lenient threshold to handle partial matches
      includeScore: true,
    });

    // Search with all query variations and combine results, avoiding duplicates
    // Use a Map to deduplicate by item path/title/id
    const allResults = new Map();
    searchQueries.forEach(q => {
      fuse.search(q).forEach(result => {
        const item = result.item;
        const key = item.path || item.title || item.id;
        // Create clean item without normalized field
        const cleanItem = { ...item };
        delete cleanItem.titleNormalized;

        // Only add if not already present, or if this result has a better score
        const existing = allResults.get(key);
        if (!existing || existing.score > result.score) {
          allResults.set(key, {
            item: cleanItem,
            score: result.score || 0,
          });
        }
      });
    });

    // Sort by score and return top 10, removing the score wrapper
    return Array.from(allResults.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map(result => result.item);
  },

  render: () => {
    let reactRenderer: ReactRenderer;
    let popup: any[];
    let tiptapEditorInstance: any; // Store the Tiptap Editor instance

    return {
      onStart: (props: any) => {
        if (!props.clientRect) {
          return;
        }

        // Store the Tiptap Editor instance (available in onStart)
        tiptapEditorInstance = props.editor;

        reactRenderer = new ReactRenderer(MentionList, {
          props,
          editor: props.editor, // This is the Tiptap Editor instance in items(), but ProseMirror view in onKeyDown
        });

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: any) {
        // Store the full query including spaces in editor storage
        // Tiptap's suggestion plugin truncates the query at the first space
        // We'll extract the full query and store it for use in items()
        if (props.range && props.editor) {
          try {
            const { state } = props.editor;
            const { from } = props.range;
            const textAfterTrigger = state.doc.textBetween(
              from,
              state.selection.$from.pos
            );

            // Convert underscores to spaces for searching
            const searchQuery = textAfterTrigger.replace(/_/g, " ");

            // Always store the full query if it's different from props.query
            // This handles cases where Tiptap truncates at spaces
            if (searchQuery !== props.query) {
              if (!props.editor.storage.mention) {
                props.editor.storage.mention = {};
              }
              // Store search query (with spaces) and visual query (with underscores)
              props.editor.storage.mention.fullQuery = searchQuery;
              props.editor.storage.mention.visualQuery = textAfterTrigger;

              // Update props.query to the search query (with spaces) so items() gets it
              props.query = searchQuery;
            } else if (props.editor.storage.mention) {
              // Clear stored query if it matches (no spaces or already correct)
              props.editor.storage.mention.fullQuery = null;
              props.editor.storage.mention.visualQuery = null;
            }
          } catch (error) {
            // Ignore errors in query extraction
          }
        }

        reactRenderer.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        // Debug: log all key presses
        console.log(
          "[Mention] onKeyDown called, key:",
          props.event.key,
          "code:",
          props.event.code
        );

        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }

        // Allow spaces in the query - prevent the suggestion from closing
        // This enables typing file names with spaces
        // Check both key and code for space
        if (props.event.key === " " || props.event.code === "Space") {
          console.log(
            "[Mention] Space detected, preventing default and inserting underscore"
          );
          // Prevent default to stop Tiptap from closing the suggestion
          props.event.preventDefault();
          props.event.stopPropagation();
          props.event.stopImmediatePropagation();

          // In suggestion plugin's onKeyDown, props.editor is the Tiptap Editor instance
          const tiptapEditor = props.editor || tiptapEditorInstance;
          if (!tiptapEditor) {
            console.warn("[Mention] No Tiptap editor available");
            return false;
          }

          // Try using Tiptap's chain API first (preferred method)
          let inserted = false;
          if (tiptapEditor.chain) {
            try {
              console.log(
                "[Mention] Attempting to insert underscore via Tiptap chain API"
              );
              const result = tiptapEditor
                .chain()
                .focus()
                .insertContent("_")
                .run();
              if (result !== false) {
                inserted = true;
                console.log("[Mention] ✅ Underscore inserted via chain API");
              } else {
                console.warn("[Mention] Chain API returned false");
              }
            } catch (error) {
              console.warn("[Mention] Chain API error:", error);
            }
          }

          // Fallback to ProseMirror transaction if chain API didn't work
          if (!inserted) {
            const view = (tiptapEditor as any).view;
            if (view && view.state && view.dispatch) {
              try {
                const { state, dispatch } = view;
                const { $from } = state.selection;
                const pos = $from.pos;

                console.log(
                  "[Mention] Attempting to insert underscore via transaction at pos:",
                  pos
                );

                // Create transaction to insert underscore
                const tr = state.tr.insertText("_", pos);

                // Dispatch the transaction
                dispatch(tr);

                inserted = true;
                console.log("[Mention] ✅ Underscore inserted via transaction");
              } catch (error) {
                console.warn("[Mention] Transaction error:", error);
              }
            } else {
              console.warn("[Mention] No view/state/dispatch available", {
                hasEditor: !!tiptapEditor,
                hasView: !!view,
                hasState: !!view?.state,
                hasDispatch: !!view?.dispatch,
                hasChain: !!(tiptapEditor as any).chain,
              });
            }
          }

          if (!inserted) {
            console.warn("[Mention] Could not insert underscore");
            return false;
          }

          // Get the view for query extraction (after insertion)
          const view = (tiptapEditor as any).view;
          if (!view || !view.state) {
            return true; // Still prevent default even if we can't extract query
          }

          try {
            const { state } = view;

            // Update the query after insertion
            // Use requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
              try {
                if (!props.range) return;

                // Get the updated state after insertion
                const newState = view.state;
                const { from } = props.range;
                let textAfterTrigger = newState.doc.textBetween(
                  from,
                  newState.selection.$from.pos
                );

                console.log("[Mention] Text after trigger:", textAfterTrigger);

                // Convert underscores back to spaces for searching
                // This way the user sees underscores but we search with spaces
                const searchQuery = textAfterTrigger.replace(/_/g, " ");

                // Store the search query (with spaces) for items() to use
                if (tiptapEditor && tiptapEditor.storage) {
                  if (!tiptapEditor.storage.mention) {
                    tiptapEditor.storage.mention = {};
                  }
                  // Store both: the visual query (with underscores) and search query (with spaces)
                  tiptapEditor.storage.mention.fullQuery = searchQuery; // For searching
                  tiptapEditor.storage.mention.visualQuery = textAfterTrigger; // For display

                  console.log("[Mention] Stored fullQuery:", searchQuery);
                }

                // Force update the suggestion by triggering onUpdate
                if (reactRenderer) {
                  const updatedProps = {
                    ...props,
                    query: searchQuery, // Pass the search query (with spaces)
                    range: {
                      ...props.range,
                      from: props.range.from,
                      to: newState.selection.$from.pos,
                    },
                  };
                  reactRenderer.updateProps(updatedProps);
                  console.log(
                    "[Mention] Updated suggestion props with query:",
                    searchQuery
                  );
                }
              } catch (error) {
                console.warn(
                  "[Mention] Error updating query with space:",
                  error
                );
              }
            });
          } catch (error) {
            console.error("[Mention] Failed to insert underscore:", error);
            return false; // Can't insert, allow default
          }

          // Return true to prevent default behavior (closing suggestion)
          return true;
        }

        return reactRenderer.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        reactRenderer.destroy();
      },

      command: (props: any, item: any) => {
        return props.command({
          ...item,
          type: item.type,
          id: item.id || item.title,
          label: item.label || item.title,
          path: item.path,
        });
      },
    };
  },
};

export default suggestion;
