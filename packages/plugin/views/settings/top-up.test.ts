jest.mock("obsidian", () => ({ Notice: class {} }));
jest.mock("../../apiUtils", () => ({ validateApiKey: () => ({ isValid: true }) }));
jest.mock("../../lib/obsidian-fetch", () => ({ obsidianFetch: jest.fn() }));

import { TOP_UP_OPTIONS, getTopUpRequest, isSafeCheckoutUrl } from "./top-up";

describe("getTopUpRequest", () => {
  it("minutes use their own endpoint and no body", () => {
    expect(getTopUpRequest("minutes")).toEqual({ path: "/api/top-up-minutes" });
  });

  it("credits use /api/top-up with the tier", () => {
    expect(getTopUpRequest("credits-standard")).toEqual({
      path: "/api/top-up",
      body: { tier: "standard" },
    });
    expect(getTopUpRequest("credits-large")).toEqual({
      path: "/api/top-up",
      body: { tier: "large" },
    });
  });
});

describe("TOP_UP_OPTIONS", () => {
  it("offers minutes and both credit tiers, each with a price in the label", () => {
    expect(TOP_UP_OPTIONS.map(o => o.kind)).toEqual([
      "minutes",
      "credits-standard",
      "credits-large",
    ]);
    for (const option of TOP_UP_OPTIONS) {
      expect(option.label).toMatch(/\$\d+/);
    }
  });
});

describe("isSafeCheckoutUrl", () => {
  it("accepts https checkout pages", () => {
    expect(isSafeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123")).toBe(true);
  });

  it("rejects other schemes, malformed values and non-strings", () => {
    expect(isSafeCheckoutUrl("http://checkout.stripe.com/x")).toBe(false);
    expect(isSafeCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCheckoutUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeCheckoutUrl("not a url")).toBe(false);
    expect(isSafeCheckoutUrl(undefined)).toBe(false);
    expect(isSafeCheckoutUrl(42)).toBe(false);
  });
});

describe("large credits label", () => {
  it("keeps the original better-value wording", () => {
    expect(TOP_UP_OPTIONS.find(o => o.kind === "credits-large")?.label).toContain("better value");
  });
});
