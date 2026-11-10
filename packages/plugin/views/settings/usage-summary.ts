export interface UsageSummaryInput {
  tokenUsage: number;
  maxTokenUsage: number;
  audioTranscriptionMinutes?: number;
  maxAudioTranscriptionMinutes?: number;
  subscriptionStatus?: string;
  /** Server-computed: also true for lifetime plans whose status is not "active". */
  isActive?: boolean;
  currentPlan?: string;
}

export interface UsageSummary {
  lines: string[];
  warnings: string[];
  /** Free tier only: paid plans have nothing to upgrade to. */
  showUpgrade: boolean;
}

const AUDIO_WARNING_RATIO = 0.9;

/** Usage resets on the 1st of the coming month. */
export function nextResetDate(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

const formatCount = (n: number) => Math.round(n).toLocaleString("en-US");

export function summarizeUsage(
  data: UsageSummaryInput,
  options: { now: Date; freeTierTokenLimit: number }
): UsageSummary {
  const isFreeTier = data.maxTokenUsage === options.freeTierTokenLimit;
  const audioUsed = data.audioTranscriptionMinutes ?? 0;
  const audioMax = data.maxAudioTranscriptionMinutes ?? 0;
  // Prefer the server's isActive; otherwise show the raw status (past_due,
  // canceled...) rather than collapsing everything that is not "active"
  const isActive = data.isActive ?? data.subscriptionStatus === "active";
  const status = isActive ? "active" : data.subscriptionStatus || "inactive";
  const resetDate = nextResetDate(options.now);
  // Add the year when the reset falls in the next calendar year (December -> January)
  const reset = resetDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(resetDate.getFullYear() !== options.now.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });

  const lines = [
    `Plan: ${data.currentPlan || "Free"} (${status})`,
    `Tokens: ${formatCount(data.tokenUsage)} / ${formatCount(data.maxTokenUsage)}`,
  ];
  if (audioMax > 0) {
    lines.push(
      `Audio transcription: ${audioUsed.toFixed(1)} / ${formatCount(audioMax)} min`
    );
  }
  lines.push(`Usage resets on ${reset}`);

  const warnings: string[] = [];
  if (audioMax > 0 && audioUsed >= audioMax) {
    warnings.push(
      "Audio transcription quota reached. Upgrade your plan or wait for the next billing cycle."
    );
  } else if (audioMax > 0 && audioUsed >= audioMax * AUDIO_WARNING_RATIO) {
    const left = Math.max(0, audioMax - audioUsed);
    warnings.push(
      `Audio transcription is almost used up: ${left.toFixed(1)} min left this month.`
    );
  }
  if (data.tokenUsage >= data.maxTokenUsage) {
    warnings.push(
      isFreeTier
        ? "Token limit reached. Upgrade your plan to keep using Note Companion this month."
        : "Token limit reached for this month. Use Top up below to add credits before the reset."
    );
  }

  return { lines, warnings, showUpgrade: isFreeTier };
}
