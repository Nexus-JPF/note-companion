'use client';

import * as React from 'react';
import { Link } from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Cloud, 
  CreditCard, 
  Server, 
  Key, 
  Settings, 
  LifeBuoy, 
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { useUser } from "@clerk/nextjs";

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  current?: boolean;
  requiresSubscription?: 'cloud' | boolean;
}

export function NavigationBar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [userSubscription, setUserSubscription] = React.useState({
    active: false,
    currentProduct: null as string | null
  });
  
  // Use useEffect to handle client-side mounting
  React.useEffect(() => {
    setMounted(true);
    
    // Fetch subscription status from the server if user is loaded
    if (isLoaded && user) {
      fetch('/api/user/subscription-status')
        .then(res => res.json())
        .then(data => {
          setUserSubscription({
            active: data.active,
            currentProduct: data.currentProduct
          });
        })
        .catch(err => {
          console.error('Error fetching subscription status:', err);
        });
    }
  }, [isLoaded, user]);
  
  // Base navigation items always shown
  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: <Home className="h-5 w-5" />, current: pathname === '/dashboard' },
    { 
      name: 'Sync', 
      href: '/dashboard/sync', 
      icon: <Cloud className="h-5 w-5" />, 
      current: pathname?.includes('/dashboard/sync') 
    },
    { 
      name: 'Pricing', 
      href: '/dashboard/pricing', 
      icon: <CreditCard className="h-5 w-5" />, 
      current: pathname?.includes('/dashboard/pricing') 
    },
  ];
  
  // Only add conditional navigation items if we're mounted and user is loaded
  if (mounted && isLoaded && user) {
    // Add API Keys for any subscriber
    if (userSubscription.active) {
      navigation.push({
        name: 'API Keys',
        href: '/dashboard/subscribers',
        icon: <Key className="h-5 w-5" />,
        current: pathname?.includes('/dashboard/subscribers'),
        requiresSubscription: true
      });
    }
  }
  
  // Settings and help are always shown at the end
  navigation.push(
    { 
      name: 'Settings', 
      href: '/dashboard/settings', 
      icon: <Settings className="h-5 w-5" />, 
      current: pathname?.includes('/dashboard/settings') 
    },
    { 
      name: 'Help', 
      href: 'https://discord.gg/udQnCRFyus', 
      icon: <LifeBuoy className="h-5 w-5" />, 
      current: false 
    }
  );

  return (
    <nav className="w-full bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              target={item.name === 'Help' ? "_blank" : undefined}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md relative",
                item.current ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {item.icon}
              <span className="ml-2">{item.name}</span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-purple-500 text-white text-xs justify-center items-center">
                    {item.badge}
                  </span>
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Mobile Navigation - Just show as a dropdown */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Menu
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {navigation.map((item) => (
                <DropdownMenuItem key={item.name} className="cursor-pointer" asChild>
                  <Link 
                    href={item.href} 
                    target={item.name === 'Help' ? "_blank" : undefined}
                    className="flex items-center w-full"
                  >
                    {item.icon}
                    <span className="ml-2">{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
