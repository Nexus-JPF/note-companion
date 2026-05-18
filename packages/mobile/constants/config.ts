// Get the API URL from environment variables or use a default for development
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3010';

// Add retry configuration for API requests
export const API_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000, // 60 seconds timeout
};
