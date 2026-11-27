import { CustomerData } from '@/app/api/webhook/types';

interface LoopsEvent {
  email: string;
  firstName?: string;
  lastName?: string;
  userId: string;
  eventName: string;
  data?: Record<string, any>;
}

export async function trackLoopsEvent({
  email,
  firstName,
  lastName,
  userId,
  eventName,
  data = {}
}: LoopsEvent) {
  // Check for missing API key
  if (!process.env.LOOPS_API_KEY) {
    console.error('LOOPS_API_KEY is not set');
    return;
  }

  try {
    const response = await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        eventName,
        userId,
        firstName,
        lastName,
        userGroup: "StripeCustomers",
        ...data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // Handle "Multiple contacts" error by trying with just email
      // This can happen when there are duplicate contacts in Loops with the same userId
      if (errorData.message?.includes('Multiple contacts') && email) {
        console.warn(
          `Loops: Multiple contacts found for userId ${userId}, retrying with email only`
        );

        // Retry with just email (standard identifier)
        const retryResponse = await fetch('https://app.loops.so/api/v1/events/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
          },
          body: JSON.stringify({
            email, // Only send email, not userId
            eventName,
            firstName,
            lastName,
            userGroup: "StripeCustomers",
            ...data,
          }),
        });

        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          console.warn('Loops tracking failed (retry with email only):', retryErrorText);
        } else {
          console.log('Loops tracking succeeded with email only');
        }
      } else {
        // For other errors, log as error since Loops tracking failed
        console.error('Loops tracking failed:', errorText);
      }
    }
  } catch (error) {
    // Log but don't throw to prevent webhook processing from failing
    console.error('Error tracking Loops event:', error);
  }
}

export async function updateLoopsContactBillingCycle(
  email: string,
  billingCycle: string,
  userId?: string
): Promise<void> {
  if (!process.env.LOOPS_API_KEY) {
    console.error('LOOPS_API_KEY is not set');
    return;
  }

  try {
    const body: Record<string, string> = { email, billingCycle };
    if (userId) body.userId = userId;

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Loops contact update failed:', errorText);
    }
  } catch (error) {
    console.error('Error updating Loops contact billingCycle:', error);
  }
}
// Marketing consent
//
// Signing up lets us send onboarding emails about the product. Campaigns
// (newsletters, launches, promos) need explicit consent, which we record as
// membership of one Loops mailing list. Campaigns must target only that list.
// The list is created in the Loops dashboard (the API cannot create lists) and
// its id is set in LOOPS_MARKETING_LIST_ID.

export type MarketingConsentChoice = 'granted' | 'declined';

export interface MarketingConsentState {
  // false until the user has answered the opt-in prompt once
  decided: boolean;
  // true only while the contact is on the list and has not unsubscribed
  optedIn: boolean;
}

const LOOPS_API = 'https://app.loops.so/api/v1';

export function getMarketingListId(): string | undefined {
  return process.env.LOOPS_MARKETING_LIST_ID || undefined;
}

function loopsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
  };
}

async function findLoopsContactByEmail(
  email: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${LOOPS_API}/contacts/find?email=${encodeURIComponent(email)}`,
    { method: 'GET', headers: loopsHeaders() }
  );
  if (!response.ok) {
    throw new Error(`Loops contact lookup failed: ${await response.text()}`);
  }
  const contacts = (await response.json()) as Record<string, unknown>[];
  return contacts[0] ?? null;
}

export async function getLoopsMarketingConsent(
  email: string
): Promise<MarketingConsentState> {
  const listId = getMarketingListId();
  if (!process.env.LOOPS_API_KEY || !listId) {
    throw new Error('LOOPS_API_KEY or LOOPS_MARKETING_LIST_ID is not set');
  }

  const contact = await findLoopsContactByEmail(email);
  if (!contact) return { decided: false, optedIn: false };

  const choice = contact.marketingConsent;
  const lists = (contact.mailingLists ?? {}) as Record<string, boolean>;
  return {
    decided: choice === 'granted' || choice === 'declined',
    // An unsubscribe link in any email clears `subscribed` or the list, and
    // that wins over the stored choice.
    optedIn: lists[listId] === true && contact.subscribed !== false,
  };
}

export async function setLoopsMarketingConsent(
  email: string,
  optIn: boolean
): Promise<void> {
  const listId = getMarketingListId();
  if (!process.env.LOOPS_API_KEY || !listId) {
    throw new Error('LOOPS_API_KEY or LOOPS_MARKETING_LIST_ID is not set');
  }

  // contacts/update creates a missing contact, and a new contact gets emails
  // by default. A "no" from someone not yet in Loops is still recorded (so the
  // prompt does not come back), on a contact that gets no emails at all.
  const createUnsubscribed =
    !optIn && !(await findLoopsContactByEmail(email));

  const choice: MarketingConsentChoice = optIn ? 'granted' : 'declined';
  const body: Record<string, unknown> = {
    email,
    marketingConsent: choice,
    // When the choice was made: the record we keep as proof of consent
    marketingConsentAt: new Date().toISOString(),
    mailingLists: { [listId]: optIn },
  };
  // Opting in is an explicit request for email, so it also lifts an earlier
  // unsubscribe. Opting out leaves `subscribed` alone so onboarding emails
  // keep coming; the user can stop those with the link in any email.
  if (optIn) body.subscribed = true;
  if (createUnsubscribed) body.subscribed = false;

  const response = await fetch(`${LOOPS_API}/contacts/update`, {
    method: 'PUT',
    headers: loopsHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Loops consent update failed: ${await response.text()}`);
  }

  if (optIn) {
    // Loops ignores a list add for someone who left that list from its
    // preference page. Report that as a failure rather than a false "saved".
    const contact = await findLoopsContactByEmail(email);
    const lists = (contact?.mailingLists ?? {}) as Record<string, boolean>;
    if (lists[listId] !== true || contact?.subscribed === false) {
      throw new Error('Loops did not add the contact to the marketing list');
    }
  }
}
