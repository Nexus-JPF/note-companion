import { Unkey } from '@unkey/api';

export interface UnkeyVerifyParams {
  key: string;
  apiId?: string;
}

export interface UnkeyIdentity {
  externalId?: string;
  id?: string;
}

export interface UnkeyVerifyResult {
  valid?: boolean;
  code?: string;
  ownerId?: string;
  identity?: UnkeyIdentity;
}

export interface UnkeyErrorDetail {
  message?: string;
  detail?: string;
  code?: string;
}

export interface UnkeyVerifyResponse {
  data?: UnkeyVerifyResult;
  result?: UnkeyVerifyResult;
  error?: UnkeyErrorDetail;
  data$?: {
    data?: UnkeyVerifyResult;
    result?: UnkeyVerifyResult;
    error?: UnkeyErrorDetail;
  };
}

export interface UnkeyKeyRecord {
  id?: string;
}

interface UnkeyKeysListResponse {
  data?: { keys?: UnkeyKeyRecord[] };
  keys?: UnkeyKeyRecord[];
}

interface UnkeyKeysService {
  verify?: (params: UnkeyVerifyParams) => Promise<UnkeyVerifyResponse>;
  verifyKey?: (params: UnkeyVerifyParams) => Promise<UnkeyVerifyResponse>;
  list?: (params: {
    ownerId: string;
    apiId?: string;
  }) => Promise<UnkeyKeysListResponse>;
  listByOwnerId?: (params: {
    ownerId: string;
    apiId?: string;
  }) => Promise<UnkeyKeysListResponse>;
}

interface UnkeyClientExtended {
  keys?: UnkeyKeysService;
  verifyKey?: (params: UnkeyVerifyParams) => Promise<UnkeyVerifyResponse>;
  verify?: (params: UnkeyVerifyParams) => Promise<UnkeyVerifyResponse>;
  _keys?: UnkeyKeysService;
}

export interface UnkeySdkError extends Error {
  statusCode?: number;
  body?: unknown;
  error?: UnkeyErrorDetail;
  data$?: UnkeyVerifyResponse['data$'];
}

export function createUnkeyClient(rootKey?: string): Unkey {
  return new Unkey({
    rootKey: rootKey ?? process.env.UNKEY_ROOT_KEY ?? '',
  });
}

function getExtendedClient(unkey: Unkey): UnkeyClientExtended {
  return unkey as unknown as UnkeyClientExtended;
}

export function buildVerifyParams(key: string): UnkeyVerifyParams {
  const verifyParams: UnkeyVerifyParams = { key };
  const apiId = process.env.UNKEY_API_ID;
  if (apiId) {
    verifyParams.apiId = apiId;
  }
  return verifyParams;
}

export function extractVerifyResult(
  response: UnkeyVerifyResponse | null | undefined
): { result: UnkeyVerifyResult | null; error: UnkeyErrorDetail | null } {
  if (!response) {
    return { result: null, error: null };
  }

  if (response.data$) {
    const data = response.data$;
    return {
      result: data.data ?? data.result ?? null,
      error: data.error ?? null,
    };
  }

  if ('data' in response && response.data) {
    return {
      result: response.data,
      error: response.error ?? null,
    };
  }

  if ('result' in response && response.result) {
    return {
      result: response.result,
      error: response.error ?? null,
    };
  }

  if (response.error) {
    return {
      result: { valid: false },
      error: response.error,
    };
  }

  return { result: null, error: null };
}

export function extractUserId(
  result: UnkeyVerifyResult | null | undefined
): string | undefined {
  return result?.identity?.externalId || result?.identity?.id || result?.ownerId;
}

export function isUnkeySdkError(error: unknown): error is UnkeySdkError {
  return error instanceof Error;
}

export async function verifyUnkeyApiKey(
  token: string,
  rootKey?: string
): Promise<{
  response: UnkeyVerifyResponse | null;
  result: UnkeyVerifyResult | null;
  error: UnkeyErrorDetail | null;
}> {
  const unkey = createUnkeyClient(rootKey);
  const verifyParams = buildVerifyParams(token);
  const client = getExtendedClient(unkey);
  let response: UnkeyVerifyResponse | null = null;

  try {
    if (client.keys?.verifyKey) {
      response = await client.keys.verifyKey(verifyParams);
    } else if (client.verifyKey) {
      response = await client.verifyKey(verifyParams);
    } else if (client.keys?.verify) {
      response = await client.keys.verify(verifyParams);
    }
  } catch (err) {
    if (isUnkeySdkError(err) && err.data$) {
      response = { data$: err.data$ };
    }
  }

  const { result, error } = extractVerifyResult(response);
  return { response, result, error };
}

export async function verifyUnkeyApiKeyWithFallbacks(token: string): Promise<{
  result: UnkeyVerifyResult | null;
  error: UnkeyErrorDetail | null;
}> {
  const rootKey = process.env.UNKEY_ROOT_KEY || '';
  const unkey = createUnkeyClient(rootKey);
  const client = getExtendedClient(unkey);
  let response: UnkeyVerifyResponse | null = null;

  if (!rootKey) {
    console.warn('UNKEY_ROOT_KEY not set - key verification may fail');
  }

  let keysService: UnkeyKeysService | null = null;
  try {
    keysService = client.keys ?? null;
  } catch {
    // Ignore getter failures from SDK internals.
  }

  console.log('Unkey instance structure:', {
    hasVerifyKey: typeof client.verifyKey === 'function',
    hasKeys: !!client.keys,
    keysType: typeof keysService,
    keysServiceKeys: keysService ? Object.keys(keysService) : [],
    hasKeysVerify: typeof keysService?.verify === 'function',
    hasKeysVerifyKey: typeof keysService?.verifyKey === 'function',
    has_Keys: !!client._keys,
    _keysType: typeof client._keys,
    _keysKeys: client._keys ? Object.keys(client._keys) : [],
  });

  if (keysService && typeof keysService.verify === 'function') {
    console.log('Trying keys.verify method (v1 style)...');
    try {
      response = await keysService.verify({ key: token });
      console.log(
        'keys.verify response:',
        response ? 'got response' : 'no response'
      );
    } catch {
      console.log('keys.verify failed, trying verifyKey...');
    }
  }

  if (!response && typeof client.verifyKey === 'function') {
    console.log('Trying verifyKey method...');
    response = await client.verifyKey({ key: token });
    console.log(
      'verifyKey response:',
      response ? 'got response' : 'no response'
    );
  } else if (
    !response &&
    keysService &&
    typeof keysService.verifyKey === 'function'
  ) {
    console.log('Trying keys.verifyKey method...');
    try {
      const verifyParams = buildVerifyParams(token);
      if (verifyParams.apiId) {
        console.log(
          'Calling verifyKey WITH apiId (v2 requires this or special permissions):',
          {
            tokenLength: token.length,
            apiId: verifyParams.apiId,
          }
        );
      } else {
        console.log(
          'Calling verifyKey WITHOUT apiId (requires root key with api.*.verify_key permissions):',
          {
            tokenLength: token.length,
          }
        );
      }

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
    } catch (verifyError: unknown) {
      const sdkError = verifyError as UnkeySdkError;
      console.log(
        'keys.verifyKey error caught:',
        sdkError?.statusCode,
        sdkError?.body
      );
      if (sdkError?.error) {
        response = { error: sdkError.error };
        console.log('Using error object as response');
      } else {
        throw verifyError;
      }
    }
  } else if (keysService && typeof keysService.verify === 'function') {
    console.log('Trying keys.verify method...');
    response = await keysService.verify({ key: token });
    console.log(
      'keys.verify response:',
      response ? 'got response' : 'no response'
    );
  } else if (client._keys && typeof client._keys.verifyKey === 'function') {
    console.log('Trying _keys.verifyKey method...');
    response = await client._keys.verifyKey({ key: token });
    console.log(
      '_keys.verifyKey response:',
      response ? 'got response' : 'no response'
    );
  } else if (client._keys && typeof client._keys.verify === 'function') {
    console.log('Trying _keys.verify method...');
    response = await client._keys.verify({ key: token });
    console.log(
      '_keys.verify response:',
      response ? 'got response' : 'no response'
    );
  } else {
    console.log('SDK methods not found, trying direct API call...');
    const verifyUrl = 'https://api.unkey.com/v2/keys/verify-api-key';
    console.log(`Trying API endpoint: ${verifyUrl}`);
    const apiResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: token }),
    });

    if (apiResponse.ok) {
      response = (await apiResponse.json()) as UnkeyVerifyResponse;
      console.log('Direct API call succeeded');
    } else {
      const errorText = await apiResponse.text();
      console.log(`API endpoint ${verifyUrl} failed:`, {
        status: apiResponse.status,
        body: errorText,
      });
      throw new Error(`Unkey API error: ${apiResponse.status}`);
    }
  }

  const { result, error } = extractVerifyResult(response);

  console.log('Response extraction details:', {
    hasResponse: !!response,
    responseKeys: response ? Object.keys(response) : [],
    hasData: response ? 'data' in response : false,
    hasResult: response ? 'result' in response : false,
    dataKeys:
      response && 'data' in response && response.data
        ? Object.keys(response.data)
        : [],
    resultKeys: result ? Object.keys(result) : [],
    resultContent: result,
  });

  return { result, error };
}

export async function listUnkeyKeysForOwner(
  userId: string,
  apiId: string,
  rootKey: string
): Promise<UnkeyKeyRecord[]> {
  const unkey = createUnkeyClient(rootKey);
  const client = getExtendedClient(unkey);
  let keys: UnkeyKeyRecord[] = [];

  if (client.keys?.list) {
    try {
      const response = await client.keys.list({
        ownerId: userId,
        apiId,
      });
      keys = response?.data?.keys || response?.keys || [];
    } catch (e) {
      console.log('keys.list() method not available or failed:', e);
    }
  }

  if (keys.length === 0 && client.keys?.listByOwnerId) {
    try {
      const response = await client.keys.listByOwnerId({
        ownerId: userId,
        apiId,
      });
      keys = response?.data?.keys || response?.keys || [];
    } catch (e) {
      console.log('keys.listByOwnerId() method not available or failed:', e);
    }
  }

  if (keys.length === 0) {
    try {
      const response = await fetch(
        `https://api.unkey.com/v2/keys?ownerId=${userId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rootKey}`,
          },
        }
      );
      if (response.ok) {
        const data = (await response.json()) as UnkeyKeysListResponse;
        keys = data?.keys || data?.data?.keys || [];
      }
    } catch (e) {
      console.log('Direct API call to v2 endpoint failed:', e);
    }
  }

  return keys;
}
