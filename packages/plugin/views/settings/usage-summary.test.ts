import { nextResetDate, summarizeUsage } from "./usage-summary";

const FREE = 100000;
const now = new Date(2026, 10, 8); // Nov 8, 2026

const paid = {
  tokenUsage: 123456,
  maxTokenUsage: 5000000,
  audioTranscriptionMinutes: 42,
  maxAudioTranscriptionMinutes: 300,
  subscriptionStatus: "active",
  currentPlan: "monthly",
};

describe("nextResetDate", () => {
  it("is the 1st of the coming month", () => {
    expect(nextResetDate(new Date(2026, 10, 8))).toEqual(new Date(2026, 11, 1));
  });
  it("rolls over the year", () => {
    expect(nextResetDate(new Date(2026, 11, 31))).toEqual(new Date(2027, 0, 1));
  });
});

describe("summarizeUsage", () => {
  it("includes the year when the reset is in the next calendar year", () => {
    const s = summarizeUsage(paid, {
      now: new Date(2026, 11, 20),
      freeTierTokenLimit: FREE,
    });
    expect(s.lines[s.lines.length - 1]).toBe("Usage resets on January 1, 2027");
  });

  it("formats the numbers for a paid plan", () => {
    const s = summarizeUsage(paid, { now, freeTierTokenLimit: FREE });
    expect(s.lines).toEqual([
      "Plan: monthly (active)",
      "Tokens: 123,456 / 5,000,000",
      "Audio transcription: 42.0 / 300 min",
      "Usage resets on December 1",
    ]);
    expect(s.warnings).toEqual([]);
    expect(s.showUpgrade).toBe(false);
  });

  it("offers the upgrade only on the free tier", () => {
    const free = { ...paid, maxTokenUsage: FREE, tokenUsage: 10, currentPlan: "" };
    const s = summarizeUsage(free, { now, freeTierTokenLimit: FREE });
    expect(s.showUpgrade).toBe(true);
    expect(s.lines[0]).toBe("Plan: Free (active)");
  });

  it("warns when audio minutes are nearly used up, with the minutes left", () => {
    const s = summarizeUsage(
      { ...paid, audioTranscriptionMinutes: 275 },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.warnings).toEqual([
      "Audio transcription is almost used up: 25.0 min left this month.",
    ]);
  });

  it("reports a reached audio quota instead of the almost-used warning", () => {
    const s = summarizeUsage(
      { ...paid, audioTranscriptionMinutes: 300 },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.warnings).toHaveLength(1);
    expect(s.warnings[0]).toContain("quota reached");
  });

  it("explains a reached token limit differently for free and paid plans", () => {
    const freeHit = summarizeUsage(
      { ...paid, maxTokenUsage: FREE, tokenUsage: FREE },
      { now, freeTierTokenLimit: FREE }
    );
    expect(freeHit.warnings[0]).toContain("Upgrade your plan");
    const paidHit = summarizeUsage(
      { ...paid, tokenUsage: 5000000 },
      { now, freeTierTokenLimit: FREE }
    );
    expect(paidHit.warnings[0]).toContain("Use Top up below");
  });

  it("omits the audio line and warnings when there is no audio allowance", () => {
    const s = summarizeUsage(
      { ...paid, maxAudioTranscriptionMinutes: 0 },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines.some(l => l.startsWith("Audio"))).toBe(false);
    expect(s.warnings).toEqual([]);
  });

  it("treats a lifetime plan as active via the server's isActive flag", () => {
    const s = summarizeUsage(
      { ...paid, subscriptionStatus: "inactive", isActive: true },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines[0]).toBe("Plan: monthly (active)");
  });

  it("shows the raw status instead of a blanket 'inactive'", () => {
    const s = summarizeUsage(
      { ...paid, subscriptionStatus: "past_due", isActive: false },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines[0]).toBe("Plan: monthly (past_due)");
  });

  it("marks an inactive subscription", () => {
    const s = summarizeUsage(
      { ...paid, subscriptionStatus: "", isActive: false },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines[0]).toBe("Plan: monthly (inactive)");
  });
});
