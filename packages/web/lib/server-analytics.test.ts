const capture = jest.fn();
const shutdown = jest.fn().mockResolvedValue(undefined);
let mockClient: unknown = { capture, shutdown };

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  default: () => mockClient,
}));

import { captureServerEvent } from './server-analytics';

describe('captureServerEvent', () => {
  beforeEach(() => {
    capture.mockClear();
    shutdown.mockClear();
    mockClient = { capture, shutdown };
  });

  it('captures a known user event and flushes', async () => {
    await captureServerEvent('plugin_account_created', { a: 1 }, 'user_1');
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'user_1',
      event: 'plugin_account_created',
      properties: { a: 1 },
    });
    expect(shutdown).toHaveBeenCalled();
  });

  it('records anonymous events without a person profile', async () => {
    await captureServerEvent('plugin_signin_failed', { reason: 'wrong_password' });
    const arg = capture.mock.calls[0][0];
    expect(arg.distinctId).toMatch(/^anon-/);
    expect(arg.properties).toEqual({
      reason: 'wrong_password',
      $process_person_profile: false,
    });
  });

  it('does nothing when PostHog is not configured', async () => {
    mockClient = null;
    await expect(captureServerEvent('x')).resolves.toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });

  it('never throws when PostHog fails', async () => {
    capture.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(captureServerEvent('x', {}, 'u')).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
