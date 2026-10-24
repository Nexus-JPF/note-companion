import { shouldAutoOpenOnboarding } from "./onboarding-gate";

const fresh = {
  hasRunOnboarding: false,
  hasShownOnboarding: false,
  API_KEY: "",
  enableSelfHosting: false,
};

describe("shouldAutoOpenOnboarding", () => {
  it("opens for a brand-new install", () => {
    expect(shouldAutoOpenOnboarding(fresh)).toBe(true);
  });

  it("does not open once the wizard was shown (even if closed unfinished)", () => {
    expect(
      shouldAutoOpenOnboarding({ ...fresh, hasShownOnboarding: true })
    ).toBe(false);
  });

  it("does not open after onboarding was completed", () => {
    expect(
      shouldAutoOpenOnboarding({ ...fresh, hasRunOnboarding: true })
    ).toBe(false);
  });

  it("does not interrupt existing users who already have a license key", () => {
    expect(shouldAutoOpenOnboarding({ ...fresh, API_KEY: "abc123" })).toBe(
      false
    );
  });

  it("does not open for self-hosted setups", () => {
    expect(
      shouldAutoOpenOnboarding({ ...fresh, enableSelfHosting: true })
    ).toBe(false);
  });
});
