jest.mock("obsidian", () => ({ Notice: class {}, requestUrl: jest.fn() }));

import { renderTopUpRow } from "./usage-row";
import { TOP_UP_OPTIONS } from "./top-up";

function fakeSetting() {
  const classes: string[] = [];
  const buttons: string[] = [];
  const setting = {
    settingEl: { addClass: (name: string) => classes.push(name) },
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addButton: (cb: (b: unknown) => void) => {
      const button = {
        setButtonText: (text: string) => (buttons.push(text), button),
        onClick: () => button,
        setDisabled: () => button,
      };
      cb(button);
      return setting;
    },
  };
  return { setting, classes, buttons };
}

describe("renderTopUpRow", () => {
  it("adds one button per offer and marks the row so the buttons wrap below the name", () => {
    const { setting, classes, buttons } = fakeSetting();
    renderTopUpRow({} as never, setting as never);
    expect(buttons).toEqual(TOP_UP_OPTIONS.map(option => option.label));
    expect(classes).toEqual(["nc-wrap-controls"]);
    expect(setting.setName).toHaveBeenCalledWith("Top up");
  });
});
