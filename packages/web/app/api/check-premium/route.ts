import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticateUser } from "@/lib/authenticate-user";
import { db, UserUsageTable } from "@/drizzle/schema";

export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateUser(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Self-hosted installs have no billing, so there is nothing to gate on.
    if (process.env.ENABLE_USER_MANAGEMENT !== "true") {
      return NextResponse.json({ hasCatalystAccess: true });
    }

    const [usage] = await db
      .select({ hasCatalystAccess: UserUsageTable.hasCatalystAccess })
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    return NextResponse.json({
      hasCatalystAccess: usage?.hasCatalystAccess ?? false,
    });
  } catch (error) {
    console.error("Error checking catalyst access:", error);
    return NextResponse.json(
      { error: "Failed to check premium status" },
      { status: 500 }
    );
  }
}
