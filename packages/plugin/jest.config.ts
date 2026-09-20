import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Specify the correct root directories for Jest to look for test files
  roots: ['<rootDir>'],

  // Use TypeScript for Jest
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Module name mapper for Obsidian and other aliases
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^./services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
  },

  // Module file extensions for importing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test environment
  testEnvironment: 'node',

  // Test file pattern
  testMatch: ['**/**/*.test.ts', '**/**/*.test.tsx'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  testTimeout: 30000, // 30 seconds

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;

