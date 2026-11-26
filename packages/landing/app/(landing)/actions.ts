'use server';

// "Product updates" list: the only list marketing campaigns go to. Only people
// who ticked the opt-in box (here, in the web dashboard or in the plugin) join it.
const PRODUCT_UPDATES_LIST_ID = 'cm2a922wi00t20lk17m35026r';

// Contact fields that record an explicit opt-in, as the web app writes them
function productUpdatesConsent(optIn: boolean) {
  return optIn
    ? {
        marketingConsent: 'granted',
        marketingConsentAt: new Date().toISOString(),
      }
    : {};
}

interface SubmitBetaRequestResult {
  success: boolean;
  message?: string;
}

export async function submitBetaRequest(
  email: string,
  source: string = 'mobile_beta_signup',
  // Unticked by default; true only when the visitor ticked the box
  productUpdates: boolean = false
): Promise<SubmitBetaRequestResult> {
  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Please enter a valid email address'
    };
  }

  const isAndroid = source === 'android_waitlist';

  try {
    const apiKey = process.env.LOOPS_API_KEY;
    if (!apiKey) {
      console.error('LOOPS_API_KEY environment variable is not set');
      return {
        success: false,
        message: 'Server configuration error. Please try again later.'
      };
    }

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        email,
        subscribed: true,
        // Android signups stay off the Mobile App list so they do not get iPhone emails
        userGroup: isAndroid ? 'AndroidWaitlist' : 'MobileUsers',
        source,
        ...productUpdatesConsent(productUpdates === true),
        mailingLists: {
          ...(isAndroid ? {} : { "cm8qkg9g9015e0it80bmo4baz": true }),
          ...(productUpdates === true ? { [PRODUCT_UPDATES_LIST_ID]: true } : {}),
        },
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        message: 'Thank you for joining the beta waitlist!'
      };
    } else {
      console.error('Loops API error:', data);
      return {
        success: false,
        message: data.message || 'Something went wrong. Please try again.'
      };
    }
  } catch (error) {
    console.error('Error submitting beta request:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.'
    };
  }
}    
export async function submitProWaitlist(
  email: string,
  billing: 'monthly' | 'yearly',
  featureRequest?: string,
  // The visitor's PostHog id (not an account id): lets Loops link the signup to analytics
  analyticsId?: string,
  // Unticked by default; true only when the visitor ticked the box
  productUpdates: boolean = false
): Promise<SubmitBetaRequestResult> {
  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Please enter a valid email address'
    };
  }

  try {
    const apiKey = process.env.LOOPS_API_KEY;
    if (!apiKey) {
      console.error('LOOPS_API_KEY environment variable is not set');
      return {
        success: false,
        message: 'Server configuration error. Please try again later.'
      };
    }

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        email,
        subscribed: true,
        userGroup: 'ProWaitlist',
        source: 'pro_waitlist_pricing',
        proWaitlistBilling: billing,
        ...(featureRequest ? { proWaitlistFeatureRequest: featureRequest } : {}),
        ...(analyticsId ? { proWaitlistUserId: analyticsId } : {}),
        ...productUpdatesConsent(productUpdates === true),
        mailingLists: {
          "cmuddxgi61q9l0j0wdf7d65mn": true,
          ...(productUpdates === true ? { [PRODUCT_UPDATES_LIST_ID]: true } : {}),
        }
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        message: "You're on the Pro waitlist. We'll email you when it opens."
      };
    } else {
      console.error('Loops API error:', data);
      return {
        success: false,
        message: data.message || 'Something went wrong. Please try again.'
      };
    }
  } catch (error) {
    console.error('Error submitting Pro waitlist request:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.'
    };
  }
}
