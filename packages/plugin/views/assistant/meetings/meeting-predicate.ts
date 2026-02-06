/** Content shape from ScreenpipeResult for the predicate */
export interface ScreenpipeContentForPredicate {
  app_name?: string;
  window_name?: string;
}

export const MEETING_APP_NAMES = new Set([
  "zoom.us",
  "zoom",
  "zoom meeting",
  "slack",
  "microsoft teams",
  "teams",
  "webex",
  "cisco webex",
  "google meet",
]);

export const MEETING_WINDOW_KEYWORDS = [
  "meet - ",
  "zoom meeting",
  "| call",
  "in a call",
  "webex",
  "teams", // Microsoft Teams in browser (e.g. "Microsoft Teams - Meeting" in Chrome)
];

/**
 * Returns true if the content looks like a meeting (Zoom, Meet, Teams, Slack, Webex, etc.).
 * Matches by app_name (lowercased) or window_name containing meeting keywords.
 */
export function isMeetingLike(content: ScreenpipeContentForPredicate): boolean {
  const app = (content.app_name ?? "").toLowerCase().trim();
  if (MEETING_APP_NAMES.has(app)) return true;
  const window = (content.window_name ?? "").toLowerCase();
  return MEETING_WINDOW_KEYWORDS.some(kw => window.includes(kw));
}
