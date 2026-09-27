import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>/lib', '<rootDir>/app'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
};

export default config;
