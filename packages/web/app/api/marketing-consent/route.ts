import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/authenticate-user';
import {
  getMarketingConsentForUser,
  setMarketingConsentForUser,
} from '@/lib/marketing-consent-server';

// Marketing email opt-in for the Obsidian plugin (API key) and the web
// (Clerk session). Free users can answer too, so no active plan is required.
//
// GET  -> { available: false } | { available: true, decided, optedIn }
// POST { optIn: boolean } -> { success }

export async function GET(req: NextRequest) {
  const userId = await authenticateUser(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Self-hosted instances have no real user ('user') and no Loops audience
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    return NextResponse.json({ available: false });
  }
  const state = await getMarketingConsentForUser(userId);
  if (!state) return NextResponse.json({ available: false });
  return NextResponse.json({ available: true, ...state });
}

export async function POST(req: NextRequest) {
  const userId = await authenticateUser(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Not available on this server' },
      { status: 404 }
    );
  }

  let optIn: unknown;
  try {
    ({ optIn } = await req.json());
  } catch {
    optIn = undefined;
  }
  if (typeof optIn !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'optIn must be a boolean' },
      { status: 400 }
    );
  }

  const success = await setMarketingConsentForUser(userId, optIn);
  return NextResponse.json({ success }, { status: success ? 200 : 502 });
}
