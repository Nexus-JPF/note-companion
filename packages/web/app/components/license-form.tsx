'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { createLicenseKey, isPaidUser } from '../actions';
import CheckoutButton from '@/components/ui/checkout-button';
import { useUser } from '@clerk/nextjs';
import { Copy, Check } from 'lucide-react';

const LicenseForm = () => {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { user } = useUser();

  // Load key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('noteCompanionLicenseKey');
      if (storedKey) {
        setLicenseKey(storedKey);
      }
    }
  }, []);

  const handleCreateKey = async () => {
    setLoading(true);
    try {
      const res = await createLicenseKey();
      if ('error' in res) {
        alert(res.error);
        return;
      }
      if ('key' in res && res.key?.key) {
        const newKey = res.key.key;
        setLicenseKey(newKey);
        // Store in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('noteCompanionLicenseKey', newKey);
        }
      } else {
        alert(
          'Failed to create license key. Please try again or contact support.'
        );
        console.error('Unexpected response format:', res);
      }
    } catch (error: unknown) {
      // Handle Server Action deployment mismatch errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Failed to find Server Action') ||
        errorMessage.includes('workers')
      ) {
        alert(
          'The application was recently updated. Please refresh the page and try again.'
        );
      } else {
        console.error('Error creating license key:', error);
        alert(`Error creating license key: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (licenseKey) {
      try {
        await navigator.clipboard.writeText(licenseKey);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy key:', error);
      }
    }
  };

  useEffect(() => {
    const handleSetIsPaidUser = async () => {
      if (!user) return;
      try {
        const isPaid = await isPaidUser();
        setIsPaid(isPaid);
      } catch (error: unknown) {
        // Handle Server Action deployment mismatch errors silently
        // Don't show alert for this background check
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes('Failed to find Server Action') &&
          !errorMessage.includes('workers')
        ) {
          console.error('Error checking paid user status:', error);
        }
      }
    };
    handleSetIsPaidUser();
  }, [user]);

  return (
    <div className="mt-8 flex flex-col">
      {isPaid ? (
        <>
          {licenseKey && licenseKey.length > 0 ? (
            <>
              <Card className="w-full mt-8 rounded-lg border-2 border-purple-200">
                <CardHeader className="pb-4">
                  <CardDescription className="text-center text-base font-semibold text-purple-700">
                    Your License Key
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-6">
                  <div className="flex flex-col space-y-4">
                    <div className="flex gap-3 px-2">
                      <Input
                        name="licenseKey"
                        value={licenseKey}
                        readOnly
                        className="font-mono text-sm flex-1"
                      />
                      <Button
                        onClick={() => { void handleCopyKey(); }}
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {copied
                        ? 'Copied to clipboard!'
                        : 'Click the copy button to copy your key'}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center pt-4 pb-6 px-2">
                  <Button
                    onClick={() => { void handleCreateKey(); }}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? 'Generating...' : 'Create New Key'}
                  </Button>
                </CardFooter>
                <CardDescription className="text-center text-xs px-6 pb-6">
                  Save this key securely. You can create additional keys if
                  needed.
                </CardDescription>
              </Card>
            </>
          ) : (
            <>
              <Card className="w-full bg-transparent">
                <CardHeader></CardHeader>
                <CardFooter className="flex justify-center">
                  <Button
                    onClick={() => { void handleCreateKey(); }}
                    disabled={loading}
                    className="w-full mt-4 bg-purple-500 hover:bg-purple-600 text-white"
                    variant="default"
                  >
                    {loading ? 'Generating Key...' : 'Create License Key'}
                  </Button>
                </CardFooter>
                <CardDescription className="text-center px-6 pb-4">
                  <p className="mb-2">
                    You'll need this key to unlock Note Companion in your plugin
                    settings.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    If you already have a key, you can create a new one. Both
                    keys will work.
                  </p>
                </CardDescription>
              </Card>
            </>
          )}
        </>
      ) : (
        <div className="text-center">
          <div className="mt-6">
            <CheckoutButton />
          </div>
        </div>
      )}
    </div>
  );
};

export { LicenseForm };
