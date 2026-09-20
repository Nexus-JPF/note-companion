import {
  parseUnifiedContextJson,
  splitUnifiedContextString,
} from './unified-context';

const contextItems = {
  files: {},
  folders: {},
  tags: {},
  currentFile: { path: 'Untitled.md', title: 'Untitled', content: '' },
  youtubeVideos: {
    'youtube-1vzes3R8xhA': {
      id: 'youtube-1vzes3R8xhA',
      videoId: '1vzes3R8xhA',
      title: "Inside Arsenal's summer transfer window",
      transcript: 'Arteta laid out his manifesto',
    },
  },
  searchResults: {},
  textSelections: {},
};

const json = JSON.stringify(contextItems);

describe('splitUnifiedContextString', () => {
  it('extracts JSON when the plugin prepends attached file paths', () => {
    const raw = `Attached file paths — use these exact strings for mergeFiles sourceFiles, getFileMetadata filePaths, deleteFiles filePaths, or extractHighlights filePath/filePaths (do not modify):
Untitled.md

${json}`;

    const split = splitUnifiedContextString(raw);
    expect(split.jsonText).toBe(json);
    expect(split.prefix).toContain('Untitled.md');
    expect(split.suffix).toBe('');
  });

  it('extracts JSON when editor context is appended after nested empty objects', () => {
    const raw = `${json}\n\n<editor_context><file>Untitled.md</file></editor_context>`;
    const split = splitUnifiedContextString(raw);
    expect(split.jsonText).toBe(json);
    expect(split.suffix).toContain('<editor_context>');
  });
});

describe('parseUnifiedContextJson', () => {
  it('parses the production YouTube + Untitled.md payload', () => {
    const raw = `Attached file paths — use these exact strings for mergeFiles sourceFiles, getFileMetadata filePaths, deleteFiles filePaths, or extractHighlights filePath/filePaths (do not modify):
Untitled.md

${json}

<editor_context><file>Untitled.md</file></editor_context>`;

    const parsed = parseUnifiedContextJson(raw);
    expect(parsed.contextItems).not.toBeNull();
    const videos = parsed.contextItems?.youtubeVideos as
      | Record<string, { videoId: string; transcript: string }>
      | undefined;
    expect(videos?.['youtube-1vzes3R8xhA']?.videoId).toBe('1vzes3R8xhA');
    expect(videos?.['youtube-1vzes3R8xhA']?.transcript).toContain('Arteta');
    expect(parsed.extraText).toContain('Untitled.md');
    expect(parsed.extraText).toContain('<editor_context>');
  });

  it('returns null contextItems for non-JSON text', () => {
    const parsed = parseUnifiedContextJson('just a note');
    expect(parsed.contextItems).toBeNull();
  });
});
