import Link from 'next/link';
import Image from 'next/image';
import { Toaster } from '@/components/ui/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { GitHubStarCount } from '@/components/github-star-count';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://www.notecompanion.ai');

export const metadata: Metadata = {
  title: {
    default: 'Note Companion - Your AI-powered Knowledge Partner',
    template: '%s | Note Companion',
  },
  description:
    'Your AI-powered assistant that turns scattered notes into actionable knowledge. Seamless meeting notes, instant organization, and the smartest AI chat for your Obsidian workflow.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Note Companion',
    images: ['/notecompanion.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/notecompanion.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <TooltipProvider>
        <main className="min-h-screen flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col items-center">
            {/* <div className="w-full bg-gray-900">
              <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone className="h-5 w-5 text-purple-400 hidden sm:block" />
                  <p className="text-sm font-medium text-white">
                    <span className="hidden sm:inline bg-purple-500 text-white px-1.5 py-0.5 rounded-md text-xs mr-2">
                      NEW
                    </span>
                    Note Companion Mobile with best-in-class OCR technology
                    is now available
                  </p>
                </div>
                <Link
                  href="/mobile"
                  className="text-purple-400 text-sm font-medium hover:text-purple-300 flex items-center"
                >
                  Learn more <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div> */}

            <div className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="mx-auto max-w-7xl px-6 py-4">
                <div className="flex items-center justify-between">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5 text-foreground"
                    aria-label="Note Companion home"
                  >
                    <Image
                      src="/notecompanion.png"
                      alt=""
                      width={30}
                      height={30}
                    />
                    <span className="text-lg font-semibold tracking-tight sm:text-xl">
                      Note Companion
                    </span>
                  </Link>
                  <div className="flex items-center space-x-4">
                    <a
                      href="https://www.youtube.com/watch?v=NQjZcL4sThs&list=PLgRcC-DFR5jdUxbSBuNeymwYTH_FSVxio"
                      className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tutorials
                    </a>

                    <Link
                      href="/blog"
                      className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Blog
                    </Link>

                    <GitHubStarCount />
                    <Link href="https://accounts.notecompanion.ai/sign-up">
                      <Button variant="default" size="sm">
                        Start
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-1 flex-col">{children}</div>

            <footer className="mt-auto w-full border-t border-border bg-muted/20">
              <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <Link href="/mobile" className="hover:text-foreground">
                    Mobile
                  </Link>
                  <Link href="/developers" className="hover:text-foreground">
                    Developers
                  </Link>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy
                  </Link>
                  <Link
                    href="/terms-of-service"
                    className="hover:text-foreground"
                  >
                    Terms
                  </Link>
                </div>
                <div>Copyright © {year} JPF Nexus Inc. All rights reserved.</div>
              </div>
            </footer>
          </div>
        </main>
        <Toaster />
    </TooltipProvider>
  );
}
