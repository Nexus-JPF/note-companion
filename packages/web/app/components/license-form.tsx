"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { createLicenseKey, isPaidUser } from "../actions";
import CheckoutButton from "@/components/ui/checkout-button";
import { useUser } from "@clerk/nextjs";

const LicenseForm = () => {
  const [licenseKey, setLicenseKey] = useState<string>("");
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user } = useUser();

  const handleCreateKey = async () => {
    setLoading(true);
    try {
      const res = await createLicenseKey();
      if ('error' in res) {
        alert(res.error);
        return;
      }
      if ('key' in res && res.key?.key) {
        setLicenseKey(res.key.key);
      } else {
        alert('Failed to create license key. Please try again or contact support.');
        console.error('Unexpected response format:', res);
      }
    } catch (error) {
      console.error('Error creating license key:', error);
      alert(`Error creating license key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleSetIsPaidUser = async () => {
      if (!user) return;
      const isPaid = await isPaidUser(user.id);
      setIsPaid(isPaid);
    };
    handleSetIsPaidUser();
  }, [user]);

  return (
    <div className="mt-8 flex flex-col">
      {isPaid ? (
        <>
          <Card className="w-full bg-transparent">
            <CardHeader></CardHeader>
            <CardFooter className="flex justify-center">
              <Button
                onClick={handleCreateKey}
                disabled={loading}
                className="w-full mt-4 bg-purple-500 hover:bg-purple-600 text-white"
                variant="default"
              >
                {loading ? "Generating Key..." : "Create Key"}
              </Button>
            </CardFooter>
            <CardDescription className="text-center">
              You'll need it to unlock Note Companion in your plugin
              settings.
            </CardDescription>
          </Card>
          {licenseKey && licenseKey.length > 0 && (
            <>
              <Card className="w-full mt-8 rounded-lg">
                <CardContent>
                  <div className="grid items-center w-full gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Input name="name" value={licenseKey} />
                    </div>
                  </div>
                </CardContent>
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
