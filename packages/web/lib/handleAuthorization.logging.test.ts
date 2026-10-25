import { NextRequest } from 'next/server';

const mockCapture = jest.fn();
const mockClerkClient = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  clerkClient: (...a: any[]) => mockClerkClient(...a),
}));
jest.mock('../drizzle/schema', () => ({}));
jest.mock('./unkey-client', () => ({}));
jest.mock('./posthog', () => ({
  __esModule: true,
  default: () => ({ capture: (...a: any[]) => mockCapture(...a) }),
}));

import { handleLoggingV2 } from './handleAuthorization';

describe('handleLoggingV2 (call-api event)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records the endpoint for the user and nothing personal', async () => {
    const req = new NextRequest('http://localhost/api/process-file?x=1');
    await handleLoggingV2(req, 'user_1');

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user_1',
      event: 'call-api',
      properties: { endpoint: 'process-file' },
    });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('@');
  });

  it('does not look the user up in Clerk', async () => {
    await handleLoggingV2(new NextRequest('http://localhost/api/usage'), 'user_1');
    expect(mockClerkClient).not.toHaveBeenCalled();
  });

  it('never throws when PostHog fails', async () => {
    mockCapture.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      handleLoggingV2(new NextRequest('http://localhost/api/usage'), 'user_1')
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
