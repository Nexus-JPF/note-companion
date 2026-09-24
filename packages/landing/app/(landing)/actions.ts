'use server';

interface SubmitBetaRequestResult {
  success: boolean;
  message?: string;
}

export async function submitBetaRequest(email: string): Promise<SubmitBetaRequestResult> {
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
        userGroup: 'MobileUsers', // Assign users to the MobileUsers group
        source: 'mobile_beta_signup',
        mailingLists: {
          "cm8qkg9g9015e0it80bmo4baz": true
        }
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
  userId?: string
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
        ...(userId ? { proWaitlistUserId: userId } : {}),
        mailingLists: {
          "cmuddxgi61q9l0j0wdf7d65mn": true
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
