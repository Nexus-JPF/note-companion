import { getTemplateDisplayHint } from "./template-metadata";

describe("template-metadata", () => {
  it("returns hints for known youtube templates with normalized names", () => {
    expect(getTemplateDisplayHint("youtube_video")).toContain("Full notes");
    expect(getTemplateDisplayHint("youtube_video.md")).toContain("Full notes");
    expect(getTemplateDisplayHint("YouTube_Summary.MD")).toContain(
      "Short recap"
    );
    expect(getTemplateDisplayHint("youtube_timestamped_outline")).toContain(
      "Hierarchical outline"
    );
  });

  it("returns hints for non-youtube default templates", () => {
    expect(getTemplateDisplayHint("meeting_note")).toContain("Discussion");
    expect(getTemplateDisplayHint("enhance.md")).toContain("headings");
    expect(getTemplateDisplayHint("quiz")).toContain("Multiple-choice");
  });

  it("returns undefined for unknown or custom templates without hints", () => {
    expect(getTemplateDisplayHint("youtube_custom")).toBeUndefined();
    expect(getTemplateDisplayHint("my_template")).toBeUndefined();
    expect(getTemplateDisplayHint("")).toBeUndefined();
  });
});
