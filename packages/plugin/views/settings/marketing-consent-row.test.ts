jest.mock("obsidian", () => ({ Notice: jest.fn(), requestUrl: jest.fn() }));

const mockFetch = jest.fn();
const mockSave = jest.fn();
jest.mock("../../lib/marketing-consent", () => ({
  ...jest.requireActual("../../lib/marketing-consent"),
  fetchMarketingConsent: (...a: unknown[]) => mockFetch(...a),
  saveMarketingConsent: (...a: unknown[]) => mockSave(...a),
}));

import { renderMarketingConsentRow } from "./marketing-consent-row";

function fakeToggle() {
  let onChange: (v: boolean) => unknown = () => undefined;
  const toggle = {
    value: false,
    disabled: false,
    setDisabled: jest.fn((d: boolean) => ((toggle.disabled = d), toggle)),
    setValue: jest.fn((v: boolean) => {
      if (v !== toggle.value) {
        toggle.value = v;
        void onChange(v);
      }
      return toggle;
    }),
    onChange: (cb: typeof onChange) => ((onChange = cb), toggle),
    // what a user click does
    click: (v: boolean) => {
      toggle.value = v;
      return onChange(v);
    },
  };
  return toggle;
}

function fakeSetting() {
  const toggle = fakeToggle();
  const setting = {
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addToggle: jest.fn((cb: (t: unknown) => void) => (cb(toggle), setting)),
  };
  return { setting, toggle };
}

function fakePlugin(overrides: Record<string, unknown> = {}) {
  return {
    settings: {
      API_KEY: "key",
      enableSelfHosting: false,
      marketingConsentAsked: false,
      ...overrides,
    },
    saveSettings: jest.fn().mockResolvedValue(undefined),
  };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe("renderMarketingConsentRow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("has no toggle without a license key", () => {
    const { setting } = fakeSetting();
    renderMarketingConsentRow(fakePlugin({ API_KEY: "" }) as never, setting as never);
    expect(setting.addToggle).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("has no toggle when self-hosting", () => {
    const { setting } = fakeSetting();
    renderMarketingConsentRow(
      fakePlugin({ enableSelfHosting: true }) as never,
      setting as never
    );
    expect(setting.addToggle).not.toHaveBeenCalled();
  });

  it("shows the server state without saving it back", async () => {
    mockFetch.mockResolvedValue({ decided: true, optedIn: true });
    const { setting, toggle } = fakeSetting();
    renderMarketingConsentRow(fakePlugin() as never, setting as never);
    await flush();
    expect(toggle.value).toBe(true);
    expect(toggle.disabled).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("stays disabled when the server cannot tell", async () => {
    mockFetch.mockResolvedValue(null);
    const { setting, toggle } = fakeSetting();
    renderMarketingConsentRow(fakePlugin() as never, setting as never);
    await flush();
    expect(toggle.disabled).toBe(true);
  });

  it("saves a click and remembers the user answered", async () => {
    mockFetch.mockResolvedValue({ decided: false, optedIn: false });
    mockSave.mockResolvedValue(true);
    const plugin = fakePlugin();
    const { setting, toggle } = fakeSetting();
    renderMarketingConsentRow(plugin as never, setting as never);
    await flush();
    await toggle.click(true);
    expect(mockSave).toHaveBeenCalledWith(plugin, true);
    expect(plugin.settings.marketingConsentAsked).toBe(true);
  });

  it("puts the switch back when saving fails, without saving again", async () => {
    mockFetch.mockResolvedValue({ decided: false, optedIn: false });
    mockSave.mockResolvedValue(false);
    const plugin = fakePlugin();
    const { setting, toggle } = fakeSetting();
    renderMarketingConsentRow(plugin as never, setting as never);
    await flush();
    await toggle.click(true);
    expect(toggle.value).toBe(false);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(plugin.settings.marketingConsentAsked).toBe(false);
  });
});
