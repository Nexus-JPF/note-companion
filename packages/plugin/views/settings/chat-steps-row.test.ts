import {
  CHAT_STEPS_OPTIONS,
  chatStepsToOption,
  optionToChatSteps,
} from "./chat-steps-row";

describe("chat steps mapping", () => {
  it("maps stored values to dropdown options", () => {
    expect(chatStepsToOption("auto")).toBe("auto");
    expect(chatStepsToOption(3)).toBe("3");
    expect(chatStepsToOption(5)).toBe("5");
  });

  it("falls back to auto for unexpected stored values", () => {
    expect(chatStepsToOption(undefined)).toBe("auto");
    expect(chatStepsToOption(null)).toBe("auto");
    expect(chatStepsToOption(4)).toBe("auto");
    expect(chatStepsToOption("3")).toBe("auto");
  });

  it("maps options back to what the chat reads: numbers for 3 and 5", () => {
    expect(optionToChatSteps("auto")).toBe("auto");
    expect(optionToChatSteps("3")).toBe(3);
    expect(optionToChatSteps("5")).toBe(5);
    expect(optionToChatSteps("bogus")).toBe("auto");
  });

  it("round-trips every option", () => {
    for (const option of Object.keys(CHAT_STEPS_OPTIONS)) {
      expect(chatStepsToOption(optionToChatSteps(option))).toBe(option);
    }
  });
});
