# Testing Unkey API v2 Migration

This document outlines how to test the migration from Unkey API v1 to v2.

## Overview

The migration updates all Unkey API calls to handle the new v2 response format, which wraps responses in a `data` field. The implementation maintains backward compatibility with v1 format.

## Test Types

### 1. Unit Tests

Run the unit tests to verify the response format handling:

```bash
cd packages/web
pnpm test
```

**Test Files:**
- `lib/handleAuthorization.test.ts` - Tests for authorization with Unkey
- `app/actions.test.ts` - Tests for license key creation

**What to Verify:**
- ✅ v2 response format (with `data` wrapper) is handled correctly
- ✅ v1 response format (backward compatibility) still works
- ✅ Error handling works with both formats
- ✅ All `verifyKey()` calls handle the new format
- ✅ `Unkey.keys.create()` handles the new format

### 2. Integration Tests

Test the actual API endpoints that use Unkey:

#### Test Endpoints

**1. Check Key Endpoint**
```bash
# Test with a valid key
curl -X POST http://localhost:3010/api/check-key \
  -H "Authorization: Bearer YOUR_VALID_KEY" \
  -H "Content-Type: application/json"

# Expected: { "message": "Valid key", "userId": "..." }
```

**2. Public Usage Endpoint**
```bash
curl -X GET http://localhost:3010/api/public-usage \
  -H "Authorization: Bearer YOUR_VALID_KEY"

# Expected: Usage data with tokenUsage, maxTokenUsage, etc.
```

**3. Transcription Endpoint**
```bash
curl -X POST http://localhost:3010/api/transcribe \
  -H "Authorization: Bearer YOUR_VALID_KEY" \
  -F "audio=@test-audio.webm"

# Expected: { "text": "transcribed text..." }
```

**4. Any Endpoint Using handleAuthorizationV2**
```bash
# Test chat endpoint
curl -X POST http://localhost:3010/api/chat \
  -H "Authorization: Bearer YOUR_VALID_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'

# Expected: Streaming response
```

### 3. Manual Testing Checklist

#### Prerequisites
1. Ensure you have valid Unkey API keys set up:
   ```env
   UNKEY_ROOT_KEY=your_root_key
   UNKEY_API_ID=your_api_id
   ```

2. Start the development server:
   ```bash
   cd packages/web
   pnpm dev
   ```

#### Test Scenarios

**✅ Valid Key Authentication**
- [ ] Test API key authentication with a valid key
- [ ] Verify `ownerId` is correctly extracted from v2 response
- [ ] Verify subscription and token usage checks still work
- [ ] Check that logging works correctly

**✅ Invalid Key Handling**
- [ ] Test with an invalid/expired key
- [ ] Verify proper error messages are returned
- [ ] Check error codes are handled correctly

**✅ License Key Creation**
- [ ] Test creating a new license key via `createLicenseKey()`
- [ ] Verify the key is created successfully
- [ ] Check that the response format is handled correctly

**✅ Backward Compatibility**
- [ ] Verify the code handles both v1 and v2 response formats
- [ ] Test that existing keys still work
- [ ] Ensure no breaking changes for existing users

**✅ Error Scenarios**
- [ ] Test with missing authorization header
- [ ] Test with malformed keys
- [ ] Test rate limiting scenarios
- [ ] Test network errors

### 4. End-to-End Testing

Test the full flow from plugin to API:

1. **From Obsidian Plugin:**
   - [ ] Open plugin settings
   - [ ] Enter a valid license key
   - [ ] Verify key is accepted
   - [ ] Test API calls (chat, transcription, etc.)
   - [ ] Verify all features work correctly

2. **Check Logs:**
   - [ ] Monitor server logs for any errors
   - [ ] Verify request IDs are logged (v2 feature)
   - [ ] Check that authentication succeeds

### 5. Monitoring

After deployment, monitor:

- **Error Rates:** Check for increased 401/403 errors
- **Response Times:** Verify no performance degradation
- **Logs:** Look for any v2-related errors or warnings
- **User Reports:** Monitor for any authentication issues

## Debugging

### Common Issues

**Issue: "Cannot read property 'valid' of undefined"**
- **Cause:** Response format not handled correctly
- **Fix:** Ensure code checks for both `data` and `result` properties

**Issue: "ownerId is undefined"**
- **Cause:** Response structure changed
- **Fix:** Verify response has `data.ownerId` or `result.ownerId`

**Issue: "Type errors with verifyKey"**
- **Cause:** TypeScript types may need updating
- **Fix:** Check `@unkey/api` types match actual response

### Debug Commands

```bash
# Check Unkey package version
cd packages/web
pnpm list @unkey/api

# Run tests with verbose output
pnpm test --verbose

# Check TypeScript types
pnpm ts:check
```

## Rollback Plan

If issues are found:

1. **Immediate:** The code maintains backward compatibility, so v1 should still work
2. **Package Rollback:** If needed, revert to v1:
   ```bash
   cd packages/web
   pnpm install @unkey/api@^0.19.5
   ```
3. **Code Rollback:** Revert the response handling changes if necessary

## Success Criteria

✅ All unit tests pass
✅ All integration tests pass
✅ Manual testing shows no regressions
✅ Error handling works correctly
✅ Backward compatibility maintained
✅ No increase in error rates
✅ All API endpoints function correctly

## Next Steps

After successful testing:

1. Monitor production for 24-48 hours
2. Remove v1 backward compatibility code (optional, after migration period)
3. Update documentation if needed
4. Consider adding more comprehensive error handling


