import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { PHProvider } from './providers';
import AuthLayoutWrapper from '@/components/auth-layout-wrapper';

import './globals.css';
import { Link } from '@/components/ui/link';
import ExtraUserSettings from '@/components/user-management';

export const metadata: Metadata = {
  title: 'Note Companion - Dashboard',
  description: 'Manage your account',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enableUserManagement = process.env.ENABLE_USER_MANAGEMENT === 'true';
  const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!enableUserManagement || !hasClerkKey) {
    return (
      <html lang="en" className="light">
        <body className="light">{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en" className="light">
        <body className="light">
          <PHProvider>
            <AuthLayoutWrapper>{children}</AuthLayoutWrapper>
          </PHProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body>
//         {/* <Toaster /> */}
//         <header className="p-4 border-b border-stone-300">
//           <nav className="max-w-9xl mx-auto flex items-center space-x-6 justify-between w-full">
//             {/* <Logo /> */}
//           </nav>
//         </header>
//         <main className="min-h-screen text-stone-900 font-sans">{children}</main>
//       </body>
//     </html>
//   );
// }
