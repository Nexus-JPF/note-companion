import { Metadata } from 'next';
import { ArrowRight, FolderTree, Inbox, Tags } from 'lucide-react';
import { HeroShimmerCta } from '../components/hero-shimmer-cta';
import { YouTubeEmbed } from '@/components/youtube-embed';

const description =
  'Install Note Companion from Obsidian community plugins. It sorts new notes into folders, adds tags and formats them for you.';

const PLUGIN_ID = 'fileorganizer2000';
const OPEN_IN_OBSIDIAN = `obsidian://show-plugin?id=${PLUGIN_ID}`;
const COMMUNITY_PAGE = `https://obsidian.md/plugins?id=${PLUGIN_ID}`;

// Campaign landing page: kept out of search results so it never competes with the homepage.
export const metadata: Metadata = {
  title: 'Organize your Obsidian vault automatically',
  description,
  robots: { index: false, follow: true },
};

const steps = [
  {
    icon: Inbox,
    title: 'Drop notes in your Inbox',
    body: 'Clippings, meeting notes, PDFs, handwriting. Anything lands in one folder.',
  },
  {
    icon: Tags,
    title: 'AI classifies and tags',
    body: 'Note Companion reads each note and picks the folder, tags and format.',
  },
  {
    icon: FolderTree,
    title: 'Your vault stays tidy',
    body: 'Notes are moved into your existing structure. You review, undo or tweak.',
  },
];

export default function ObsidianLandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-foreground">
      <section className="w-full bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center md:py-24">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            AI plugin for Obsidian
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Stop sorting notes by hand.
            <span className="block text-primary">Let your vault organize itself.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Note Companion files, tags and formats every new note using your
            own folder structure. Installs in under a minute. A free account includes free AI
            usage, no card needed.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <HeroShimmerCta href={OPEN_IN_OBSIDIAN}>
              Install in Obsidian
              <ArrowRight className="h-4 w-4" aria-hidden />
            </HeroShimmerCta>
            <a
              href={COMMUNITY_PAGE}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted sm:border-0 sm:px-0 sm:py-0 sm:text-muted-foreground sm:underline sm:underline-offset-2 sm:hover:bg-transparent sm:hover:text-foreground"
            >
              Or view it on obsidian.md
            </a>
            <p className="max-w-xs text-xs text-muted-foreground sm:hidden">
              Note Companion runs in Obsidian on desktop. Open this page on your
              computer to install.
            </p>
          </div>
        </div>
      </section>

      <section className="w-full max-w-5xl px-6 pb-16">
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="text-center md:text-left">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 md:mx-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-3xl px-6 pb-16">
        <YouTubeEmbed
          videoId="X4yN4ykTJIo"
          title="Note Companion demo video"
        />
      </section>

      <section className="w-full max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Ready to try it on your vault?
        </h2>
        <p className="mt-3 text-muted-foreground">
          Install the plugin and a short setup creates your free account and
          organizes a sample note. Start a 7-day trial later if you want more.
        </p>
        <div className="mt-6">
          <HeroShimmerCta href={OPEN_IN_OBSIDIAN}>
            Install in Obsidian
            <ArrowRight className="h-4 w-4" aria-hidden />
          </HeroShimmerCta>
        </div>
      </section>
    </div>
  );
}
