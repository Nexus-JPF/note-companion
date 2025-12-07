#!/bin/bash

# Script to verify an Unkey API key
# Usage: ./verify-key.sh YOUR_KEY_HERE

KEY="${1:-}"

if [ -z "$KEY" ]; then
  echo "Usage: ./verify-key.sh YOUR_KEY_HERE"
  exit 1
fi

echo "Verifying key: ${KEY:0:10}..."
echo ""

# Try v2 API endpoint
curl -X POST "https://api.unkey.com/v2/keys/verify-api-key" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"$KEY\"}" \
  | jq '.'

echo ""
echo "---"
echo ""

# Alternative: Use your app's endpoint
echo "Testing via your app endpoint:"
curl -X POST "http://localhost:3010/api/check-key" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  | jq '.'

