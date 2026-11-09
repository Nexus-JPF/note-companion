import { nextResetDate, summarizeUsage } from "./usage-summary";

const FREE = 100000;
const now = new Date(2026, 10, 8); // Nov 8, 2026

const paid = {
  tokenUsage: 249319,
  maxTokenUsage: 5000000,
  audioTranscriptionMinutes: 70,
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
  it("matches the dashboard numbers for a paid plan", () => {
    const s = summarizeUsage(paid, { now, freeTierTokenLimit: FREE });
    expect(s.lines).toEqual([
      "Plan: monthly (active)",
      "Tokens: 249,319 / 5,000,000",
      "Audio transcription: 70.0 / 300 min",
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
    expect(paidHit.warnings[0]).toContain("Top up credits");
  });

  it("omits the audio line and warnings when there is no audio allowance", () => {
    const s = summarizeUsage(
      { ...paid, maxAudioTranscriptionMinutes: 0 },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines.some(l => l.startsWith("Audio"))).toBe(false);
    expect(s.warnings).toEqual([]);
  });

  it("marks an inactive subscription", () => {
    const s = summarizeUsage(
      { ...paid, subscriptionStatus: "canceled" },
      { now, freeTierTokenLimit: FREE }
    );
    expect(s.lines[0]).toBe("Plan: monthly (inactive)");
  });
});
