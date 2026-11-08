import { NextRequest, NextResponse } from "next/server";
import { clerkClient, auth } from "@clerk/nextjs/server";
import { createLicenseKeyFromUserId } from "@/lib/account-server";
import { createEmptyUserUsage, initializeTierConfig } from "@/drizzle/schema";
import { isRateLimited } from "@/lib/auth-rate-limit";
import { captureServerEvent } from "@/lib/server-analytics";

export async function POST(req: NextRequest) {
  try {
    // Initialize tier configurations if they don't exist
    await initializeTierConfig();

    // For development mode, we'll use the current auth session if available
    const authResult = await auth();
    const userId = authResult.userId;

    // If we're in development mode and have a userId, use it
    if (process.env.NODE_ENV === 'development' && userId) {
      const licenseKeyResult = await createLicenseKeyFromUserId(userId);

      if ('error' in licenseKeyResult) {
        return NextResponse.json({
          success: false,
          error: licenseKeyResult.error,
        }, { status: 500 });
      }

      // Create empty usage for this user if needed - initialized with legacy plan
      await createEmptyUserUsage(userId);

      return NextResponse.json({
        success: true,
        licenseKey: licenseKeyResult.key.key,
        userId,
        message: "Development mode: Using current session",
      });
    }

    // For production, we'll need to actually create the user
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: "Email and password are required",
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: "Invalid email format",
      }, { status: 400 });
    }

    // Validate password requirements (Clerk typically requires min 8 chars)
    if (password.length < 8) {
      return NextResponse.json({
        success: false,
        error: "Password must be at least 8 characters long",
      }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (isRateLimited(`sign-up:ip:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Check if user already exists - handle clerkClient as a function
    const clerk = await clerkClient();
    const existingUsersResponse = await clerk.users.getUserList({
      emailAddress: [email],
    });


    // Access the data property which contains the array of users
    if (existingUsersResponse.data && existingUsersResponse.data.length > 0) {
      return NextResponse.json({
        success: false,
        error: "A user with this email already exists",
      }, { status: 400 });
    }

    // Create the user in Clerk
    const user = await clerk.users.createUser({
      emailAddress: [email],
      password,
    });

    // Generate a license key for the new user
    const licenseKeyResult = await createLicenseKeyFromUserId(user.id);

    if ('error' in licenseKeyResult) {
      return NextResponse.json({
        success: false,
        error: licenseKeyResult.error,
      }, { status: 500 });
    }

    // Create empty usage for this user
    await createEmptyUserUsage(user.id);
    await captureServerEvent("plugin_account_created", {}, user.id);

    return NextResponse.json({
      success: true,
      licenseKey: licenseKeyResult.key.key,
      userId: user.id,
    });
  } catch (error: any) {
    console.error("Error creating user:", error?.name);

    // Log only error codes (not full payloads, which can echo the email)
    if (error.clerkError && error.errors) {
      console.error("Clerk error codes:", error.errors.map((e: any) => e.code));
    }

    // If it's a Clerk error, return the actual error details
    if (error.clerkError) {
      const statusCode = error.status || 500;
      const errorMessage = error.errors?.[0]?.message || error.message || "An error occurred while creating your account";

      return NextResponse.json({
        success: false,
        error: errorMessage,
      }, { status: statusCode });
    }

    return NextResponse.json({
      success: false,
      error: "An error occurred while creating your account",
    }, { status: 500 });
  }
}
