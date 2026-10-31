import { clientErrorStatus } from './auth-error-status';

describe('clientErrorStatus', () => {
  it('returns 4xx statuses (401, 403, 429)', () => {
    expect(clientErrorStatus(Object.assign(new Error('x'), { status: 401 }))).toBe(401);
    expect(clientErrorStatus({ status: 403 })).toBe(403);
    expect(clientErrorStatus({ status: 429 })).toBe(429);
  });

  it('ignores server errors, missing statuses and non-objects', () => {
    expect(clientErrorStatus({ status: 500 })).toBeNull();
    expect(clientErrorStatus({ status: '401' })).toBeNull();
    expect(clientErrorStatus(new Error('boom'))).toBeNull();
    expect(clientErrorStatus(null)).toBeNull();
    expect(clientErrorStatus('nope')).toBeNull();
  });
});
