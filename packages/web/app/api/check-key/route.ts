import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/handleAuthorization';
import { Unkey } from '@unkey/api';

export async function POST(request: NextRequest) {
  try {
    // Skip key verification if user management is disabled
    // This allows self-hosting without Unkey setup
    if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
      return NextResponse.json(
        {
          message: 'Valid key',
          userId: 'user',
        },
        { status: 200 }
      );
    }

    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    // Only verify the key validity - don't check subscription or token usage
    // This endpoint is specifically for license key validation in settings
    // Unkey v2: Use direct API call for key verification (most reliable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any = null;
    let error: Error | null = null;

    try {
      // Unkey v2: verifyKey is a method on the Unkey instance
      // It takes an object with 'key' property, not just the key string
      // Note: For key verification, we might not need rootKey - the key itself is verified
      // But the SDK might need it for the API call
      const rootKey = process.env.UNKEY_ROOT_KEY || '';
      const unkey = new Unkey({
        rootKey: rootKey,
      });

      if (!rootKey) {
        console.warn('UNKEY_ROOT_KEY not set - key verification may fail');
      }

      // Log available methods for debugging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unkeyAny = unkey as any;

      // Check if there's a public keys getter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let keysService: any = null;
      try {
        // Try accessing keys property (might be a getter)
        keysService = unkeyAny.keys;
      } catch (e) {
        // Ignore
      }

      console.log('Unkey instance structure:', {
        hasVerifyKey: typeof unkeyAny.verifyKey === 'function',
        hasKeys: !!unkeyAny.keys,
        keysType: typeof keysService,
        keysServiceKeys: keysService ? Object.keys(keysService) : [],
        hasKeysVerify: typeof keysService?.verify === 'function',
        hasKeysVerifyKey: typeof keysService?.verifyKey === 'function',
        has_Keys: !!unkeyAny._keys,
        _keysType: typeof unkeyAny._keys,
        _keysKeys: unkeyAny._keys ? Object.keys(unkeyAny._keys) : [],
        allKeys: Object.keys(unkeyAny),
      });

      // Try different possible methods
      // v1 uses keys.verify, v2 uses keys.verifyKey
      // Try keys.verify first (v1 method) to match v1 behavior
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (keysService && typeof keysService.verify === 'function') {
        console.log('Trying keys.verify method (v1 style)...');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response = await keysService.verify({ key: token });
          console.log(
            'keys.verify response:',
            response ? 'got response' : 'no response'
          );
        } catch (err) {
          console.log('keys.verify failed, trying verifyKey...');
        }
      }

      // If verify didn't work, try verifyKey (v2 method)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!response && typeof unkeyAny.verifyKey === 'function') {
        console.log('Trying verifyKey method...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await unkeyAny.verifyKey({ key: token });
        console.log(
          'verifyKey response:',
          response ? 'got response' : 'no response'
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (
        !response &&
        keysService &&
        typeof keysService.verifyKey === 'function'
      ) {
        console.log('Trying keys.verifyKey method...');
        try {
          // v2 requires apiId OR root key with api.*.verify_key permissions
          // Since v1 worked without special permissions, we should include apiId
          // This matches v1's behavior where apiId was required
          const apiId = process.env.UNKEY_API_ID;
          const verifyParams: { key: string; apiId?: string } = { key: token };

          if (apiId) {
            verifyParams.apiId = apiId;
            console.log(
              'Calling verifyKey WITH apiId (v2 requires this or special permissions):',
              {
                key: token.substring(0, 10) + '...',
                apiId,
              }
            );
          } else {
            console.log(
              'Calling verifyKey WITHOUT apiId (requires root key with api.*.verify_key permissions):',
              {
                key: token.substring(0, 10) + '...',
              }
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response = await keysService.verifyKey(verifyParams);
          console.log('verifyKey returned:', {
            hasResponse: !!response,
            responseType: typeof response,
            responseKeys: response ? Object.keys(response) : [],
          });
          console.log(
            'keys.verifyKey response:',
            response ? 'got response' : 'no response'
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (verifyError: any) {
          // The SDK throws an error when Authorization is missing
          // But the error structure contains the API response
          console.log(
            'keys.verifyKey error caught:',
            verifyError?.statusCode,
            verifyError?.body
          );
          // The error might contain the response in a different format
          // Check if we can extract valid/invalid from the error
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((verifyError as any)?.error) {
            // This is the v2 error format - use it as response
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response = verifyError as any;
            console.log('Using error object as response');
          } else {
            // Re-throw if we can't extract response
            throw verifyError;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (keysService && typeof keysService.verify === 'function') {
        console.log('Trying keys.verify method...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await keysService.verify({ key: token });
        console.log(
          'keys.verify response:',
          response ? 'got response' : 'no response'
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (
        unkeyAny._keys &&
        typeof unkeyAny._keys.verifyKey === 'function'
      ) {
        console.log('Trying _keys.verifyKey method...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await unkeyAny._keys.verifyKey({ key: token });
        console.log(
          '_keys.verifyKey response:',
          response ? 'got response' : 'no response'
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (
        unkeyAny._keys &&
        typeof unkeyAny._keys.verify === 'function'
      ) {
        console.log('Trying _keys.verify method...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await unkeyAny._keys.verify({ key: token });
        console.log(
          '_keys.verify response:',
          response ? 'got response' : 'no response'
        );
      } else {
        console.log('SDK methods not found, trying direct API call...');
        // Fallback: Direct HTTP API call to Unkey v2
        // Try different endpoint formats
        const verifyUrls = [
          'https://api.unkey.com/v2/keys/verify-api-key',
          'https://api.unkey.com/v1/keys/verify',
          'https://api.unkey.com/v1/key/verify',
        ];

        let lastError: Error | null = null;
        for (const verifyUrl of verifyUrls) {
          try {
            console.log(`Trying API endpoint: ${verifyUrl}`);
            const apiResponse = await fetch(verifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ key: token }),
            });

            if (apiResponse.ok) {
              response = await apiResponse.json();
              console.log('Direct API call succeeded');
              break;
            } else {
              const errorText = await apiResponse.text();
              console.log(`API endpoint ${verifyUrl} failed:`, {
                status: apiResponse.status,
                body: errorText,
              });
              lastError = new Error(`Unkey API error: ${apiResponse.status}`);
            }
          } catch (fetchError) {
            console.error(`Error calling ${verifyUrl}:`, fetchError);
            lastError =
              fetchError instanceof Error
                ? fetchError
                : new Error('Unknown fetch error');
          }
        }

        if (!response && lastError) {
          throw lastError;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Unkey verification error:', error);
    }

    // Handle v2 response format (wrapped in data) or v1 format (direct result)
    // The SDK error object has data$ field with the actual response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extractedError: any = null;

    if (response) {
      // Check if response has data$ (SDK internal format from error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((response as any).data$) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (response as any).data$;
        result = data.data || data.result;
        extractedError = data.error;
      } else if ('data' in response) {
        // Standard v2 format
        result = response.data;
        extractedError = response.error;
      } else if ('result' in response) {
        // v1 format
        result = response.result;
        extractedError = response.error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if ((response as any).error) {
        // Error-only response (from SDK error)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractedError = (response as any).error;
        // If there's no data, the key is invalid
        result = { valid: false };
      }
    }

    // Log the actual response structure for debugging
    console.log('Response extraction details:', {
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : [],
      hasData: response ? 'data' in response : false,
      hasResult: response ? 'result' in response : false,
      dataKeys:
        response && 'data' in response ? Object.keys(response.data) : [],
      resultKeys: result ? Object.keys(result) : [],
      resultContent: result,
    });

    if (extractedError || !response || !result || !result.valid) {
      console.log('Key verification failed:', {
        hasResponse: !!response,
        hasResult: !!result,
        resultValid: result?.valid,
        error: extractedError?.message || extractedError?.detail,
        responseKeys: response ? Object.keys(response) : [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasData$: response ? !!(response as any).data$ : false,
      });
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'Please provide a valid license key',
        },
        { status: 401 }
      );
    }

    // Key is valid - return success
    // Note: We don't check subscription status here because this endpoint
    // is only for validating that the key format/structure is correct
    // Extract userId from v2 format (identity.externalId) or v1 format (ownerId)
    const userId =
      result?.identity?.externalId || result?.identity?.id || result?.ownerId;
    return NextResponse.json(
      {
        message: 'Valid key',
        userId: userId || 'unknown',
      },
      { status: 200 }
    );
  } catch (error) {
    console.log('Error checking key', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }
}
