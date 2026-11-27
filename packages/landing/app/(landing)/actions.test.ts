import { submitBetaRequest, submitProWaitlist } from './actions';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const PRODUCT_UPDATES = 'cm2a922wi00t20lk17m35026r';

// The contacts/update call is always the last one (a lookup may come first)
function sentBody() {
  const calls = mockFetch.mock.calls;
  return JSON.parse(calls[calls.length - 1][1].body);
}

// find returns [], update returns { success: true }
function loopsWith(found: unknown[]) {
  mockFetch.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes('/contacts/find') ? found : { success: true },
  }));
}

describe('landing signup forms: product updates opt-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOOPS_API_KEY = 'test-key';
    loopsWith([]);
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

  it('never sends subscribed, so an unsubscribe is not undone', async () => {
    await submitBetaRequest('a@b.co', 'mobile_beta_signup', true);
    expect(sentBody()).not.toHaveProperty('subscribed');
    mockFetch.mockClear();
    await submitProWaitlist('a@b.co', 'monthly', undefined, undefined, true);
    expect(sentBody()).not.toHaveProperty('subscribed');
  });

  it('does not overwrite a declined choice, but still joins the waitlist', async () => {
    loopsWith([{ email: 'a@b.co', marketingConsent: 'declined' }]);
    await submitProWaitlist('a@b.co', 'monthly', undefined, undefined, true);
    const body = sentBody();
    expect(body.mailingLists).toEqual({ cmuddxgi61q9l0j0wdf7d65mn: true });
    expect(body).not.toHaveProperty('marketingConsent');
  });

  it('ignores the box when the lookup fails', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/contacts/find')
        ? { ok: false, json: async () => ({}) }
        : { ok: true, json: async () => ({ success: true }) }
    );
    await submitBetaRequest('a@b.co', 'mobile_beta_signup', true);
    expect(sentBody().mailingLists).toEqual({ cm8qkg9g9015e0it80bmo4baz: true });
  });

  it('does not look the contact up when the box is not ticked', async () => {
    await submitBetaRequest('a@b.co', 'mobile_beta_signup');
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
