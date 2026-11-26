import {
  getLoopsMarketingConsent,
  setLoopsMarketingConsent,
} from './loops';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const LIST = 'list_marketing';

function jsonResponse(body: unknown) {
  return { ok: true, json: jest.fn().mockResolvedValue(body), text: jest.fn() };
}

describe('marketing consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOOPS_API_KEY = 'test-loops-key';
    process.env.LOOPS_MARKETING_LIST_ID = LIST;
  });

  afterEach(() => {
    delete process.env.LOOPS_API_KEY;
    delete process.env.LOOPS_MARKETING_LIST_ID;
  });

  describe('getLoopsMarketingConsent', () => {
    it('is undecided when the contact is not in Loops', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      await expect(getLoopsMarketingConsent('a@b.co')).resolves.toEqual({
        decided: false,
        optedIn: false,
      });
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://app.loops.so/api/v1/contacts/find?email=a%40b.co'
      );
    });

    it('is undecided for a signup who never answered, even if subscribed', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse([{ email: 'a@b.co', subscribed: true, mailingLists: {} }])
      );
      await expect(getLoopsMarketingConsent('a@b.co')).resolves.toEqual({
        decided: false,
        optedIn: false,
      });
    });

    it('is opted in when granted and on the list', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse([
          {
            subscribed: true,
            marketingConsent: 'granted',
            mailingLists: { [LIST]: true },
          },
        ])
      );
      await expect(getLoopsMarketingConsent('a@b.co')).resolves.toEqual({
        decided: true,
        optedIn: true,
      });
    });

    it('is not opted in after an unsubscribe, whatever was stored', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse([
          {
            subscribed: false,
            marketingConsent: 'granted',
            mailingLists: { [LIST]: true },
          },
        ])
      );
      await expect(getLoopsMarketingConsent('a@b.co')).resolves.toEqual({
        decided: true,
        optedIn: false,
      });
    });

    it('throws when the list id is not configured', async () => {
      delete process.env.LOOPS_MARKETING_LIST_ID;
      await expect(getLoopsMarketingConsent('a@b.co')).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('setLoopsMarketingConsent', () => {
    it('opting in adds the list, records the choice and resubscribes', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));
      await setLoopsMarketingConsent('a@b.co', true);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://app.loops.so/api/v1/contacts/update');
      expect(init.method).toBe('PUT');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        email: 'a@b.co',
        marketingConsent: 'granted',
        mailingLists: { [LIST]: true },
        subscribed: true,
      });
      expect(Number.isNaN(Date.parse(body.marketingConsentAt))).toBe(false);
    });

    it('opting out removes the list but keeps onboarding emails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse([{ email: 'a@b.co' }]))
        .mockResolvedValueOnce(jsonResponse({ success: true }));
      await setLoopsMarketingConsent('a@b.co', false);

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body).toMatchObject({
        marketingConsent: 'declined',
        mailingLists: { [LIST]: false },
      });
      expect(body).not.toHaveProperty('subscribed');
    });

    it('opting out does not create a contact that is not in Loops', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      await setLoopsMarketingConsent('a@b.co', false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when Loops rejects the update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('bad'),
      });
      await expect(setLoopsMarketingConsent('a@b.co', true)).rejects.toThrow(
        'bad'
      );
    });
  });
});
