import { submitBetaRequest, submitProWaitlist } from './actions';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const PRODUCT_UPDATES = 'cm2a922wi00t20lk17m35026r';

function sentBody() {
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}

describe('landing signup forms: product updates opt-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOOPS_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({ json: async () => ({ success: true }) });
  });

  it('beta signup without the box does not join the product updates list', async () => {
    await submitBetaRequest('a@b.co', 'mobile_beta_signup');
    const body = sentBody();
    expect(body.mailingLists).toEqual({ cm8qkg9g9015e0it80bmo4baz: true });
    expect(body).not.toHaveProperty('marketingConsent');
  });

  it('beta signup with the box ticked joins it and records consent', async () => {
    await submitBetaRequest('a@b.co', 'mobile_beta_signup', true);
    const body = sentBody();
    expect(body.mailingLists).toEqual({
      cm8qkg9g9015e0it80bmo4baz: true,
      [PRODUCT_UPDATES]: true,
    });
    expect(body.marketingConsent).toBe('granted');
    expect(Number.isNaN(Date.parse(body.marketingConsentAt))).toBe(false);
  });

  it('Android waitlist still stays off the Mobile App list', async () => {
    await submitBetaRequest('a@b.co', 'android_waitlist', true);
    expect(sentBody().mailingLists).toEqual({ [PRODUCT_UPDATES]: true });
  });

  it('Pro waitlist without the box keeps only the Pro list', async () => {
    await submitProWaitlist('a@b.co', 'monthly');
    const body = sentBody();
    expect(body.mailingLists).toEqual({ cmuddxgi61q9l0j0wdf7d65mn: true });
    expect(body).not.toHaveProperty('marketingConsent');
  });

  it('Pro waitlist with the box ticked also joins product updates', async () => {
    await submitProWaitlist('a@b.co', 'yearly', undefined, undefined, true);
    const body = sentBody();
    expect(body.mailingLists).toEqual({
      cmuddxgi61q9l0j0wdf7d65mn: true,
      [PRODUCT_UPDATES]: true,
    });
    expect(body.marketingConsent).toBe('granted');
  });
});
