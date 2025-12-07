import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Specify the correct root directories for Jest to look for test files
  roots: ['<rootDir>/scripts', '<rootDir>/app', '<rootDir>/lib'],

  // Use TypeScript for Jest
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Mock environment variables
  setupFiles: ['<rootDir>/jest.env.setup.js'],

  // Module name mapper for Next.js imports and other aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/__mocks__/@/$1',
    '^next/server$': '<rootDir>/__mocks__/next/server.ts',
    '^@unkey/api$': '<rootDir>/__mocks__/@unkey/api.ts'
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
