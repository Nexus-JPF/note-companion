/** The configured inbox folder with stray whitespace removed (matches where the recorder saves). */
export function normalizeInboxPath(pathToWatch: string | undefined | null): string {
  return (pathToWatch ?? "").trim();
}

export function isInInboxFolder(
  filePath: string,
  pathToWatch: string | undefined | null
): boolean {
  const inbox = normalizeInboxPath(pathToWatch);
  if (!inbox) return false;
  return filePath === inbox || filePath.startsWith(inbox + "/");
}
