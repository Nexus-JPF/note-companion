// app/(landing)/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Inbox, MessageSquare, Video } from 'lucide-react';
import { DemoSection } from './components/demo-section';
import { PricingSection } from './components/pricing-section';
import { FaqSectionLazy } from './components/faq-section-lazy';
import { HeroSection } from './hero-section';
import Image from 'next/image';
import { YouTubeEmbed } from '@/components/youtube-embed';
import { SoftwareApplicationSchema } from '@/components/software-application-schema';
import { FaqPageSchema } from '@/components/faq-page-schema';

export const metadata: Metadata = {
  title: 'Your AI-powered Knowledge Partner',
  description:
    'Achieve seamless meeting notes, instant handwriting digitization, and the smartest AI chat for your Obsidian workflow. One tool, endless possibilities.',
  openGraph: {
    title: 'Note Companion — Your AI-powered Knowledge Partner',
    description:
      'Achieve seamless meeting notes, instant handwriting digitization, and the smartest AI chat for your Obsidian workflow. One tool, endless possibilities.',
  },
  twitter: {
    title: 'Note Companion — Your AI-powered Knowledge Partner',
    description:
      'Achieve seamless meeting notes, instant handwriting digitization, and the smartest AI chat for your Obsidian workflow. One tool, endless possibilities.',
  },
};

export default function Page() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-foreground">
      <SoftwareApplicationSchema />
      <FaqPageSchema />
      <section className="w-full bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <HeroSection />
      </section>

      {/* Stats Section */}
      <div className="w-full py-20 md:py-28 bg-muted/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 text-center">
            <div>
              <h2 className="text-lg font-normal text-muted-foreground">
                Trusted by thousands of knowledge workers
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Meet Your All-in-One Workflow Buddy */}
      <div className="w-full py-20 md:py-28 bg-muted/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12 text-center">
            What it does for you
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Inbox Feature */}
            <div className="rounded-xl border border-border/40 bg-background/60 p-8 backdrop-blur-sm transition-colors duration-200 hover:border-primary/25 hover:shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Inbox className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Automated Organization
              </h3>
              <p className="text-muted-foreground mb-4">
                Get AI-driven suggestions for folders, tags, filenames &
                formatting. Click to apply in the Organizer or automate the full
                process via the dedicated Inbox folder.{' '}
                <Link
                  href="/blog/how-to-automate-your-second-brain"
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  Learn how to build a second brain in Obsidian
                </Link>{' '}
                with AI.
              </p>
            </div>
            {/* Chat Feature */}
            <div className="rounded-xl border border-border/40 bg-background/60 p-8 backdrop-blur-sm transition-colors duration-200 hover:border-primary/25 hover:shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Chat</h3>
              <p className="text-muted-foreground mb-4">
                Chat directly with your notes and bring other documents or
                folders into the conversation with a simple @ mention. Ask Note
                Companion to modify text, add summaries, rename files, or even
                split your notes—all in real time.
              </p>
            </div>
            {/* YouTube Transcription Feature */}
            <div className="rounded-xl border border-border/40 bg-background/60 p-8 backdrop-blur-sm transition-colors duration-200 hover:border-primary/25 hover:shadow-sm">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                YouTube Transcription
              </h3>
              <p className="text-muted-foreground mb-4">
                Turn any YouTube video into searchable, organized notes. Paste a
                YouTube link in Chat to get instant transcripts and AI-powered
                summaries, or drop links in your Inbox folder for automatic
                processing. Transform video content into structured knowledge
                that fits seamlessly into your vault.
              </p>
            </div>
          </div>
        </div>
        {/* Alternating feature stories */}
        <section
          className="border-t border-border/50 py-20 md:py-28"
          aria-labelledby="feature-stories-heading"
        >
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2
              id="feature-stories-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              A closer look
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
              Three ways Note Companion fits into how you already use Obsidian.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-7xl space-y-24 px-6 md:mt-20 md:space-y-32">
            {/* Feature 1 - Image on left */}
            <div>
              <div className="flex flex-col items-center gap-12 md:flex-row md:items-center">
                <div className="flex-1 overflow-hidden rounded-2xl ring-1 ring-border shadow-sm">
                  <Image
                    src="https://framerusercontent.com/images/oURi6azSaqZ0OgErlSpbW6jBk.png"
                    width={700}
                    height={700}
                    alt="Organization Features"
                    loading="lazy"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <p className="text-sm font-medium uppercase tracking-wide text-primary">
                    Organizer
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Get organization suggestions for tags, folders, titles, and
                    templates
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Let the AI do the thinking. Save your energy for what really
                    matters—the content of your notes.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 - Image on right */}
            <div>
              <div className="flex flex-col items-center gap-12 md:flex-row-reverse md:items-center">
                <div className="flex-1 overflow-hidden rounded-2xl ring-1 ring-border shadow-sm">
                  <Image
                    src="https://framerusercontent.com/images/JYKEtCqETrv0vvMyVUQsN561kT0.png"
                    width={500}
                    height={500}
                    alt="Auto-Organization"
                    loading="lazy"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <p className="text-sm font-medium uppercase tracking-wide text-primary">
                    Inbox
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Auto-organize and format your notes
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Automate your organization workflow with the Inbox so you can
                    get rid of the busywork that keeps slowing you down.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 - Image on left */}
            <div>
              <div className="flex flex-col items-center gap-12 md:flex-row md:items-center">
                <div className="flex-1 overflow-hidden rounded-2xl ring-1 ring-border shadow-sm">
                  <Image
                    src="https://framerusercontent.com/images/SarnueYFDCLxQFTzsbEDNshz3n0.png"
                    width={500}
                    height={500}
                    alt="AI Chat Features"
                    loading="lazy"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <p className="text-sm font-medium uppercase tracking-wide text-primary">
                    AI chat
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Powerful AI chat
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Summarize YouTube videos, search the web, or manage your
                    vault with capable models—right inside Obsidian.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Why Note Companion */}
      {/* <div className="w-full py-24 bg-transparent">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12 text-center">
            Why Note Companion?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Automated Organization</h3>
              <p className="text-muted-foreground">
                No more manual tagging or folder wrangling. Let AI do the heavy lifting.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Instant Insight</h3>
              <p className="text-muted-foreground">
                Seamlessly merge new discussions or files with existing notes, so everything stays updated and easy to find.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Powerful Editing Tools</h3>
              <p className="text-muted-foreground">
                Rename, split, or refine notes with a quick command.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Deep Context</h3>
              <p className="text-muted-foreground">
                AI suggestions factor in the content of your entire vault, ensuring you always get the most relevant tags and folders.
              </p>
            </div>
          </div>
        </div>
      </div> */}

      <DemoSection />

      {/* Testimonials Section */}
      <section
        className="w-full bg-transparent py-20 md:py-28"
        aria-labelledby="testimonials-heading"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16 lg:max-w-4xl">
            <h2
              id="testimonials-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Trusted by engineers, researchers, writers, doctors, executives,
              and students
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Here’s what some of them say about Note Companion.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <article
                key={`${testimonial.handle}-${index}`}
                className="flex flex-col rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-primary/25 hover:shadow-md"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold tracking-tight text-primary ring-2 ring-border"
                    aria-hidden
                  >
                    {getTestimonialInitials(testimonial.name)}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate font-semibold text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {testimonial.handle}
                    </p>
                  </div>
                </div>
                <blockquote className="relative flex-1 border-l-2 border-primary/35 pl-4">
                  <p className="text-base leading-relaxed text-foreground/95">
                    {testimonial.quote}
                  </p>
                </blockquote>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <div id="pricing" className="w-full py-20 md:py-28 bg-transparent">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Simple Pricing
            </h2>
            {/* <p className="text-lg text-muted-foreground mb-12">
              Whether you're a solo note-taker or a power user looking for advanced features, we've got you covered.
            </p> */}
            <div className="rounded-lg border border-border bg-muted/80 p-4 mb-12 max-w-3xl mx-auto text-center ring-1 ring-primary/15">
              <p className="text-foreground">
                Educators and students qualify for a special Monthly rate of $9.
                To claim this offer, please reach out at{' '}
                <a
                  href="mailto:info@notecompanion.ai"
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  info@notecompanion.ai
                </a>{' '}
                via your education email.
              </p>
            </div>

            {/* ScreenPipe Promotion */}
            {/* <div className="bg-[#EBF5FF] border-1 border-[#2E90FA] rounded-lg p-4 mb-12 max-w-3xl mx-auto text-center">
            <p className="text-[#1570EF]">
                <span className="font-bold">Limited Time Offer:</span> All purchases until March 31st include a free copy of <a href="https://screenpi.pe" className="underline font-medium">ScreenPipe</a> (+ ~$200 worth of credits) — the perfect add-on for enhanced meeting notes!
              </p>
            </div> */}
          </div>
          <PricingSection />
        </div>
      </div>

      {/* Media & Features Showcase */}
      <section className="w-full py-20 md:py-28 bg-muted/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
            See it in action
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <YouTubeEmbed
              videoId="IcfgdJ6b4hk"
              title="Note Companion tutorial video"
            />
            <YouTubeEmbed
              videoId="lUo3AVnlSsI"
              title="Note Companion feature walkthrough"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <div className="w-full bg-transparent">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
              Messy vault?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Focus on building knowledge, not managing it. Note Companion
              maintains your vault organized and amplifies your thinking.
            </p>
            <div className="flex items-center justify-center gap-x-6">
              <a href="https://accounts.notecompanion.ai/sign-up">
                <Button size="lg">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <FaqSectionLazy />
    </div>
  );
}

function getTestimonialInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0][0] ?? '';
    const last = parts[parts.length - 1][0] ?? '';
    return (first + last).toUpperCase();
  }
  const word = parts[0] ?? cleaned;
  if (!word) return '?';
  const letters = word.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return (letters + letters).toUpperCase();
  return '?';
}

const testimonials = [
  {
    name: 'Lautaro Losio',
    handle: '@LautaroLosio',
    quote:
      'This is really awesome! I had a similar idea of managing files and titles using AI, but you took it to the next level. This is the best path that all of this AI nonsense can take and truly be useful. Great work!',
  },
  {
    name: 'farmhappens',
    handle: 'u/farmhappens',
    quote:
      'This is an incredible plugin and i am finding so many uses for it. Thanks for making this - and making it open source and self hosted!',
  },
  {
    name: 'Mali Rasko',
    handle: '@MaliRasko',
    quote:
      'I tried a lot of Voice Memos-to-Obsidian workflows and this one is the best so far. Keep up :)',
  },
  {
    name: 'izzy',
    handle: '@izzy',
    quote:
      'Note Companion AI has now automatically organized 3,642 notes for me. I love it. It saves me so much time, and it does a great job with classifying tags, and folder selection.',
  },
  {
    name: 'VitaVee',
    handle: '@VitaVee',
    quote:
      "The plugin has now become an integral part of my flow! It's amazing, you did a really great job guys, thanks so much for releasing this. Super happy to have taken the lifetime plan!",
  },
  {
    name: 'ammarzahid',
    handle: '@ammarzahid',
    quote:
      'I was trying to incorporate my handwritten notes into obsidian from long time and it is the only setup that worked for me. I am extremely happy to find this plugin.',
  },
];
