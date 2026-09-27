import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Metadata } from 'next';
import Providers from './providers';
import { OrganizationSchema } from '@/components/organization-schema';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://notecompanion.ai')
  ),
  title: {
    default: 'Note Companion',
    template: '%s | Note Companion',
  },
  description: 'Your AI-powered assistant for Obsidian.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background" suppressHydrationWarning>
        <OrganizationSchema />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
