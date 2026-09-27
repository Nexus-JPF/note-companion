import { getSiteBaseUrl } from '@/lib/agent/markdown-response';

export function buildOpenApiSpec() {
  const marketingBase = getSiteBaseUrl();
  const apiServer = 'https://app.notecompanion.ai';

  return {
    openapi: '3.1.0',
    info: {
      title: 'Note Companion API',
      version: '1.0.0',
      description:
        'REST API for the Note Companion Obsidian plugin and mobile apps. Authenticate with a Bearer API key from your Note Companion account settings. Full developer docs: ' +
        `${marketingBase}/developers`,
    },
    servers: [{ url: apiServer, description: 'Production API' }],
    tags: [
      { name: 'Health', description: 'Service health checks' },
      { name: 'AI', description: 'Vault-aware AI operations' },
      { name: 'Media', description: 'Transcription and uploads' },
      { name: 'Account', description: 'Usage and billing helpers' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Note Companion API key (Bearer token). Create keys in the Obsidian plugin settings or web dashboard.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'resolution'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                resolution: { type: 'string' },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
          },
        },
        TranscribeResponse: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Transcript text' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/health': {
        get: {
          operationId: 'getHealth',
          summary: 'Check API availability',
          description:
            'Unauthenticated liveness check for the Note Companion backend.',
          tags: ['Health'],
          security: [],
          responses: {
            '200': {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/api/chat/v5': {
        post: {
          operationId: 'streamVaultChat',
          summary: 'Stream vault-aware AI chat',
          description:
            'Streaming chat compatible with the Vercel AI SDK. Tool calls execute locally in the Obsidian plugin.',
          tags: ['AI'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['messages'],
                  properties: {
                    messages: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Streaming AI response (data stream)' },
            '401': {
              description: 'Missing or invalid API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/transcribe': {
        post: {
          operationId: 'transcribeAudio',
          summary: 'Transcribe audio to text',
          description:
            'Upload audio (multipart/form-data) or reference a presigned R2 upload for large files. Returns markdown-friendly transcript text.',
          tags: ['Media'],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Transcription completed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TranscribeResponse' },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/format': {
        post: {
          operationId: 'formatDocument',
          summary: 'Format note content with AI',
          tags: ['AI'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string' },
                    formattingInstruction: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Formatted markdown content' },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/usage': {
        get: {
          operationId: 'getUsage',
          summary: 'Get token and transcription usage',
          tags: ['Account'],
          responses: {
            '200': { description: 'Usage quotas and consumption' },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/create-upload-url': {
        post: {
          operationId: 'createUploadUrl',
          summary: 'Create a presigned upload URL (R2)',
          tags: ['Media'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fileName: { type: 'string' },
                    contentType: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Presigned URL and file id' },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
  };
}
