import { Metadata } from "next";
import { ArrowRight, Smartphone, Camera, FileText, RefreshCw } from "lucide-react";
import Image from 'next/image';
import Link from "next/link";
import { BetaRequestForm } from "../components/beta-request-form";
import { defaultOpenGraph } from "@/lib/og";

export const metadata: Metadata = {
  title: "Note Companion for iPhone - Handwriting OCR for Obsidian",
  description:
    "Note Companion for iPhone turns photos of handwritten notes, documents and whiteboards into searchable text, then syncs them to your Obsidian vault. Free on the App Store.",
  alternates: {
    canonical: '/mobile',
  },
  openGraph: {
    ...defaultOpenGraph,
    title: "Note Companion for iPhone - Handwriting OCR for Obsidian",
    description:
      "Note Companion for iPhone turns photos of handwritten notes, documents and whiteboards into searchable text, then syncs them to your Obsidian vault. Free on the App Store.",
    url: '/mobile',
  },
};

const APP_STORE_URL = "https://apps.apple.com/app/id6799668806";

function AppStoreButton({ location }: { location: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-location={location}
      className="inline-flex items-center gap-3 rounded-xl bg-black px-6 py-3 text-white transition-opacity hover:opacity-90"
    >
      <Smartphone className="h-6 w-6" />
      <span className="text-left leading-tight">
        <span className="block text-xs">Download on the</span>
        <span className="block text-lg font-semibold">App Store</span>
      </span>
    </a>
  );
}

export default function MobilePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-gray-700">
      {/* Hero Section with OCR Highlight */}
      <div className="w-full max-w-5xl px-6 py-12 sm:py-12 lg:px-8 bg-transparent">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-8">
            <Smartphone className="mx-auto h-16 w-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span>Note Companion</span>
            <span className="text-primary block">Mobile</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-[1px] w-8 bg-muted-foreground/20"></div>
            <span className="text-xl text-muted-foreground/80 relative">
              your knowledge ecosystem on the go
              <svg className="absolute -bottom-[4px] left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none">
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
            Photograph handwritten notes, documents and whiteboards. Note Companion turns them into searchable text and syncs them to your Obsidian vault.
          </p>
          
          {/* Top CTA */}
          <div className="mt-8 mb-16 flex flex-col items-center gap-3">
            <AppStoreButton location="hero" />
            <p className="text-sm text-muted-foreground">
              Free for iPhone. Requires iOS 17 or later.
            </p>
          </div>

          {/* OCR Before/After */}
          <div className="mt-12 mb-12">
            <h2 className="text-2xl font-bold mb-6">Turn Photos into Searchable Text</h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <div className="md:w-5/12 flex flex-col items-center">
                <h3 className="text-lg font-medium mb-3">Before</h3>
                <div className="relative rounded-xl overflow-hidden shadow-md">
                  <Image 
                    src="/images/before.jpg" 
                    alt="Handwritten note before OCR processing" 
                    width={300} 
                    height={400}
                    className="object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white p-2 text-sm">
                    Handwritten notes
                  </div>
                </div>
              </div>
              
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="h-8 w-8 text-primary" />
              </div>
              
              <div className="md:w-5/12 flex flex-col items-center">
                <h3 className="text-lg font-medium mb-3">After</h3>
                <div className="relative rounded-xl overflow-hidden shadow-md">
                  <Image 
                    src="/images/after.png" 
                    alt="Digitized note after OCR processing" 
                    width={300} 
                    height={400}
                    className="object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white p-2 text-sm">
                    Searchable digital text
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Android notify */}
          <div className="mt-10 bg-gradient-to-r from-primary/10 to-primary/5 p-8 rounded-xl border border-primary/20">
            <h3 className="text-xl font-bold mb-3">Using Android?</h3>
            <p className="text-muted-foreground mb-5">
              The app is iPhone-only for now. Leave your email and we will tell you when an Android version is ready.
            </p>
            <BetaRequestForm
              formId="android-notify-form"
              source="android_waitlist"
              buttonLabel="Notify Me"
              helperText="One email when Android is ready. No spam."
              successTitle="You're on the list"
              successText="We'll email you when the Android app is ready."
            />
          </div>

        </div>
      </div>

      {/* App Features */}
      <div className="w-full py-24 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12 text-center">
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
              <div className="mb-4 text-primary">
                <Camera className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Advanced OCR</h3>
              <p className="text-muted-foreground mb-4">
                Photograph handwritten notes, documents and whiteboards and get clean, searchable text back in seconds.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
              <div className="mb-4 text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Photos and Files</h3>
              <p className="text-muted-foreground mb-4">
                Take a photo, pick one from your library, or upload a file. Everything you process is kept in your My Notes tab.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="bg-background/60 backdrop-blur-sm p-8 rounded-xl border border-border/40">
              <div className="mb-4 text-primary">
                <RefreshCw className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Sync to Obsidian</h3>
              <p className="text-muted-foreground mb-4">
                Your processed notes sync to your Obsidian vault through the Note Companion plugin, so paper notes end up next to everything else you write.
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Get Started Section */}
      <div className="w-full py-24 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            Get Started Today
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            Download Note Companion for iPhone and turn your next handwritten page into searchable text.
          </p>

          <AppStoreButton location="footer" />

          <p className="mt-6 text-sm text-muted-foreground">
            Requires iOS 17 or later. <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
