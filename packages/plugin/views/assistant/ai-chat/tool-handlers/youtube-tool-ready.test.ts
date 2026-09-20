import { resolveYoutubeToolInvocation } from "./youtube-tool-ready";

describe("resolveYoutubeToolInvocation", () => {
  it("waits when args have not arrived yet", () => {
    expect(
      resolveYoutubeToolInvocation({ args: undefined, hasResult: false })
    ).toEqual({ status: "wait" });
    expect(
      resolveYoutubeToolInvocation({ args: {}, hasResult: false })
    ).toEqual({ status: "wait" });
  });

  it("waits while a video id or URL is still streaming in", () => {
    expect(
      resolveYoutubeToolInvocation({
        args: { videoId: "1vze" },
        hasResult: false,
      })
    ).toEqual({ status: "wait" });
    expect(
      resolveYoutubeToolInvocation({
        args: { videoId: "https://www.youtube.com/watch?v=1vze" },
        hasResult: false,
      })
    ).toEqual({ status: "wait" });
  });

  it("is ready for a complete video id", () => {
    expect(
      resolveYoutubeToolInvocation({
        args: { videoId: "1vzes3R8xhA" },
        hasResult: false,
      })
    ).toEqual({ status: "ready", videoId: "1vzes3R8xhA" });
  });

  it("extracts a complete watch URL", () => {
    expect(
      resolveYoutubeToolInvocation({
        args: {
          videoId: "https://www.youtube.com/watch?v=1vzes3R8xhA",
        },
        hasResult: false,
      })
    ).toEqual({ status: "ready", videoId: "1vzes3R8xhA" });
  });

  it("errors on garbage that is not a YouTube id or URL", () => {
    const result = resolveYoutubeToolInvocation({
      args: { videoId: "not a youtube link at all" },
      hasResult: false,
    });
    expect(result.status).toBe("error");
  });

  it("waits when a result is already present", () => {
    expect(
      resolveYoutubeToolInvocation({
        args: { videoId: "1vzes3R8xhA" },
        hasResult: true,
      })
    ).toEqual({ status: "wait" });
  });
});
