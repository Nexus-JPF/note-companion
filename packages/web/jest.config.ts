import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Specify the correct root directories for Jest to look for test files
  roots: ['<rootDir>/scripts', '<rootDir>/app', '<rootDir>/lib'],

  // Use TypeScript for Jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },

  // Mock environment variables
  setupFiles: ['<rootDir>/jest.env.setup.js'],

  // Explicit mocks first; unresolved @/ paths fall through to real modules
  moduleNameMapper: {
    '^@/drizzle/schema$': '<rootDir>/__mocks__/@/drizzle/schema.ts',
    '^@/lib/audio/split-audio$': '<rootDir>/__mocks__/@/lib/audio/split-audio.ts',
    '^@/lib/chat/chat-max-steps$': '<rootDir>/__mocks__/@/lib/chat/chat-max-steps.ts',
    '^@/lib/chat/conversation-window$': '<rootDir>/__mocks__/@/lib/chat/conversation-window.ts',
    '^@/lib/chat/youtube-tool-dedup$': '<rootDir>/__mocks__/@/lib/chat/youtube-tool-dedup.ts',
    '^@/lib/handleAuthorization$': '<rootDir>/__mocks__/@/lib/handleAuthorization.ts',
    '^@/lib/incrementAndLogTokenUsage$': '<rootDir>/__mocks__/@/lib/incrementAndLogTokenUsage.ts',
    '^@/lib/models$': '<rootDir>/__mocks__/@/lib/models.ts',
    '^@/lib/posthog$': '<rootDir>/__mocks__/@/lib/posthog.ts',
    '^@/lib/prompts/chat-prompt$': '<rootDir>/__mocks__/@/lib/prompts/chat-prompt.ts',
    '^server-only$': '<rootDir>/__mocks__/server-only.ts',
    '^@/srm.config$': '<rootDir>/__mocks__/@/srm.config.ts',
    '^@/(.*)$': '<rootDir>/$1',
    '^next/server$': '<rootDir>/__mocks__/next/server.ts',
    '^@unkey/api$': '<rootDir>/__mocks__/@unkey/api.ts',
  },

  // Module file extensions for importing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],


  // Test environment
  testEnvironment: 'node',
  // every file that has .test.ts will be run
  testMatch: ['**/**/*.test.ts'],
  // use jest.setup.js for global setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  testTimeout: 30000, // 30 seconds
  // Other Jest configurations can go here
};

export default config;
