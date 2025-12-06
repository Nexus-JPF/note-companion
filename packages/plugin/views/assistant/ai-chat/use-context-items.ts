import { create } from "zustand";
import { App, TFile } from "obsidian";
import { Vault } from "obsidian";

// Base types
interface BaseContextItem {
  id: string;
  reference: string;
  createdAt: number;
  ephemeral?: boolean; // If true, context is cleared after next AI message
}

// Specific item types
interface FileContextItem extends BaseContextItem {
  type: "file";
  path: string;
  title: string;
  content: string;
}

interface ProcessedFile {
  path: string;
  content: string;
}

interface FolderContextItem extends BaseContextItem {
  type: "folder";
  path: string;
  name: string;
  files: ProcessedFile[];
}

interface YouTubeContextItem extends BaseContextItem {
  type: "youtube";
  videoId: string;
  title: string;
  transcript: string;
}

interface TagContextItem extends BaseContextItem {
  type: "tag";
  name: string;
  files: ProcessedFile[];
}



// Add new search result type (reference-based, no full content)
interface SearchContextItem extends BaseContextItem {
  type: "search";
  query: string;
  resultCount: number;
  results: Array<{
    path: string;
    title: string;
    contentPreview: string; // Only preview, not full content
    contentLength: number;
    wordCount: number;
  }>;
}

// Add new type for text selection
interface TextSelectionContextItem extends BaseContextItem {
  type: "text-selection";
  content: string;
  sourceFile?: string;
}

type ContextCollections = {
  files: Record<string, FileContextItem>;
  folders: Record<string, FolderContextItem>;
  youtubeVideos: Record<string, YouTubeContextItem>;
  tags: Record<string, TagContextItem>;

  searchResults: Record<string, SearchContextItem>;
  textSelections: Record<string, TextSelectionContextItem>;
};

interface ContextItemsState extends ContextCollections {
  currentFile: FileContextItem | null;
  includeCurrentFile: boolean;
  isLightweightMode: boolean;

  // Actions for each type
  addFile: (file: FileContextItem) => void;
  addFolder: (folder: FolderContextItem) => void;
  addYouTubeVideo: (video: YouTubeContextItem) => void;
  addTag: (tag: TagContextItem) => void;

  addSearchResults: (search: SearchContextItem) => void;
  addTextSelection: (selection: TextSelectionContextItem) => void;

  // Generic actions
  removeItem: (type: ContextItemType, id: string) => void;
  setCurrentFile: (file: FileContextItem | null) => void;
  toggleCurrentFile: () => void;
  clearAll: () => void;
  clearEphemeral: () => void; // Clear all ephemeral context items
  toggleLightweightMode: () => void;

  // Processing methods
  processFolderFiles: (
    app: App,
    folderPath: string
  ) => Promise<ProcessedFile[]>;
  processTaggedFiles: (app: App, tagName: string) => Promise<ProcessedFile[]>;

  // Helper function to check and remove existing items with same reference
  removeByReference: (reference: string) => void;
}

export const useContextItems = create<ContextItemsState>((set, get) => ({
  // Initial state
  files: {},
  folders: {},
  youtubeVideos: {},
  tags: {},
  searchResults: {},
  textSelections: {},
  currentFile: null,
  includeCurrentFile: true,
  isLightweightMode: false,

  // Add toggle function
  toggleLightweightMode: () => set(state => ({ isLightweightMode: !state.isLightweightMode })),

  // Update addFile to handle lightweight mode
  addFile: file =>
    set(state => {
      const existingItemIndex = Object.values(state.files).findIndex(
        item => item.reference === file.reference
      );

      const lightweightFile = state.isLightweightMode ? {
        ...file,
        content: '', // Remove content in lightweight mode
      } : file;

      if (existingItemIndex !== -1) {
        return {
          files: {
            ...state.files,
            [file.id]: { ...lightweightFile, createdAt: Date.now() },
          },
        };
      }

      return {
        files: { ...state.files, [file.id]: lightweightFile },
      };
    }),

  // Update addFolder to handle lightweight mode
  addFolder: folder =>
    set(state => {
      const existingItemIndex = Object.values(state.folders).findIndex(
        item => item.reference === folder.reference
      );

      const lightweightFolder = state.isLightweightMode ? {
        ...folder,
        files: folder.files.map(f => ({ ...f, content: '' })), // Remove content in lightweight mode
      } : folder;

      if (existingItemIndex !== -1) {
        return {
          folders: {
            ...state.folders,
            [folder.id]: { ...lightweightFolder, createdAt: Date.now() },
          },
        };
      }

      return {
        folders: { ...state.folders, [folder.id]: lightweightFolder },
      };
    }),

  // Add YouTube video without lightweight mode
  addYouTubeVideo: video =>
    set(state => ({
      youtubeVideos: { ...state.youtubeVideos, [video.id]: video },
    })),



  // Update addTag to handle lightweight mode
  addTag: tag =>
    set(state => {
      const lightweightTag = state.isLightweightMode ? {
        ...tag,
        files: tag.files.map(f => ({ ...f, content: '' })), // Remove content in lightweight mode
      } : tag;

      return {
        tags: { ...state.tags, [tag.id]: lightweightTag },
      };
    }),

  // Update addSearchResults to handle lightweight mode
  addSearchResults: search =>
    set(state => {
      const lightweightSearch = state.isLightweightMode ? {
        ...search,
        results: search.results.map(r => ({ ...r, content: '' })), // Remove content in lightweight mode
      } : search;

      return {
        searchResults: { ...state.searchResults, [search.id]: lightweightSearch },
      };
    }),

  // Add text selection without lightweight mode
  addTextSelection: selection =>
    set(state => {
      const reference = selection.reference;
      get().removeByReference(reference);

      return {
        textSelections: {
          ...state.textSelections,
          [selection.id]: selection
        },
      };
    }),

  // Remove action
  removeItem: (type, id) =>
    set(state => {
      const collectionMap: Record<ContextItemType, keyof ContextCollections> = {
        file: "files",
        folder: "folders",
        youtube: "youtubeVideos",
        tag: "tags",

        search: "searchResults",
        "text-selection": "textSelections",
      };

      const collectionKey = collectionMap[type];
      const collection = { ...state[collectionKey] };
      delete collection[id];

      return { [collectionKey]: collection } as Partial<ContextCollections>;
    }),

  setCurrentFile: file =>
    set({ currentFile: file ? { ...file, reference: "Current File", type: "file" } : null }),

  toggleCurrentFile: () =>
    set(state => ({
      currentFile: null,
    })),

  clearAll: () =>
    set({
      files: {},
      folders: {},
      youtubeVideos: {},
      tags: {},
      searchResults: {},
      textSelections: {},
      includeCurrentFile: false,
      currentFile: null,
    }),

  // Clear only ephemeral context items
  clearEphemeral: () =>
    set(state => ({
      files: Object.fromEntries(
        Object.entries(state.files).filter(([_, item]) => !item.ephemeral)
      ),
      folders: Object.fromEntries(
        Object.entries(state.folders).filter(([_, item]) => !item.ephemeral)
      ),
      youtubeVideos: Object.fromEntries(
        Object.entries(state.youtubeVideos).filter(([_, item]) => !item.ephemeral)
      ),
      tags: Object.fromEntries(
        Object.entries(state.tags).filter(([_, item]) => !item.ephemeral)
      ),
      searchResults: Object.fromEntries(
        Object.entries(state.searchResults).filter(([_, item]) => !item.ephemeral)
      ),
      textSelections: Object.fromEntries(
        Object.entries(state.textSelections).filter(([_, item]) => !item.ephemeral)
      ),
    })),

  // Add new processing methods
  processFolderFiles: async (app, folderPath) => {
    const folderRef = app.vault.getFolderByPath(folderPath);
    if (!folderRef) return [];

    const files: TFile[] = [];
    Vault.recurseChildren(folderRef, file => {
      if (file instanceof TFile) {
        files.push(file);
      }
    });

    return Promise.all(
      files.map(async file => ({
        path: file.path,
        content: await app.vault.cachedRead(file),
      }))
    );
  },

  processTaggedFiles: async (app, tagName) => {
    const taggedFiles = app.vault.getFiles().filter(file => {
      const cache = app.metadataCache.getFileCache(file);
      return cache?.tags?.some(t => t.tag === `#${tagName}`);
    });

    return Promise.all(
      taggedFiles.map(async file => ({
        path: file.path,
        content: await app.vault.cachedRead(file),
      }))
    );
  },

  // Helper function to check and remove existing items with same reference
  removeByReference: (reference: string) =>
    set(state => {
      const collections: (keyof ContextCollections)[] = [
        "files",
        "folders",
        "youtubeVideos",
        "tags",

        "searchResults",
        "textSelections",
      ];

      const newState = { ...state };

      collections.forEach(collection => {
        const items = state[collection];
        Object.entries(items).forEach(([id, item]) => {
          if (item.reference === reference) {
            delete newState[collection][id];
          }
        });
      });

      return newState;
    }),
}));

// Updated helper functions
export const addFileContext = (file: {
  path: string;
  title: string;
  content: string;
  ephemeral?: boolean; // Optional ephemeral flag
}) => {
  const store = useContextItems.getState();
  const reference = `File: ${file.path}`;

  // Remove any existing items with same reference first
  store.removeByReference(reference);

  store.addFile({
    id: file.path,
    type: "file",
    path: file.path,
    title: file.title,
    content: file.content,
    reference,
    createdAt: Date.now(),
    ephemeral: file.ephemeral,
  });
};

// New helper: Add file reference WITHOUT full content (metadata-only, ephemeral)
export const addFileReference = (file: {
  path: string;
  title: string;
  contentPreview?: string;
  contentLength?: number;
  wordCount?: number;
  modified?: number;
  modifiedDate?: string;
}) => {
  const store = useContextItems.getState();
  const reference = `File: ${file.path}`;

  // Remove any existing items with same reference first
  store.removeByReference(reference);

  // Store metadata only, mark as ephemeral
  store.addFile({
    id: file.path,
    type: "file",
    path: file.path,
    title: file.title,
    content: file.contentPreview || "", // Only preview stored
    reference,
    createdAt: Date.now(),
    ephemeral: true, // Always ephemeral for references
  });
};

export const addYouTubeContext = (video: {
  videoId: string;
  title: string;
  transcript: string;
}) => {
  console.log("[addYouTubeContext] Adding video to store:", {
    videoId: video.videoId,
    title: video.title,
    transcriptLength: video.transcript.length,
  });

  const store = useContextItems.getState();
  console.log("[addYouTubeContext] Store state before add:", {
    hasYoutubeVideos: !!store.youtubeVideos,
    youtubeVideosType: typeof store.youtubeVideos,
    youtubeVideosKeys: store.youtubeVideos ? Object.keys(store.youtubeVideos) : [],
  });

  store.addYouTubeVideo({
    id: `youtube-${video.videoId}`,
    type: "youtube",
    videoId: video.videoId,
    title: video.title,
    transcript: video.transcript,
    reference: `YouTube Video: ${video.title}`,
    createdAt: Date.now(),
    ephemeral: false, // CRITICAL: Explicitly set to false so it's NOT cleared by clearEphemeral
  });

  // Verify it was added
  const storeAfter = useContextItems.getState();
  const addedVideo = storeAfter.youtubeVideos?.[`youtube-${video.videoId}`];
  console.log("[addYouTubeContext] Store state after add:", {
    hasYoutubeVideos: !!storeAfter.youtubeVideos,
    youtubeVideosKeys: storeAfter.youtubeVideos ? Object.keys(storeAfter.youtubeVideos) : [],
    videoAdded: !!addedVideo,
    videoId: addedVideo?.videoId,
  });
};

export const addFolderContext = async (
  folderPath: string,
  app: App
): Promise<void> => {
  const store = useContextItems.getState();
  const files = await store.processFolderFiles(app, folderPath);
  const reference = `Folder: ${folderPath}`;

  // Remove any existing items with same reference first
  store.removeByReference(reference);

  store.addFolder({
    id: folderPath,
    type: "folder",
    path: folderPath,
    name: folderPath.split("/").pop() || folderPath,
    reference,
    createdAt: Date.now(),
    files,
  });
};

export const addTagContext = async (
  tagName: string,
  app: App
): Promise<void> => {
  const store = useContextItems.getState();
  const files = await store.processTaggedFiles(app, tagName);

  store.addTag({
    id: `tag-${tagName}`,
    type: "tag",
    name: tagName,
    reference: `Tag: ${tagName}`,
    createdAt: Date.now(),
    files, // Store processed files with the tag
  });
};



export const addSearchContext = (
  query: string,
  results: Array<{
    path: string;
    title: string;
    contentPreview: string;
    contentLength: number;
    wordCount: number;
  }>
) => {
  useContextItems.getState().addSearchResults({
    id: `search-${Date.now()}`,
    type: "search",
    query,
    resultCount: results.length,
    results,
    reference: `Search: "${query}"`,
    createdAt: Date.now(),
    ephemeral: true, // Search results are ephemeral - cleared after next message
  });
};

export const addTextSelectionContext = (params: {
  content: string;
  sourceFile?: string;
}) => {
  const store = useContextItems.getState();
  const reference = `Selection: ${params.content.slice(0, 30)}...`;

  store.addTextSelection({
    id: `text-selection-${Date.now()}`,
    type: "text-selection",
    content: params.content,
    sourceFile: params.sourceFile,
    reference,
    createdAt: Date.now(),
  });
};

// Add export for types
export type ContextItemType =
  | "file"
  | "folder"
  | "youtube"
  | "tag"

  | "search"
  | "text-selection";
export type {
  FileContextItem,
  FolderContextItem,
  YouTubeContextItem,
  TagContextItem,

  BaseContextItem,
  SearchContextItem,
  ProcessedFile,
  TextSelectionContextItem,
};

// Export helper to clear ephemeral context
export const clearEphemeralContext = () => {
  useContextItems.getState().clearEphemeral();
};

// Add this helper function
export const getUniqueReferences = () => {
  const store = useContextItems.getState();
  const collections = {
    files: store.files,
    folders: store.folders,
    youtubeVideos: store.youtubeVideos,
    tags: store.tags,

    searchResults: store.searchResults,
    textSelections: store.textSelections,
  };

  const references = new Set<string>();

  Object.values(collections).forEach(collection => {
    Object.values(collection).forEach(item => {
      references.add(item.reference);
    });
  });
  const referencesArray = Array.from(references);
  if (store.currentFile) {
    referencesArray.push(store.currentFile.reference);
  }
  return referencesArray;
};
