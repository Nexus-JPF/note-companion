import { initializeTokenCounter, getTokenCount, cleanup } from "./token-counter";

describe("token-counter", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("initializeTokenCounter", () => {
    it("should initialize token counter successfully", async () => {
      await initializeTokenCounter();

      const count = getTokenCount("test");
      expect(count).toBeGreaterThan(0);
    });

    it("should return the same resolved state if called multiple times", async () => {
      const promise1 = initializeTokenCounter();
      const promise2 = initializeTokenCounter();

      await promise1;
      await promise2;

      expect(getTokenCount("test")).toBeGreaterThan(0);
    });
  });

  describe("getTokenCount", () => {
    beforeEach(async () => {
      await initializeTokenCounter();
    });

    it("should return token count for simple text", () => {
      const count = getTokenCount("hello world");
      expect(count).toBeGreaterThan(0);
    });

    it("should return 0 for empty string", () => {
      const count = getTokenCount("");
      expect(count).toBe(0);
    });

    it("should handle long text", () => {
      const longText = "a".repeat(1000);
      const count = getTokenCount(longText);
      expect(count).toBe(250);
    });

    it("should handle text with special characters", () => {
      const specialText = "Hello, world! @#$%^&*()";
      const count = getTokenCount(specialText);
      expect(count).toBeGreaterThan(0);
    });

    it("should handle text with newlines", () => {
      const multilineText = "Line 1\nLine 2\nLine 3";
      const count = getTokenCount(multilineText);
      expect(count).toBeGreaterThan(0);
    });

    it("should handle unicode characters", () => {
      const unicodeText = "Hello 世界 🌍";
      const count = getTokenCount(unicodeText);
      expect(count).toBeGreaterThan(0);
    });

    it("should throw error if not initialized", () => {
      cleanup();

      expect(() => getTokenCount("test")).toThrow(
        "Token counter not initialized. Call initializeTokenCounter() first."
      );
    });

    it("should return consistent counts for same input", () => {
      const text = "This is a test string";
      const count1 = getTokenCount(text);
      const count2 = getTokenCount(text);

      expect(count1).toBe(count2);
    });
  });

  describe("cleanup", () => {
    it("should cleanup encoding and reset state", async () => {
      await initializeTokenCounter();
      getTokenCount("test");

      cleanup();

      expect(() => getTokenCount("test")).toThrow(
        "Token counter not initialized. Call initializeTokenCounter() first."
      );
    });

    it("should allow re-initialization after cleanup", async () => {
      await initializeTokenCounter();
      cleanup();

      await initializeTokenCounter();
      const count = getTokenCount("test");
      expect(count).toBeGreaterThan(0);
    });

    it("should be safe to call multiple times", () => {
      cleanup();
      cleanup();
      cleanup();
    });
  });

  describe("integration", () => {
    it("should work with full workflow: init -> count -> cleanup -> init -> count", async () => {
      await initializeTokenCounter();
      const count1 = getTokenCount("first test");
      expect(count1).toBeGreaterThan(0);

      cleanup();

      await initializeTokenCounter();
      const count2 = getTokenCount("second test");
      expect(count2).toBeGreaterThan(0);

      cleanup();
    });

    it("should handle rapid initialization and cleanup", async () => {
      for (let i = 0; i < 5; i++) {
        await initializeTokenCounter();
        getTokenCount(`test ${i}`);
        cleanup();
      }

      await initializeTokenCounter();
      const count = getTokenCount("final test");
      expect(count).toBeGreaterThan(0);
    });
  });
});
