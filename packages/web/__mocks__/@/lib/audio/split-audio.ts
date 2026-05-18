export const normalizeAudioForWhisper = jest.fn(
  async (path: string, _extension?: string) => ({
    path,
    cleanup: null as string | null,
  })
);

export const splitAudioFileBySizeHeuristic = jest.fn();
