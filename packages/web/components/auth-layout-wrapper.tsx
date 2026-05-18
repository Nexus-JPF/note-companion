import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/nextjs';
import Logo from '@/components/ui/logo';
import { Toaster } from 'react-hot-toast';
import { NavigationBar } from '@/components/navigation-bar';
import { Link } from '@/components/ui/link';
import ExtraUserSettings from '@/components/user-management';
import { PHProvider } from '@/app/providers';

interface AuthLayoutWrapperProps {
  children: React.ReactNode;
}

export default function AuthLayoutWrapper({
  children,
}: AuthLayoutWrapperProps) {
  return (
    <PHProvider>
      <SignedIn>
        {/* SignedIn renders its children only when the user is signed in */}
        {/* The body tag is rendered by the root layout, we only render the content here */}
        <Toaster />
        <header className="p-4 bg-white sticky top-0 z-50 max-w-6xl mx-auto">
          <nav className="max-w-9xl mx-auto flex items-center space-x-6 justify-between w-full">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex-shrink-0">
                <Logo />
              </Link>
              <NavigationBar />
            </div>
            <div className="flex items-center gap-2">
              <ExtraUserSettings />
              <UserButton />
            </div>
          </nav>
        </header>
        <main className="min-h-screen text-stone-900 font-sans">
          {children} {/* Render the page content passed from layout */}
        </main>
      </SignedIn>
      <SignedOut>
        {/* SignedOut renders its children only when the user is signed out */}
        {/* The body tag is rendered by the root layout */}
        <Toaster />
        <main className="min-h-screen text-stone-900 font-sans">
          <div className="flex items-center justify-center h-screen">
            <SignIn /> {/* Show sign-in component when signed out */}
          </div>
        </main>
      </SignedOut>
    </PHProvider>
  );
}
