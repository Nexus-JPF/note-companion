'use client';

import { FileText, Zap, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PricingCards } from '@/components/pricing-cards';

const FEATURES = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Smart File Organization',
    description: 'AI-powered sorting and categorization',
    color: 'from-blue-500 to-cyan-400',
    bgLight: 'bg-blue-50',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Chat with your files',
    description: 'Ask questions about your files and get instant answers',
    color: 'from-amber-500 to-orange-400',
    bgLight: 'bg-amber-50',
  },
  {
    icon: <Check className="h-6 w-6" />,
    title: 'Image digitization & Audio Transcription',
    description:
      'Convert your hand-written notes and audio notes to text by simply dropping them into your Obsidian vault',
    color: 'from-green-500 to-emerald-400',
    bgLight: 'bg-green-50',
  },
];

export default function OnboardingPage() {
  // We no longer need to manually redirect after subscription in this page
  // The PricingCards component will handle redirecting to the checkout URLs
  // Upon successful payment, the user will be redirected to the appropriate dashboard page

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[3fr_5fr]">
          {/* Left Column */}
          <div>
            <section>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                Welcome to Note Companion
              </h1>
              <p className="text-lg mb-6">
                Powerful AI features to organize and enhance your Obsidian
                experience.
              </p>
              <div className="aspect-video mb-6">
                <iframe
                  className="w-full h-full rounded-lg shadow-lg"
                  src="https://youtube.com/embed/videoseries?list=PLgRcC-DFR5jcwwg0Dr3gNZrkZxkztraKE&controls=1&rel=0&modestbranding=1"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Features section */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Key Features</h2>
                <div className="grid gap-4">
                  {FEATURES.map((feature, index) => (
                    <Card
                      key={index}
                      className="p-4 border-0 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.01] overflow-hidden relative group bg-white rounded-md"
                    >
                      {/* Gradient background that shows on hover */}
                      <div
                        className={`absolute inset-0 opacity-0 bg-gradient-to-r ${feature.color} group-hover:opacity-5 transition-opacity duration-300`}
                      ></div>

                      <div className="flex items-start relative z-10">
                        <div
                          className={`shrink-0 mr-4 rounded-lg p-2 ${feature.bgLight} bg-opacity-80 transition-all duration-300 group-hover:scale-110`}
                        >
                          <div
                            className={`text-gradient bg-gradient-to-br ${feature.color}`}
                          >
                            {feature.icon}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">
                            {feature.title}
                          </h3>
                          <p className="text-gray-600 text-sm">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Pricing with Benefits Reminder */}
          <div>
            {/* Benefits Reminder Section */}
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg border border-violet-200 shadow-sm">
                <h3 className="text-xl font-semibold mb-3 text-violet-700">
                  Why Choose Note Companion?
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      AI-powered organization that saves hours of manual sorting
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Seamless integration with Obsidian that enhances your
                      workflow
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Convert handwritten notes and audio recordings to
                      searchable text
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      Chat with your documents using natural language
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <PricingCards />
          </div>
        </div>
      </main>

      <footer className="bg-gray-100 py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <a
            href="https://discord.gg/udQnCRFyus"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">Join our discord</Button>
          </a>
          <p className="mt-3 text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Nexus JPF Inc. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
