import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Note Companion Developer Resources — API & Agent Integration',
  description:
    'Developer documentation for Note Companion: OpenAPI spec, authentication, API base URL, and guidance for AI agents integrating with Obsidian vault workflows.',
  openGraph: {
    title: 'Note Companion Developer Resources',
    description:
      'OpenAPI, auth, and integration docs for the Note Companion API used by the Obsidian plugin and mobile apps.',
  },
};

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
        Note Companion developer resources
      </h1>
      <p className="text-muted-foreground mb-10">
        Integrate with Note Companion&apos;s cloud API (used by the Obsidian
        plugin and mobile apps) or link agents to our machine-readable docs on
        notecompanion.ai.
      </p>

      <section className="mb-10 space-y-3">
        <h2 className="text-xl font-semibold">API base URL</h2>
        <p className="text-muted-foreground">
          Production API:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            https://app.notecompanion.ai
          </code>
        </p>
        <p className="text-muted-foreground">
          Authenticate with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            Authorization: Bearer &lt;api_key&gt;
          </code>{' '}
          from your Note Companion account (Obsidian plugin settings or web
          dashboard).
        </p>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-xl font-semibold">Machine-readable docs</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <Link href="/openapi.json" className="text-primary underline">
              OpenAPI 3.1 specification
            </Link>{' '}
            — operation IDs and schemas for LLM function calling
          </li>
          <li>
            <Link href="/llms.txt" className="text-primary underline">
              llms.txt
            </Link>{' '}
            — curated links and agent when-to-use guidance
          </li>
          <li>
            <Link href="/sitemap.xml" className="text-primary underline">
              Sitemap
            </Link>
          </li>
        </ul>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-xl font-semibold">Health check</h2>
        <p className="text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            GET https://app.notecompanion.ai/api/health
          </code>{' '}
          — returns{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            {'{ "status": "ok" }'}
          </code>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Source code</h2>
        <p className="text-muted-foreground">
          <a
            href="https://github.com/Nexus-JPF/note-companion"
            className="text-primary underline"
            rel="noopener noreferrer"
          >
            Nexus-JPF/note-companion on GitHub
          </a>{' '}
          — Obsidian plugin, web API, and mobile app monorepo.
        </p>
      </section>
    </div>
  );
}
