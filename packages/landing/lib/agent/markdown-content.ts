import { getSiteBaseUrl } from './markdown-response';

export function buildHomeMarkdown(): string {
  const base = getSiteBaseUrl();
  return `# Note Companion — AI for Obsidian

> Note Companion is an AI-powered Obsidian plugin and mobile app for transcribing audio and YouTube, chatting with your vault locally, and auto-organizing inbox notes.

## Product overview

- **Obsidian plugin**: Inbox processing, classification, tagging, formatting, vault-native AI chat with local tool execution.
- **Mobile app**: Capture photos, PDFs, and audio; sync processed markdown into your vault.
- **API backend**: Authenticated REST endpoints at \`https://app.notecompanion.ai\` (Bearer API key from your Note Companion account).

## Links

- [Marketing site](${base}/)
- [Note Companion developer resources](${base}/developers)
- [OpenAPI specification](${base}/openapi.json)
- [llms.txt agent index](${base}/llms.txt)
- [Sitemap](${base}/sitemap.xml)
- [GitHub — Nexus-JPF/note-companion](https://github.com/Nexus-JPF/note-companion)
`;
}

export function buildDevelopersMarkdown(): string {
  const base = getSiteBaseUrl();
  return `# Note Companion developer resources

Integrate with Note Companion's cloud API (Obsidian plugin and mobile apps).

- **API base URL:** \`https://app.notecompanion.ai\`
- **Auth:** \`Authorization: Bearer <api_key>\`
- [OpenAPI specification](${base}/openapi.json)
- [llms.txt agent index](${base}/llms.txt)
- [Health check](https://app.notecompanion.ai/api/health)
- [Source code](https://github.com/Nexus-JPF/note-companion)
`;
}

export function buildNotFoundMarkdown(pathname: string): string {
  const base = getSiteBaseUrl();
  return `# Page not found

The path \`${pathname}\` does not exist on Note Companion (\`${base}\`).

## What you can do

- Read the [Note Companion developer guide](${base}/developers) for API and integration docs.
- Browse the [llms.txt index](${base}/llms.txt) for agent-oriented links.
- Open the [sitemap](${base}/sitemap.xml) to discover public pages.
- Return to the [homepage](${base}/).
`;
}
