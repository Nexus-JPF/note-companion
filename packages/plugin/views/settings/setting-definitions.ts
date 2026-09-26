import type FileOrganizer from '../../index';

/**
 * Obsidian 1.13+ declarative settings shape.
 * Types ship in Obsidian 1.13; defined locally until obsidian package types catch up.
 */
type SettingControl = {
  type: string;
  key: string;
  [option: string]: unknown;
};

export type NoteCompanionSettingDefinition = {
  name: string;
  desc?: string;
  aliases?: string[];
  control?: SettingControl;
  visible?: () => boolean;
  type?: 'group' | 'page' | 'list';
  heading?: string;
  items?: NoteCompanionSettingDefinition[];
};

export function getNoteCompanionSettingDefinitions(
  plugin: FileOrganizer
): NoteCompanionSettingDefinition[] {
  const settings = plugin.settings;

  return [
    {
      type: 'page',
      name: 'General',
      desc: 'License key, usage, and chat options.',
      items: [
        {
          name: 'License key',
          desc: 'Your Note Companion API key for cloud features.',
          aliases: ['API key', 'subscription key'],
          control: { type: 'text', key: 'API_KEY', placeholder: 'Enter license key' },
        },
        {
          name: 'Enable chat web search',
          desc: 'Allow the AI chat to search the web for current information.',
          control: { type: 'toggle', key: 'enableChatWebSearch' },
        },
      ],
    },
    {
      type: 'page',
      name: 'Organization Preferences',
      desc: 'Inbox processing, tagging, renaming, and formatting.',
      items: [
        {
          type: 'group',
          heading: 'Inbox processing',
          items: [
            {
              name: 'Use inbox',
              desc: 'Automatically process files dropped into or created in the inbox folder. Turn off to only process files when you run "Process inbox now".',
              control: { type: 'toggle', key: 'useInbox' },
            },
            {
              name: 'Process attachments through inbox',
              control: { type: 'toggle', key: 'enableAttachmentProcessing' },
            },
            {
              name: 'Generate AI description for images',
              visible: () => settings.enableAttachmentProcessing,
              control: { type: 'toggle', key: 'enableImageDescription' },
            },
            {
              name: 'Automatically transcribe audio files',
              visible: () => settings.enableAttachmentProcessing,
              control: { type: 'toggle', key: 'enableAudioTranscription' },
            },
            {
              name: 'Extract text from PDF files',
              visible: () => settings.enableAttachmentProcessing,
              control: { type: 'toggle', key: 'enablePdfTextExtraction' },
            },
            {
              name: 'Automatically fetch YouTube transcripts',
              control: { type: 'toggle', key: 'enableYouTubeTranscriptFetching' },
            },
            {
              name: 'Automatically move files to recommended folders',
              control: { type: 'toggle', key: 'enableFolderRecommendation' },
            },
            {
              name: 'Inbox auto-renaming',
              control: { type: 'toggle', key: 'enableFileRenaming' },
            },
            {
              name: 'Inbox auto-formatting',
              control: { type: 'toggle', key: 'enableDocumentClassification' },
            },
            {
              name: 'Inbox similar tags',
              control: { type: 'toggle', key: 'useSimilarTags' },
            },
            {
              name: 'Inbox notification level',
              control: {
                type: 'dropdown',
                key: 'inboxNotificationLevel',
                defaultValue: 'warning',
                options: {
                  silent: 'Silent',
                  error: 'Errors only',
                  warning: 'Warnings',
                  info: 'Info',
                  debug: 'Debug',
                },
              },
            },
          ],
        },
        {
          type: 'group',
          heading: 'Tags and titles',
          items: [
            {
              name: 'Use similar tags in frontmatter',
              control: { type: 'toggle', key: 'useSimilarTagsInFrontmatter' },
            },
            {
              name: 'Use vault titles',
              control: { type: 'toggle', key: 'useVaultTitles' },
            },
            {
              name: 'Custom tag instructions',
              control: {
                type: 'textarea',
                key: 'customTagInstructions',
                rows: 3,
              },
            },
            {
              name: 'Rename instructions',
              control: {
                type: 'textarea',
                key: 'renameInstructions',
                rows: 3,
              },
            },
            {
              name: 'Custom folder instructions',
              control: {
                type: 'textarea',
                key: 'customFolderInstructions',
                rows: 3,
              },
            },
            {
              name: 'Image instructions',
              control: {
                type: 'textarea',
                key: 'imageInstructions',
                rows: 3,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'page',
      name: 'Vault Access',
      desc: 'Inbox, output folders, templates, and ignored paths.',
      items: [
        {
          name: 'Inbox folder',
          aliases: ['path to watch', 'watch folder'],
          control: { type: 'folder', key: 'pathToWatch' },
        },
        {
          name: 'Default destination folder',
          control: { type: 'folder', key: 'defaultDestinationPath' },
        },
        {
          name: 'Attachments folder',
          control: { type: 'folder', key: 'attachmentsPath' },
        },
        {
          name: 'Log folder',
          control: { type: 'folder', key: 'logFolderPath' },
        },
        {
          name: 'Backup folder',
          control: { type: 'folder', key: 'backupFolderPath' },
        },
        {
          name: 'Template folder',
          control: { type: 'folder', key: 'templatePaths' },
        },
        {
          name: 'Bypassed files folder',
          control: { type: 'folder', key: 'bypassedFilePath' },
        },
        {
          name: 'Error files folder',
          control: { type: 'folder', key: 'errorFilePath' },
        },
        {
          name: 'Recordings folder',
          control: { type: 'folder', key: 'recordingsFolderPath' },
        },
        {
          name: 'Sync folder',
          control: { type: 'folder', key: 'syncFolderPath' },
        },
      ],
    },
    {
      type: 'page',
      name: 'Experiment',
      desc: 'Experimental features and chat limits.',
      items: [
        {
          name: 'Enable atomic notes',
          control: { type: 'toggle', key: 'enableAtomicNotes' },
        },
        {
          name: 'Show local LLM in chat',
          control: { type: 'toggle', key: 'showLocalLLMInChat' },
        },
        {
          name: 'Enable title suggestions',
          control: { type: 'toggle', key: 'enableTitleSuggestions' },
        },
        {
          name: 'Show sync tab',
          control: { type: 'toggle', key: 'showSyncTab' },
        },
        {
          name: 'Chat tool rounds',
          desc: 'Maximum AI tool steps per chat turn. Configure in the full settings UI.',
          aliases: ['max steps', 'chat steps'],
        },
        {
          name: 'Enable ScreenPipe integration',
          control: { type: 'toggle', key: 'enableScreenpipe' },
        },
        {
          name: 'ScreenPipe API URL',
          visible: () => settings.enableScreenpipe,
          control: {
            type: 'text',
            key: 'screenpipeApiUrl',
            placeholder: 'http://localhost:3030',
          },
        },
        {
          name: 'ScreenPipe time range (hours)',
          visible: () => settings.enableScreenpipe,
          control: {
            type: 'number',
            key: 'screenpipeTimeRange',
            min: 1,
            max: 24,
          },
        },
        {
          name: 'ScreenPipe query limit',
          visible: () => settings.enableScreenpipe,
          control: {
            type: 'number',
            key: 'queryScreenpipeLimit',
            min: 1,
            max: 100,
          },
        },
      ],
    },
    {
      type: 'page',
      name: 'Advanced',
      desc: 'Self-hosting, logging, debug mode, and limits.',
      items: [
        {
          name: 'Create backup before formatting',
          control: { type: 'toggle', key: 'enableBackupCreation' },
        },
        {
          name: 'Note Companion file logs',
          control: { type: 'toggle', key: 'useLogs' },
        },
        {
          name: 'Debug mode',
          control: { type: 'toggle', key: 'debugMode' },
        },
        {
          name: 'Enable self-hosting',
          aliases: ['self host', 'local server'],
          control: { type: 'toggle', key: 'enableSelfHosting' },
        },
        {
          name: 'Self-hosting server URL',
          visible: () => settings.enableSelfHosting,
          control: {
            type: 'text',
            key: 'selfHostingURL',
            placeholder: 'http://localhost:3010',
          },
        },
        {
          name: 'Content cutoff characters',
          control: {
            type: 'number',
            key: 'contentCutoffChars',
            min: 100,
            max: 100000,
          },
        },
        {
          name: 'Max formatting tokens',
          control: {
            type: 'number',
            key: 'maxFormattingTokens',
            min: 1000,
            max: 500000,
          },
        },
        {
          name: 'PDF page limit',
          control: {
            type: 'number',
            key: 'pdfPageLimit',
            min: 1,
            max: 100,
          },
        },
      ],
    },
  ];
}
