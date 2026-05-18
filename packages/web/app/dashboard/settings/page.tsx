"use client";

import { tw } from "@/lib/utils";
import { StyledContainer } from "@/components/ui/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import {
  CreditCard,
  Settings as SettingsIcon,
  Bell,
  Shield,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <StyledContainer>
      <div className={tw("max-w-5xl mx-auto space-y-8 p-6")}>
        <div className={tw("flex items-center")}>
          <h1 className={tw("text-3xl font-bold text-gray-900")}>Settings</h1>
        </div>

        <div className={tw("grid grid-cols-1 md:grid-cols-2 gap-6")}>
          <Card
            className={tw(
              "w-full border-violet-100 border bg-white rounded-xl hover:border-violet-200 transition-all"
            )}
          >
            <CardHeader className={tw("pb-2")}>
              <div className={tw("flex items-center")}>
                <div className={tw("bg-violet-100 p-2 rounded-lg mr-3")}>
                  <CreditCard className={tw("h-5 w-5 text-violet-600")} />
                </div>
                <CardTitle className={tw("text-xl font-semibold")}>
                  Billing & Subscription
                </CardTitle>
              </div>
              <CardDescription className={tw("pt-1")}>
                Manage your plan and payment details
              </CardDescription>
            </CardHeader>

            <CardContent className={tw("pt-4")}>
              <Button
                className={tw(
                  "bg-violet-50 text-violet-700 hover:bg-violet-100 border-none"
                )}
                variant="outline"
                asChild
              >
                <a href={process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL}>
                  Manage Subscription
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card
            className={tw(
              "w-full border-violet-100 border bg-white rounded-xl hover:border-violet-200 transition-all"
            )}
          >
            <CardHeader className={tw("pb-2")}>
              <div className={tw("flex items-center")}>
                <div className={tw("bg-violet-100 p-2 rounded-lg mr-3")}>
                  <Key className={tw("h-5 w-5 text-violet-600")} />
                </div>
                <CardTitle className={tw("text-xl font-semibold")}>
                  License key
                </CardTitle>
              </div>
              <CardDescription className={tw("pt-1")}>
                View or create your license key for the Obsidian plugin
              </CardDescription>
            </CardHeader>

            <CardContent className={tw("pt-4")}>
              <Button
                className={tw(
                  "bg-violet-50 text-violet-700 hover:bg-violet-100 border-none"
                )}
                variant="outline"
                asChild
              >
                <Link href="/dashboard/subscribers">API Keys & license</Link>
              </Button>
            </CardContent>
          </Card>

          <Card
            className={tw(
              "w-full border-violet-100 border bg-white rounded-xl hover:border-violet-200 transition-all"
            )}
          >
            <CardHeader className={tw("pb-2")}>
              <div className={tw("flex items-center")}>
                <div className={tw("bg-violet-100 p-2 rounded-lg mr-3")}>
                  <Bell className={tw("h-5 w-5 text-violet-600")} />
                </div>
                <CardTitle className={tw("text-xl font-semibold")}>
                  Notifications
                </CardTitle>
              </div>
              <CardDescription className={tw("pt-1")}>
                Configure your notification preferences
              </CardDescription>
            </CardHeader>

            <CardContent className={tw("pt-4")}>
              <Button
                className={tw(
                  "bg-violet-50 text-violet-700 hover:bg-violet-100 border-none"
                )}
                variant="outline"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card
            className={tw(
              "w-full border-violet-100 border bg-white rounded-xl hover:border-violet-200 transition-all"
            )}
          >
            <CardHeader className={tw("pb-2")}>
              <div className={tw("flex items-center")}>
                <div className={tw("bg-violet-100 p-2 rounded-lg mr-3")}>
                  <Shield className={tw("h-5 w-5 text-violet-600")} />
                </div>
                <CardTitle className={tw("text-xl font-semibold")}>
                  Security
                </CardTitle>
              </div>
              <CardDescription className={tw("pt-1")}>
                Manage your account security settings
              </CardDescription>
            </CardHeader>

            <CardContent className={tw("pt-4")}>
              <Button
                className={tw(
                  "bg-violet-50 text-violet-700 hover:bg-violet-100 border-none"
                )}
                variant="outline"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card
            className={tw(
              "w-full border-violet-100 border bg-white rounded-xl hover:border-violet-200 transition-all"
            )}
          >
            <CardHeader className={tw("pb-2")}>
              <div className={tw("flex items-center")}>
                <div className={tw("bg-violet-100 p-2 rounded-lg mr-3")}>
                  <SettingsIcon className={tw("h-5 w-5 text-violet-600")} />
                </div>
                <CardTitle className={tw("text-xl font-semibold")}>
                  Preferences
                </CardTitle>
              </div>
              <CardDescription className={tw("pt-1")}>
                Customize your application preferences
              </CardDescription>
            </CardHeader>

            <CardContent className={tw("pt-4")}>
              <Button
                className={tw(
                  "bg-violet-50 text-violet-700 hover:bg-violet-100 border-none"
                )}
                variant="outline"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </StyledContainer>
  );
}
