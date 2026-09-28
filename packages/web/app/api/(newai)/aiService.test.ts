import {
  generateTags,
  generateExistingTags,
  generateAliasVariations,
  guessRelevantFolder,
  createNewFolder,
  generateRelationships,
  generateDocumentTitle,
  extractTextFromImage,
  classifyDocument,
  formatDocumentContent,
  identifyConceptsAndFetchChunks,
  generateTranscriptFromAudio,
} from './aiService';
import { LanguageModel } from 'ai';
import { generateObject, generateText, streamObject } from 'ai';
import { extractTextFromVisionImage } from '@/lib/ocr-extract';
import { createReadStream } from 'fs';
import { promises as fsPromises } from 'fs';

// Mock dependencies
const mockOpenAICreate = jest.fn();

jest.mock('@/lib/ocr-extract', () => ({
  extractTextFromVisionImage: jest.fn(),
}));

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
  streamObject: jest.fn(),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockOpenAICreate,
      },
    },
  })),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('aiService', () => {
  const mockModel: LanguageModel = {
    modelId: 'gpt-4o-mini',
  } as LanguageModel;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('generateTags', () => {
    it('should generate tags from vault tags', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          tags: ['meeting', 'notes', 'planning'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateTags(
        'Meeting notes',
        'meeting.md',
        ['meeting', 'notes', 'planning', 'todo'],
        mockModel
      );

      expect(result.object.tags).toEqual(['#meeting', '#notes', '#planning']);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should generate new tags when vaultTags is null', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          tags: ['machine-learning', 'ai', 'neural-networks'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateTags('AI content', 'ai.md', null, mockModel);

      expect(result.object.tags).toHaveLength(3);
      expect(result.object.tags[0]).toMatch(/^#/);
    });

    it('should add # prefix to tags', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          tags: ['tag1', '#tag2', 'tag with spaces'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateTags('Content', 'file.md', null, mockModel);

      expect(result.object.tags[0]).toBe('#tag1');
      expect(result.object.tags[1]).toBe('#tag2');
      expect(result.object.tags[2]).toBe('#tagwithspaces'); // Spaces removed
    });
  });

  describe('generateExistingTags', () => {
    it('should select tags from existing vault tags', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          tags: ['meeting', 'notes'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateExistingTags(
        'Meeting notes',
        'meeting.md',
        ['meeting', 'notes', 'planning'],
        mockModel
      );

      expect(result.object.tags).toHaveLength(2);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        })
      );
    });
  });

  describe('generateAliasVariations', () => {
    it('should generate alias variations', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          aliases: ['Meeting Notes', 'meeting notes', 'MEETING_NOTES'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateAliasVariations(
        'Meeting Notes',
        'Content about meetings',
        mockModel
      );

      expect(result.object.aliases).toHaveLength(3);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('good names'),
        })
      );
    });
  });

  describe('guessRelevantFolder', () => {
    it('should suggest folder from existing folders', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          suggestedFolder: 'meetings',
        },
        usage: { totalTokens: 100 },
      });

      const result = await guessRelevantFolder(
        'Meeting notes',
        'meeting.md',
        ['meetings', 'notes', 'projects'],
        mockModel
      );

      expect(result.object.suggestedFolder).toBe('meetings');
    });

    it('should return null when no folder matches', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          suggestedFolder: null,
        },
        usage: { totalTokens: 100 },
      });

      const result = await guessRelevantFolder(
        'Content',
        'file.md',
        ['folder1', 'folder2'],
        mockModel
      );

      expect(result.object.suggestedFolder).toBeNull();
    });

    it('should include custom instructions when provided', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          suggestedFolder: 'custom',
        },
        usage: { totalTokens: 100 },
      });

      await guessRelevantFolder(
        'Content',
        'file.md',
        ['folder1'],
        mockModel,
        'Use technical folder names'
      );

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Use technical folder names');
    });
  });

  describe('createNewFolder', () => {
    it('should suggest new folder name', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          newFolderName: 'ai-research',
        },
        usage: { totalTokens: 100 },
      });

      const result = await createNewFolder(
        'AI research content',
        'ai.md',
        ['meetings', 'notes'],
        mockModel
      );

      expect(result.object.newFolderName).toBe('ai-research');
    });
  });

  describe('generateRelationships', () => {
    it('should find similar files', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          similarFiles: ['file1.md', 'file2.md', 'file3.md'],
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateRelationships(
        'Active file content',
        [
          { name: 'file1.md' },
          { name: 'file2.md' },
          { name: 'file3.md' },
        ],
        mockModel
      );

      expect(result.object.similarFiles).toHaveLength(3);
    });
  });

  describe('generateDocumentTitle', () => {
    it('should generate document title', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          name: 'Meeting Notes - January 2024',
        },
        usage: { totalTokens: 100 },
      });

      const result = await generateDocumentTitle(
        'Meeting notes content',
        'untitled.md',
        mockModel,
        'Make it descriptive'
      );

      expect(result.object.name).toBe('Meeting Notes - January 2024');
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Only answer with human readable title',
        })
      );
    });

    it('should include current datetime in prompt', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          name: 'Title',
        },
        usage: { totalTokens: 100 },
      });

      await generateDocumentTitle('Content', 'file.md', mockModel, '');

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Time:');
      expect(callArgs.prompt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('extractTextFromImage', () => {
    it('should extract text from image using gpt-4o', async () => {
      const imageBuffer = new ArrayBuffer(8);
      const gpt4oModel: LanguageModel = {
        modelId: 'gpt-4o',
      } as LanguageModel;

      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text from image',
        tokensUsed: 100,
      });

      const result = await extractTextFromImage(imageBuffer, gpt4oModel);

      expect(result).toBe('Extracted text from image\n\n');
      expect(extractTextFromVisionImage).toHaveBeenCalled();
    });

    it('should extract text from image using default model', async () => {
      const imageBuffer = new ArrayBuffer(8);

      (extractTextFromVisionImage as jest.Mock).mockResolvedValueOnce({
        text: 'Extracted text',
        tokensUsed: 100,
      });

      const result = await extractTextFromImage(imageBuffer, mockModel);

      expect(result).toBe('Extracted text\n\n');
    });
  });

  describe('classifyDocument', () => {
    it('should classify document type', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          documentType: 'meeting-notes',
        },
        usage: { totalTokens: 100 },
      });

      const result = await classifyDocument(
        'Meeting notes content',
        'meeting.md',
        ['meeting-notes', 'todo-list', 'journal'],
        mockModel
      );

      expect(result.object.documentType).toBe('meeting-notes');
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Only answer with the name'),
        })
      );
    });

    it('should return empty string when no match', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          documentType: '',
        },
        usage: { totalTokens: 100 },
      });

      const result = await classifyDocument(
        'Random content',
        'file.md',
        ['meeting-notes', 'todo-list'],
        mockModel
      );

      expect(result.object.documentType).toBe('');
    });
  });

  describe('formatDocumentContent', () => {
    it('should format document content', async () => {
      const mockStream = [
        { formattedContent: 'Formatted ' },
        { formattedContent: 'Formatted content' },
      ];
      const asyncIterator = async function* () {
        for (const item of mockStream) {
          yield item;
        }
      };

      (streamObject as jest.Mock).mockResolvedValueOnce({
        partialObjectStream: asyncIterator(),
        usage: { totalTokens: 100 },
      });

      const result = await formatDocumentContent(
        'Unformatted content',
        'Format as markdown',
        mockModel
      );

      expect(result.object.formattedContent).toBe('Formatted content');
    });

    it('should include current datetime in prompt', async () => {
      const mockStream = [{ formattedContent: 'Formatted' }];
      const asyncIterator = async function* () {
        for (const item of mockStream) {
          yield item;
        }
      };

      (streamObject as jest.Mock).mockResolvedValueOnce({
        partialObjectStream: asyncIterator(),
        usage: { totalTokens: 100 },
      });

      await formatDocumentContent('Content', 'Format', mockModel);

      const callArgs = (streamObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Time:');
      expect(callArgs.prompt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('identifyConceptsAndFetchChunks', () => {
    it('should identify concepts and fetch chunks', async () => {
      (generateObject as jest.Mock).mockResolvedValueOnce({
        object: {
          concepts: [
            {
              name: 'Machine Learning',
              chunk: 'Machine learning is a subset of AI...',
            },
            {
              name: 'Neural Networks',
              chunk: 'Neural networks are computing systems...',
            },
          ],
        },
        usage: { totalTokens: 200 },
      });

      const result = await identifyConceptsAndFetchChunks(
        'Document about ML and neural networks',
        mockModel
      );

      expect(result.object.concepts).toHaveLength(2);
      expect(result.object.concepts[0].name).toBe('Machine Learning');
      expect(result.object.concepts[0].chunk).toBeDefined();
    });
  });

  describe('generateTranscriptFromAudio', () => {
    it('should generate transcript from audio', async () => {
      const audioBuffer = new ArrayBuffer(8);
      const tempFilePath = '/tmp/audio.mp3';

      (fsPromises.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (createReadStream as jest.Mock).mockReturnValueOnce({
        path: tempFilePath,
      });
      mockOpenAICreate.mockResolvedValueOnce({
        text: 'This is a transcript',
      });
      (fsPromises.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await generateTranscriptFromAudio(
        audioBuffer,
        'mp3',
        'test-api-key'
      );

      expect(result).toBe('This is a transcript');
      expect(fsPromises.writeFile).toHaveBeenCalled();
      expect(fsPromises.unlink).toHaveBeenCalled();
    });

    it('should handle errors and clean up temp file', async () => {
      const audioBuffer = new ArrayBuffer(8);
      const tempFilePath = '/tmp/audio.mp3';

      (fsPromises.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (createReadStream as jest.Mock).mockReturnValueOnce({
        path: tempFilePath,
      });
      mockOpenAICreate.mockRejectedValueOnce(new Error('Transcription failed'));
      (fsPromises.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(
        generateTranscriptFromAudio(audioBuffer, 'mp3', 'test-api-key')
      ).rejects.toThrow('Transcription failed');

      expect(fsPromises.unlink).toHaveBeenCalled();
    });

    it('should use custom baseURL when provided', async () => {
      process.env.OPENAI_API_BASE = 'https://custom-api.example.com/v1';
      const audioBuffer = new ArrayBuffer(8);

      (fsPromises.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (createReadStream as jest.Mock).mockReturnValueOnce({ path: '/tmp/audio.mp3' });
      mockOpenAICreate.mockResolvedValueOnce({ text: 'Transcript' });
      (fsPromises.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      await generateTranscriptFromAudio(audioBuffer, 'mp3', 'test-api-key');

      // OpenAI client should be created with custom baseURL
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });
  });
});

