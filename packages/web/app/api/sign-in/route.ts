import { NextRequest, NextResponse } from "next/server";
import { clerkClient, auth } from "@clerk/nextjs/server";
import { createLicenseKeyFromUserId } from "@/app/actions";
import { createEmptyUserUsage } from "@/drizzle/schema";
import { isRateLimited } from "@/lib/auth-rate-limit";
import { captureServerEvent } from "@/lib/server-analytics";

const DASHBOARD_URL = "https://app.notecompanion.ai/dashboard";

// One generic message for every credential failure (unknown email, wrong
// password, passwordless/social account) so account existence is not leaked.
const INVALID_CREDENTIALS_ERROR = `Signed up with Google or another social login? There is no password to enter: sign in at ${DASHBOARD_URL} and copy your license key from there. Otherwise, check your email and password.`;

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 20;
const MAX_ATTEMPTS_PER_EMAIL = 5;

function invalidCredentials() {
  return NextResponse.json(
    { success: false, error: INVALID_CREDENTIALS_ERROR },
    { status: 400 }
  );
}

// Failures are counted anonymously (no email, no person profile) with an
// internal-only reason, so social-login attempts show up without being
// revealed to the caller.
async function failedSignIn(reason: string) {
  await captureServerEvent("plugin_signin_failed", { reason });
  return invalidCredentials();
}

export async function POST(req: NextRequest) {
  try {
    // Development convenience: reuse the current Clerk session if present.
    if (process.env.NODE_ENV === "development") {
      const { userId } = await auth();
      if (userId) {
        const result = await createLicenseKeyFromUserId(userId);
        if ("error" in result) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          licenseKey: result.key.key,
          userId,
          message: "Development mode: Using current session",
        });
      }
    }

    let body: { email?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (
      isRateLimited(`sign-in:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS) ||
      isRateLimited(`sign-in:email:${email}`, MAX_ATTEMPTS_PER_EMAIL, WINDOW_MS)
    ) {
      await captureServerEvent("plugin_signin_failed", { reason: "rate_limited" });
      return NextResponse.json(
        {
          success: false,
          error: "Too many sign-in attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({
      emailAddress: [email],
    });
    const user = users[0];

    // Passwordless (social-login) users cannot be verified here and get the
    // same generic error; they are pointed at the web dashboard instead.
    if (!user) {
      return failedSignIn("no_account");
    }
    if (!user.passwordEnabled) {
      return failedSignIn("social_account");
    }

    try {
      const result = await clerk.users.verifyPassword({
        userId: user.id,
        password,
      });
      if (!result?.verified) return failedSignIn("wrong_password");
    } catch (error: any) {
      // Clerk rejects wrong passwords with a 4xx; treat anything else as a server error.
      const status = error?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        return failedSignIn("wrong_password");
      }
      throw error;
    }

    const licenseKeyResult = await createLicenseKeyFromUserId(user.id);
    if ("error" in licenseKeyResult) {
      return NextResponse.json(
        { success: false, error: licenseKeyResult.error },
        { status: 500 }
      );
    }

    await createEmptyUserUsage(user.id);
    await captureServerEvent("plugin_signin_succeeded", {}, user.id);

    return NextResponse.json({
      success: true,
      licenseKey: licenseKeyResult.key.key,
      userId: user.id,
    });
  } catch (error) {
    // Deliberately no email/credentials in logs.
    console.error(
      "Error during sign in:",
      error instanceof Error ? error.name : "unknown"
    );
    return NextResponse.json(
      { success: false, error: "An error occurred during sign in" },
      { status: 500 }
    );
  }
}
