import { extractAudioSource, restoreAudioSource } from "./audio-source";

const SOURCE = `![[Recordings/call.m4a]]

## Transcript for call.m4a

Okay, perfect.

Thank you so much for your time. I would have to give two weeks before I leave.`;

describe("extractAudioSource", () => {
  it("finds audio embeds and transcript sections", () => {
    const result = extractAudioSource(SOURCE);
    expect(result.embeds).toEqual(["![[Recordings/call.m4a]]"]);
    expect(result.transcripts).toHaveLength(1);
    expect(result.transcripts[0].title).toBe("call.m4a");
    expect(result.transcripts[0].text).toContain("two weeks");
  });

  it("ignores non-audio embeds", () => {
    const result = extractAudioSource("![[photo.png]]\n\nhello");
    expect(result.embeds).toEqual([]);
  });

  it("handles embeds with display size", () => {
    const result = extractAudioSource("![[a.mp3|300]]");
    expect(result.embeds).toEqual(["![[a.mp3|300]]"]);
  });

  it("stops a transcript at the next heading", () => {
    const result = extractAudioSource(
      "![[a.mp3]]\n\n## Transcript for a.mp3\n\nfirst\n\n## Notes\n\nmine"
    );
    expect(result.transcripts[0].text).toBe("first");
  });
});

describe("restoreAudioSource", () => {
  it("returns the note unchanged when there is no audio in the source", () => {
    expect(restoreAudioSource("# Notes", "plain text")).toBe("# Notes");
  });

  it("restores the embed and a collapsed transcript when both were dropped", () => {
    const formatted = "# Interview\n\nDiscussion Points:\n1. Notice period";
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result.startsWith("![[Recordings/call.m4a]]\n\n# Interview")).toBe(
      true
    );
    expect(result).toContain("> [!note]- Transcript for call.m4a");
    expect(result).toContain("> Okay, perfect.");
    expect(result).toContain(">\n> Thank you so much");
  });

  it("puts the embed below frontmatter, not above it", () => {
    const formatted = "---\ntotal: 3\n---\n\n<details>cards</details>";
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result.startsWith("---\ntotal: 3\n---\n")).toBe(true);
    expect(result.indexOf("![[Recordings/call.m4a]]")).toBeGreaterThan(
      result.indexOf("total: 3")
    );
  });

  it("keeps the backup footer last", () => {
    const formatted =
      "# Interview\n\nsummary\n\n---\n[[Backups/call | Link to original file]]";
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result.endsWith("[[Backups/call | Link to original file]]")).toBe(
      true
    );
    expect(result.indexOf("[!note]- Transcript")).toBeLessThan(
      result.indexOf("Link to original file")
    );
  });

  it("is idempotent", () => {
    const once = restoreAudioSource("# Interview\n\nsummary", SOURCE);
    expect(restoreAudioSource(once, SOURCE)).toBe(once);
  });

  it("does not duplicate an embed the model kept", () => {
    const formatted = `![[Recordings/call.m4a]]\n\n# Interview\n\nsummary`;
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result.match(/!\[\[Recordings\/call\.m4a\]\]/g)).toHaveLength(1);
  });

  it("does not add a transcript callout when the model kept the transcript", () => {
    const formatted = `# Interview\n\n## Full Transcript\n\n${
      SOURCE.split("\n\n").slice(2).join("\n\n")
    }`;
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result).not.toContain("[!note]- Transcript");
    expect(result.startsWith("![[Recordings/call.m4a]]")).toBe(true);
  });

  it("restores the transcript when the model keeps only its opening", () => {
    // Keep exactly the first 80 normalized characters: the old prefix-only check
    // would have treated this as a fully preserved transcript.
    const transcript = extractAudioSource(SOURCE).transcripts[0].text;
    const opening = transcript.replace(/\s+/g, " ").slice(0, 80);
    expect(opening).toHaveLength(80);
    expect(transcript.replace(/\s+/g, " ").length).toBeGreaterThan(80);

    const formatted = `![[Recordings/call.m4a]]\n\n# Interview\n\n${opening} (rest omitted)`;
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result).toContain("> [!note]- Transcript for call.m4a");
    expect(result).toContain("two weeks before I leave");
  });

  it("keeps the transcript through two successive formatting passes", () => {
    const first = restoreAudioSource("# Pass 1\n\nsummary one", SOURCE);
    // second format: the already-restored note is the source, and the model drops everything
    const second = restoreAudioSource("# Pass 2\n\nsummary two", first);
    expect(second).toContain("![[Recordings/call.m4a]]");
    expect(second).toContain("> [!note]- Transcript for call.m4a");
    expect(second).toContain("> Thank you so much");
    // and a third pass is still lossless
    const third = restoreAudioSource("# Pass 3", second);
    expect(third).toContain("two weeks before I leave");
    expect(third.match(/\[!note\]- Transcript/g)).toHaveLength(1);
  });

  it("does not duplicate a player when only the display size differs", () => {
    const formatted = "![[Recordings/call.m4a|300]]\n\n# Interview\n\nsummary";
    const result = restoreAudioSource(formatted, SOURCE);
    expect(result.match(/call\.m4a/g)?.length).toBe(
      // embed (1) + transcript callout title (1)
      2
    );
  });
});

describe("extractAudioSource callouts", () => {
  it("parses the collapsed callout form back into a transcript", () => {
    const note =
      "![[a.mp3]]\n\n# T\n\n> [!note]- Transcript for a.mp3\n> line one\n>\n> line two\n\n---\n[[B | Link to original file]]";
    const { transcripts } = extractAudioSource(note);
    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].text).toBe("line one\n\nline two");
  });
});
