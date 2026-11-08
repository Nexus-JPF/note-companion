import React from 'react';
import { Metadata } from 'next';
import { defaultOpenGraph } from '@/lib/og';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using Note Companion, including licensing, paid plans, and content ownership.',
  alternates: {
    canonical: '/terms-of-service',
  },
  openGraph: {
    ...defaultOpenGraph,
    title: 'Terms of Service',
    description:
      'The terms for using Note Companion, including licensing, paid plans, and content ownership.',
    url: '/terms-of-service',
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <div className="prose lg:prose-xl">
        <p className="mb-4">
          These are the basic terms for using Note Companion AI. We've kept them
          simple and clear.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Our Software</h2>
        <p className="mb-4">
          Note Companion is available as open-source software under the MIT
          license. The source code is available at{' '}
          <a
            href="https://github.com/Nexus-JPF/note-companion"
            className="text-blue-600 hover:underline"
          >
            github.com/Nexus-JPF/note-companion
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Using Our Service</h2>
        <p className="mb-4">
          We provide paid services with different tiers. Our pricing is
          transparent and available on our website. Each plan provides access to
          features with corresponding usage limits. Paid plans provide expanded
          features and higher usage limits.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Your Content</h2>
        <p className="mb-4">
          You own your content. We need permission to process it to provide our
          service, but we don't claim ownership of your notes, documents, or
          data. We do not sell your data or use it to train AI models.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">
          Account Responsibilities
        </h2>
        <p className="mb-4">
          Please keep your account information secure and accurate. You're
          responsible for activity that happens under your account.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Fair Use</h2>
        <p className="mb-4">
          Please use our service responsibly. Don't attempt to reverse engineer
          or break the service, and don't use it for illegal activities or to
          harm others.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Privacy</h2>
        <p className="mb-4">
          We respect your privacy. For details on how we collect and use data,
          please see our{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">
          Open Source Components
        </h2>
        <p className="mb-4">
          Our service includes open source software. We respect the licenses of
          these components, and we encourage contributions to both our project
          and the wider open source community.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Changes</h2>
        <p className="mb-4">
          We may update these terms from time to time to reflect changes to our
          service or regulations. We'll notify you of significant changes via
          email or our website.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-3">Contact Us</h2>
        <p className="mb-6">
          If you have questions about these terms, please contact us at{' '}
          <a
            href="mailto:info@notecompanion.ai"
            className="text-blue-600 hover:underline"
          >
            info@notecompanion.ai
          </a>
          .
        </p>

        <div className="text-sm text-gray-600 mt-8 border-t pt-4">
          Last updated: 2026-01-11
        </div>
      </div>
    </div>
  );
}
