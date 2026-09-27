import { buildOpenApiSpec } from './spec';

describe('buildOpenApiSpec', () => {
  it('exposes unique operationIds for function calling', () => {
    const spec = buildOpenApiSpec();
    const operationIds: string[] = [];

    for (const pathItem of Object.values(spec.paths)) {
      for (const operation of Object.values(
        pathItem as Record<string, { operationId?: string }>
      )) {
        if (operation?.operationId) {
          operationIds.push(operation.operationId);
        }
      }
    }

    expect(operationIds.length).toBeGreaterThan(0);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('documents the production API server', () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers?.[0]?.url).toBe('https://app.notecompanion.ai');
  });
});
