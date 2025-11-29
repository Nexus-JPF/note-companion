// app/(landing)/page.tsx
import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import {
  PenIcon,
  FileIcon,
  LayersIcon,
  ArrowRight,
  Inbox,
  MessageSquare,
  Video,
} from 'lucide-react';
import { Demo } from './demo/demo';
import { PricingCards } from './components/pricing-cards';
import { FaqSection } from './components/faq-section';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'note companion — your ai-powered knowledge partner',
  description:
    'achieve seamless meeting notes, instant handwriting digitization, and the smartest ai chat for your obsidian workflow. one tool, endless possibilities.',
  openGraph: {
    title: 'note companion — your ai-powered knowledge partner',
    description:
      'achieve seamless meeting notes, instant handwriting digitization, and the smartest ai chat for your obsidian workflow. one tool, endless possibilities.',
  },
};

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background text-gray-700">
      {/* Name Change Banner */}
      <div className="w-full bg-primary/5 border-b border-transparent bg-transparent ">
        <div className="max-w-7xl mx-auto px-6 py-2 text-center text-sm bg-background">
          File Organizer 2000 is now Note Companion
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-5xl px-6 py-12 sm:py-12 lg:px-8 text-center bg-transparent">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <Image
              src="https://framerusercontent.com/images/SqHU6Ili7ACWk8dhvEPmdfXEPDA.png"
              alt="File Organizer Logo"
              width={64}
              height={64}
              className="mx-auto"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span>Keep your Vault</span>
            <span className="text-primary block">Organized</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-[1px] w-8 bg-muted-foreground/20"></div>
            <span className="text-xl text-muted-foreground/80 relative">
              without the hassle
              <svg
                className="absolute -bottom-[4px] left-0 w-full"
                height="8"
                viewBox="0 0 200 8"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,7 Q100,-1 200,7"
                  stroke="blue"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  className="opacity-50"
                />
              </svg>
            </span>
            <div className="h-[1px] w-8 bg-muted-foreground/20"></div>
          </div>
          <p className="mt-6 text-lg leading-8">
            Note Companion is an AI-powered Obsidian plugin that improves your
            workflow by automatically organizing and formatting your notes—so
            you don't have to.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a href="https://accounts.notecompanion.ai/sign-up">
              <Button
                size="lg"
                className="bg-primary text-white hover:bg-primary/90"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="w-full py-12 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 text-center">
            <div>
              <h2 className="text-lg font-normal">
                Trusted by thousands of knowledge workers
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Video */}
      <div className="w-full max-w-4xl px-6 pb-24 bg-transparent">
        <div className="relative aspect-video rounded-lg overflow-hidden ">
          <iframe
            src="https://www.youtube.com/embed/X4yN4ykTJIo?iv_load_policy=3&rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
      </div>

      {/* Meet Your All-in-One Workflow Buddy */}
      <div className="w-full py-24 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12 text-center">
            What it does for you
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Inbox Feature */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Inbox className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Automated Organization
              </h3>
              <p className="text-muted-foreground mb-4">
                Get AI-driven suggestions for folders, tags, filenames &
                formatting. Click to apply in the Organizer or automate the full
                process via the dedicated Inbox folder. <br />
                <br />
                {/* Drag and drop your notes into the dedicated "Inbox" folder for instant organization.
              Or get more control by choosing suggestions in the organizer sidepanel. */}
                {/* Note Companion automatically detects relevant tags and suggests the best folder for your note.
        Drag and drop your notes into the dedicated "Inbox" folder for instant organization.
        Or get more control by choosing suggestions in the organizer sidepanel. */}
              </p>
              <p className="text-muted-foreground mb-4"></p>
            </div>
            {/* Chat Feature */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
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
            {/* Meetings Feature */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Meetings</h3>
              <p className="text-muted-foreground mb-4">
                Supercharge your meeting notes combining Note Companion with
                ScreenPipe, which continuously records your conversation
                (locally). Tap "Enhance Meeting Note" and watch as it merges the
                last few minutes of discussion with your current file for
                perfectly contextualized notes.
              </p>
            </div>
          </div>
        </div>
        {/* Features Section */}
        <section className="py-24 space-y-32">
          {/* Feature 1 - Image on left */}
          <div className="container">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1">
                <Image
                  src="https://framerusercontent.com/images/oURi6azSaqZ0OgErlSpbW6jBk.png"
                  width={700}
                  height={700}
                  alt="Organization Features"
                  className="rounded-lg"
                />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl font-bold">
                  Get organization suggestions for tags, folders, titles and
                  templates.
                </h2>
                <p className="text-muted-foreground">
                  Let the AI do the thinking. Save your energy for what really
                  matters, the content of your notes.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 2 - Image on right */}
          <div className="container">
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="flex-1">
                <Image
                  src="https://framerusercontent.com/images/JYKEtCqETrv0vvMyVUQsN561kT0.png"
                  width={500}
                  height={500}
                  alt="Auto-Organization"
                  className="rounded-lg "
                />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl font-bold">
                  Auto-Organizes & Formats your Notes
                </h2>
                <p className="text-muted-foreground">
                  Automate your organization workflow with the Inbox so you can
                  get rid of the busywork that keeps slowing you down.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 3 - Image on left */}
          <div className="container">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1">
                <Image
                  src="https://framerusercontent.com/images/SarnueYFDCLxQFTzsbEDNshz3n0.png"
                  width={500}
                  height={500}
                  alt="AI Chat Features"
                  className="rounded-lg "
                />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl font-bold">Powerful AI Chat</h2>
                <p className="text-muted-foreground">
                  Allowing you to summarize youtube videos, search the web, or
                  manage your vault with the latest gpt-4o model.
                </p>
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

      {/* Demo Section */}
      <div className="w-full max-w-[1200px] px-6 py-24 bg-white/5 backdrop-blur-sm hidden lg:block">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            What it looks like in your vault
          </h2>
          <p className="text-lg">
            Experience how Note Companion transforms your workflow
          </p>
        </div>
        <Demo />
      </div>

      {/* Testimonials Section */}
      <section className="w-full py-24 bg-transparent">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-semibold text-center mb-12">
            stuff people say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white backdrop-blur-sm p-8 rounded-xl border border-black"
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl">
                      {testimonial.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {testimonial.handle}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground">{testimonial.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <div className="w-full py-24 sm:py-32 bg-transparent">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Simple Pricing
            </h2>
            {/* <p className="text-lg text-muted-foreground mb-12">
              Whether you're a solo note-taker or a power user looking for advanced features, we've got you covered.
            </p> */}
            <div className="bg-[#EBF5FF] border-1 border-[#2E90FA] rounded-lg p-4 mb-12 max-w-3xl mx-auto text-center">
              <p className="text-[#1570EF]">
                Educators and students qualify for a special Monthly rate of $9.
                To claim this offer, please reach out at ben@notecompanion.ai
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
          <PricingCards />
        </div>
      </div>

      {/* Media & Features Showcase */}
      <section className="w-full py-24 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            More Stuff You Can Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/IcfgdJ6b4hk?iv_load_policy=3&rel=0&modestbranding=1&playsinline=1"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-[100%] h-full"
              ></iframe>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <iframe
                src="https://www.youtube.com/embed/lUo3AVnlSsI?iv_load_policy=3&rel=0&modestbranding=1&playsinline=1"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <div className="w-full bg-transparent">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
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
                <Button
                  size="lg"
                  className="text-white bg-primary hover:bg-primary/90"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <FaqSection />
    </main>
  );
}

const features = [
  {
    title: 'Smart File Placement',
    description:
      'Clever AI recommendations ensure each note and file lands in the perfect spot.',
    icon: <FileIcon className="h-6 w-6 text-white" />,
  },
  {
    title: 'Note Refinement',
    description:
      'Auto-polish your text for structure and style—goodbye, messy formatting.',
    icon: <PenIcon className="h-6 w-6 text-white" />,
  },
  {
    title: 'Bulk Operations',
    description:
      'Move, rename, or tag entire groups of files in seconds, saving massive chunks of time.',
    icon: <LayersIcon className="h-6 w-6 text-white" />,
  },
];

/* example testimonials data */
const testimonials = [
  {
    name: 'Lautaro Losio',
    handle: '@LautaroLosio',
    quote:
      'This is really awesome! I had a similar idea of managing files and titles using AI, but you took it to the next level. This is the best path that all of this AI nonsense can take and truly be useful. Great work!',
    avatar:
      'https://framerusercontent.com/images/T6fAo2ENQwZHhGKg0EW1Phoic.jpg',
  },
  {
    name: 'farmhappens',
    handle: 'u/farmhappens',
    quote:
      'This is an incredible plugin and i am finding so many uses for it. Thanks for making this - and making it open source and self hosted!',
    avatar: 'https://framerusercontent.com/images/B5lCffAuQdlID00eQF9Jna0.png',
  },
  {
    name: 'Mali Rasko',
    handle: '@MaliRasko',
    quote:
      'I tried a lot of Voice Memos-to-Obsidian workflows and this one is the best so far. Keep up :)',
    avatar:
      'https://framerusercontent.com/images/QZfOvbSc2pcwnwLmQULhUQ9h0UA.jpg',
  },
  {
    name: 'izzy',
    handle: '@izzy',
    quote:
      'Note Companion AI has now automatically organized 3,642 notes for me. I love it. It saves me so much time, and it does a great job with classifying tags, and folder selection.',
    avatar:
      'https://framerusercontent.com/images/aZNudzX3wJdKLGtCDHuJSM4jDc.png',
  },
  {
    name: 'VitaVee',
    handle: '@VitaVee',
    quote:
      "The plugin has now become an integral part of my flow! It's amazing, you did a really great job guys, thanks so much for releasing this. Super happy to have taken the lifetime plan!",
    avatar:
      'https://framerusercontent.com/images/2PkdaHvwpLSEVM6EPAMUDDxRGD4.png',
  },
  {
    name: 'ammarzahid',
    handle: '@ammarzahid',
    quote:
      'I was trying to incorporate my handwritten notes into obsidian from long time and it is the only setup that worked for me. I am extremely happy to find this plugin.',
    avatar:
      'https://framerusercontent.com/images/Xt9XL2CTd9uYeSqqZgqb75kQLQg.png',
  },
];
