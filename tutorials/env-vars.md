# Environment Variables


## Self-hosting

### OpenAI

- `OPENAI_API_KEY`: The API key for OpenAI integration.
- `ANTHROPIC_API_KEY`: To use the Anthropic models

### Models

- `MODEL_PROVIDER`: AI provider for server endpoints. Defaults to `"openai"`.
- `MODEL_NAME`: Default model for organizer, classify, tag, extract, etc. Defaults to `"gpt-5.6-luna"`.
- `RESPONSES_MODEL_NAME`: Model for OpenAI Responses API (chat + web search only). Defaults to `MODEL_NAME`.

**Cost split (OpenAI, per 1M tokens, standard tier):** the default `gpt-5.6-luna` ($0.20 / $1.20) is the cheapest all-in-one option. For better chat quality, keep it for bulk work and set `RESPONSES_MODEL_NAME=gpt-5.4-mini` ($0.75 / $4.50) for chat; reasoning tokens bill as output, so chat costs more than the list price suggests. Avoid `gpt-4.1-mini` and `gpt-5.4-nano`: both are deprecated (shutdown Jan 14, 2027 and Apr 1, 2027). Prices from OpenAI's pricing page, checked 2026-11-22.

### Chat web search

- `CHAT_WEB_SEARCH`: Web search in chat is **on by default** (OpenAI only). Set to `"false"` to disable (non-OpenAI self-hosters, cost control).
- `CHAT_DEEP_SEARCH`: Set to `"true"` for medium search context size (default off).
- Web search billing: ~$10 per 1,000 search calls (independent of model); search content tokens are free.

### API Keys
This is necessary when deploying with vercel, but not required if you run it locally.

- `SOLO_API_KEY`: The API key for solo usage (without user management). 

Make sure to set these environment variables in your `.env` file or your hosting platform's configuration settings for the project to function correctly.


## Running a full instance
> The env var below are only useful if you want to add user management on your instance

### General

- `ENABLE_USER_MANAGEMENT`: Determines whether user management is enabled or not. Set to `"true"` to enable user management via Clerk. (should be set to true if you want to run the full instance)

### Stripe

- `STRIPE_SECRET_KEY`: The secret key for Stripe integration.
- `STRIPE_WEBHOOK_SECRET`: The secret key for Stripe webhook.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: The public key for Stripe integration.
- `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`: The price ID for the monthly subscription plan in Stripe.

### Unkey

- `UNKEY_ROOT_KEY`: The root key for Unkey API.
- `UNKEY_API_ID`: The API ID for Unkey.
