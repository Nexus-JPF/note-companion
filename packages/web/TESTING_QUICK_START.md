# Quick Start: Testing Unkey API v2 Migration

## Run Unit Tests

```bash
cd packages/web
pnpm test
```

This will run:
- `lib/handleAuthorization.test.ts` - Tests authorization with v2 format
- `app/actions.test.ts` - Tests license key creation with v2 format

## Manual API Testing

### 1. Start the server
```bash
cd packages/web
pnpm dev
```

### 2. Test key validation endpoint
```bash
# Replace YOUR_KEY with a valid Unkey API key
curl -X POST http://localhost:3010/api/check-key \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "message": "Valid key",
  "userId": "user_xxx"
}
```

### 3. Test public usage endpoint
```bash
curl -X GET http://localhost:3010/api/public-usage \
  -H "Authorization: Bearer YOUR_KEY"
```

**Expected Response:**
```json
{
  "tokenUsage": 0,
  "maxTokenUsage": 100000,
  "subscriptionStatus": "active",
  "currentPlan": "Legacy Plan",
  "isActive": true
}
```

### 4. Test any protected endpoint
```bash
# Example: Chat endpoint
curl -X POST http://localhost:3010/api/chat \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

## What to Check

✅ **Valid keys work** - Authentication succeeds
✅ **Invalid keys are rejected** - Proper error messages
✅ **Response format** - Check server logs for v2 format
✅ **No errors in console** - No TypeScript or runtime errors
✅ **Backward compatibility** - Old keys still work

## Troubleshooting

**If tests fail:**
- Check that `@unkey/api` is at version `^2.2.0` in `package.json`
- Verify mocks are set up correctly in `__mocks__/@unkey/api.ts`

**If API calls fail:**
- Verify `UNKEY_ROOT_KEY` and `UNKEY_API_ID` are set in `.env.local`
- Check server logs for detailed error messages
- Verify the key format is correct

For detailed testing instructions, see `TESTING_UNKEY_V2.md`.


