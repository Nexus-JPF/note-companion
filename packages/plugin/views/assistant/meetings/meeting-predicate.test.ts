import { isMeetingLike } from "./meeting-predicate";

describe("isMeetingLike", () => {
  describe("app_name match", () => {
    it("returns true for zoom.us", () => {
      expect(isMeetingLike({ app_name: "zoom.us" })).toBe(true);
    });

    it("returns true for Zoom (case-insensitive)", () => {
      expect(isMeetingLike({ app_name: "Zoom" })).toBe(true);
      expect(isMeetingLike({ app_name: "ZOOM" })).toBe(true);
    });

    it("returns true for Slack", () => {
      expect(isMeetingLike({ app_name: "Slack" })).toBe(true);
    });

    it("returns true for Microsoft Teams", () => {
      expect(isMeetingLike({ app_name: "Microsoft Teams" })).toBe(true);
    });

    it("returns true for Teams", () => {
      expect(isMeetingLike({ app_name: "Teams" })).toBe(true);
    });

    it("returns true for Webex and Cisco Webex", () => {
      expect(isMeetingLike({ app_name: "Webex" })).toBe(true);
      expect(isMeetingLike({ app_name: "Cisco Webex" })).toBe(true);
    });

    it("returns true for Google Meet", () => {
      expect(isMeetingLike({ app_name: "Google Meet" })).toBe(true);
    });

    it("returns true for Zoom Meeting (app name variant)", () => {
      expect(isMeetingLike({ app_name: "Zoom Meeting" })).toBe(true);
    });

    it("returns false for non-meeting apps", () => {
      expect(isMeetingLike({ app_name: "Cursor" })).toBe(false);
      expect(isMeetingLike({ app_name: "Obsidian" })).toBe(false);
      expect(isMeetingLike({ app_name: "Terminal" })).toBe(false);
      expect(isMeetingLike({ app_name: "Google Chrome" })).toBe(false);
      expect(isMeetingLike({ app_name: "Safari" })).toBe(false);
    });

    it("trims app_name before matching", () => {
      expect(isMeetingLike({ app_name: "  zoom.us  " })).toBe(true);
    });
  });

  describe("window_name match", () => {
    it('returns true when window contains "meet - " (Google Meet in Chrome)', () => {
      expect(
        isMeetingLike({
          app_name: "Google Chrome",
          window_name: "Meet - My Meeting - Google Chrome",
        })
      ).toBe(true);
    });

    it('returns true when window contains "zoom meeting"', () => {
      expect(
        isMeetingLike({
          app_name: "Some App",
          window_name: "Zoom Meeting - John Doe",
        })
      ).toBe(true);
    });

    it('returns true when window contains "| call" (Slack call)', () => {
      expect(
        isMeetingLike({
          app_name: "Slack",
          window_name: "Channel Name | Call in progress",
        })
      ).toBe(true);
    });

    it('returns true when window contains "in a call"', () => {
      expect(
        isMeetingLike({
          app_name: "App",
          window_name: "You are in a call with 3 people",
        })
      ).toBe(true);
    });

    it('returns true when window contains "webex"', () => {
      expect(
        isMeetingLike({
          app_name: "Browser",
          window_name: "Cisco Webex Meeting",
        })
      ).toBe(true);
    });

    it("is case-insensitive for window keywords", () => {
      expect(
        isMeetingLike({
          app_name: "Other",
          window_name: "MEET - Something",
        })
      ).toBe(true);
      expect(
        isMeetingLike({
          app_name: "Other",
          window_name: "ZOOM MEETING",
        })
      ).toBe(true);
    });

    it('returns true when window contains "teams" (Microsoft Teams in browser)', () => {
      expect(
        isMeetingLike({
          app_name: "Google Chrome",
          window_name: "Microsoft Teams - Meeting",
        })
      ).toBe(true);
      expect(
        isMeetingLike({
          app_name: "Safari",
          window_name: "Teams | Call in progress",
        })
      ).toBe(true);
    });

    it("returns false when window has no meeting keywords", () => {
      expect(
        isMeetingLike({
          app_name: "Chrome",
          window_name: "YouTube - Watch Video",
        })
      ).toBe(false);
      expect(
        isMeetingLike({
          app_name: "Cursor",
          window_name: "chat.tsx — note-companion",
        })
      ).toBe(false);
    });
  });

  describe("empty or missing content", () => {
    it("returns false when app_name and window_name are empty", () => {
      expect(isMeetingLike({})).toBe(false);
      expect(isMeetingLike({ app_name: "", window_name: "" })).toBe(false);
    });

    it("returns false when app_name is missing and window has no keywords", () => {
      expect(isMeetingLike({ window_name: "Random Window" })).toBe(false);
    });
  });
});
