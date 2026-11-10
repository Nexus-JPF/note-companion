jest.mock("obsidian", () => ({ Notice: class {} }));
jest.mock("../../apiUtils", () => ({ validateApiKey: () => ({ isValid: true }) }));
jest.mock("../../lib/obsidian-fetch", () => ({ obsidianFetch: jest.fn() }));

import { TOP_UP_OPTIONS, getTopUpRequest } from "./top-up";

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
