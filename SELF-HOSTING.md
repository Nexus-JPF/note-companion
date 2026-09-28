# Self-Hosting Note Companion

This guide will help you set up your own instance of Note Companion, allowing you to use all features for free with your own AI API keys.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Detailed Installation](#detailed-installation)
- [Configuration Options](#configuration-options)
- [Supported AI Providers](#supported-ai-providers)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [Security Considerations](#security-considerations)

## Prerequisites
- **Docker** setup or build/compile via: **Node.js** 18 or higher + **pnpm** package manager (install with `npm install -g pnpm`) + **Git** for cloning the repository
- **AI API Key** from at least one provider (OpenAI recommended for best results)
- **4GB RAM** minimum on your server/computer
- **Port 3000** available for production (or configure a different port)

## Quick Setup

**Docker** 
Use the available docker-compose.yml file


**Build/Compile**

```bash
# 1. Clone the repository
git clone https://github.com/Nexus-JPF/note-companion.git
cd note-companion

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cd packages/web
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env

# 4. Build for self-hosting
pnpm build:self-host

# 5. Start the server
pnpm start
```

Your server will be running at `http://localhost:3000` (or the port specified in the `PORT` environment variable)

## Detailed Installation (Build/Compile)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/Nexus-JPF/note-companion.git
cd note-companion

# Install all dependencies
pnpm install
```

### Step 2: Configure Environment Variables

Navigate to the web package:

```bash
cd packages/web
```

Create a `.env` file with your configuration:

```env
# Required: At least one AI provider API key
OPENAI_API_KEY=sk-...your_key_here...

# Optional: Custom OpenAI-compatible API endpoint (for local LLMs like Ollama)
OPENAI_API_BASE=http://localhost:11434/v1  # Use this for local Ollama instances

# Optional: Additional AI providers
ANTHROPIC_API_KEY=sk-ant-...your_key_here...
GOOGLE_GENERATIVE_AI_API_KEY=...your_key_here...
GROQ_API_KEY=gsk_...your_key_here...
MISTRAL_API_KEY=...your_key_here...
DEEPSEEK_API_KEY=...your_key_here...

# Optional: AI Model Configuration (for self-hosting with custom providers)
# If not set, defaults to OpenAI with gpt-4.1-mini (backward compatible)
MODEL_PROVIDER=openai  # Options: openai, anthropic, google, groq, mistral, deepseek
MODEL_NAME=gpt-4.1-mini  # Model name for the selected provider
RESPONSES_MODEL_NAME=gpt-4.1-mini  # Optional: Model for Responses API (OpenAI only, defaults to MODEL_NAME)

# Optional: Chat web search (Responses API + web_search_preview)
# CHAT_WEB_SEARCH=false  # Default on; set to false to disable
# CHAT_DEEP_SEARCH=true  # Default off; set to true for medium search context

# Optional: Server configuration
PORT=3000  # Default is 3000 for production (3010 is used in development mode with `pnpm dev`)
NODE_ENV=production

# Optional: For OCR features (handwriting recognition)
GOOGLE_VISION_API_KEY=...your_key_here...

# Optional: User management (set to 'true' to enable, any other value or unset to disable)
ENABLE_USER_MANAGEMENT=false  # Disable for self-hosting without authentication
```

#### Getting API Keys

- **OpenAI**: Sign up at [platform.openai.com](https://platform.openai.com), go to API Keys section
- **Anthropic**: Sign up at [console.anthropic.com](https://console.anthropic.com)
- **Google**: Get API keys from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Groq**: Sign up at [console.groq.com](https://console.groq.com)

### Step 3: Build the Application

From the `packages/web` directory:

```bash
# Build specifically for self-hosting (includes all necessary features)
pnpm build:self-host
```

This command:

- Builds the Next.js application
- Configures it for standalone deployment
- Optimizes for self-hosted environment

### Step 4: Start the Server

```bash
# Start the production server
pnpm start
```

The server will start on port 3000 by default (or the port specified in the `PORT` environment variable). You should see:

```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
- Network:      http://[your-ip]:3000
✓ Ready
```

### Step 5: Configure the Obsidian Plugin

1. Open Obsidian and go to **Settings → Note Companion**
2. Open the **Advanced** tab
3. Enable **Enable Self-Hosting**
4. Set the **Server URL**:
   - For local machine: `http://localhost:3000` (or `http://localhost:3010` if you set `PORT=3010`)
   - For network access: `http://[your-server-ip]:3000` (or the port you configured)
   - For domain with SSL: `https://your-domain.com`
5. Verify the backend is reachable (e.g. `curl http://localhost:3000/api/health`) and try **Note Companion: Open Chat**

> **Note:** Provider API keys (OpenAI, Claude, etc.) are configured in the server `.env` file above — not in the Obsidian plugin. The plugin **License Key** field is for Note Companion Cloud only; self-hosted instances with `ENABLE_USER_MANAGEMENT=false` do not require a cloud license.

## Configuration Options

### Using Different Ports

If port 3000 is occupied, you can use a different port:

```env
PORT=8080
```

Then update the plugin settings to use `http://localhost:8080`

### Running as a Service

#### Linux (systemd)

Create `/etc/systemd/system/note-companion.service`:

```ini
[Unit]
Description=Note Companion Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/note-companion/packages/web
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable note-companion
sudo systemctl start note-companion
```

#### Docker

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
WORKDIR /app/packages/web
RUN pnpm build:self-host
EXPOSE 3000
CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t note-companion .
docker run -p 3000:3000 --env-file packages/web/.env note-companion
```

### Using PM2 (Process Manager)

Install PM2 globally:

```bash
npm install -g pm2
```

Start the application:

```bash
cd packages/web
pm2 start "pnpm start" --name note-companion
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

## Supported AI Providers

### OpenAI (Recommended)

Best overall performance and feature support.

- Models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- Features: All features supported
- Cost: ~$0.01-0.03 per file processed

### Anthropic Claude

Excellent for complex analysis and longer documents.

- Models: Claude 3 Opus, Sonnet, Haiku
- Features: All text features (no vision/OCR)
- Cost: Similar to OpenAI

### Google Gemini

Good balance of features and cost.

- Models: Gemini Pro, Gemini Pro Vision
- Features: All features including vision
- Cost: Free tier available

### Groq

Fastest inference, good for quick processing.

- Models: Llama 3, Mixtral
- Features: Basic text processing
- Cost: Very competitive

### Mistral

Good performance with competitive pricing.

- Models: Mistral Large, Mistral Medium, Mistral Small
- Features: All text features
- Cost: Competitive

### DeepSeek

Cost-effective option with good performance.

- Models: DeepSeek Chat, DeepSeek Coder
- Features: All text features
- Cost: Very competitive

### Configuring Different Providers

To use a provider other than OpenAI, set the following environment variables:

```env
# Example: Using Groq
MODEL_PROVIDER=groq
MODEL_NAME=llama-3.1-70b-versatile
GROQ_API_KEY=gsk_...your_key_here...

# Example: Using Anthropic
MODEL_PROVIDER=anthropic
MODEL_NAME=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...your_key_here...

# Example: Using Google
MODEL_PROVIDER=google
MODEL_NAME=gemini-pro
GOOGLE_GENERATIVE_AI_API_KEY=...your_key_here...
```

**Important Notes:**

- If `MODEL_PROVIDER` is not set, the system defaults to OpenAI (backward compatible)
- Web search features (Responses API) are only available with OpenAI
- Make sure you have the corresponding API key set for your chosen provider
- Restart the server after changing these environment variables

### Local Models (Ollama)

Run models completely offline using Ollama or other OpenAI-compatible local LLM servers.

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. Configure your backend `.env` file:
   ```env
   OPENAI_API_KEY="ollama"  # Any dummy value works for local LLMs
   OPENAI_API_BASE="http://localhost:11434/v1"
   ```
4. Restart your backend server after updating `.env`
5. (Optional) In the plugin's Experiment tab, enable "Local LLM Integration" to use local models in the chat interface

**Note:** The backend will route all AI requests to your local Ollama instance. The plugin's "Server URL" setting in Advanced Settings is for connecting the plugin to your backend server, not for configuring the LLM endpoint.

If you host **Whisper** (audio transcription) separately from Ollama, set `OPENAI_WHISPER_BASE_URL` to your Whisper API base (e.g. `http://localhost:9000/v1`). When set, all transcription requests use this URL; when unset, `OPENAI_API_BASE` is used.

## Troubleshooting

### Common Issues

#### "Cannot connect to server"

- Verify the server is running: `curl http://localhost:3000/api/health` (or the port you configured)
- Check firewall settings
- Ensure the URL in plugin settings is correct

#### "Invalid API key"

- Double-check your API key in the `.env` file
- Ensure there are no extra spaces or quotes
- Restart the server after changing environment variables

#### "ENABLE_USER_MANAGEMENT not working"

- The environment variable is checked with strict comparison: `ENABLE_USER_MANAGEMENT !== 'true'`
- To disable user management, either:
  - Set `ENABLE_USER_MANAGEMENT=false` (or any value except `'true'`)
  - Leave it unset
- **Important:** You must restart the server after changing `.env` for changes to take effect
- When disabled, the server will accept any API key and assign a default user ID

#### "Out of memory"

- Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" pnpm start`
- Consider using a more powerful server

#### "Permission denied"

- Ensure you have write permissions in the installation directory
- On Linux/Mac, you might need to use `sudo` for port numbers below 1024

#### Vercel build fails: invalid maxDuration (Hobby plan)

If you deploy to **Vercel Hobby**, the build may fail with:

```text
Builder returned invalid maxDuration value for Serverless Function "api/...".
Serverless Functions must have a maxDuration between 1 and 300 for plan hobby.
```

Several API routes set `maxDuration = 800` (the Vercel **Pro** limit) for long-running work such as transcription and formatting. Hobby allows a maximum of **300 seconds**, so the deploy fails at build time before the app runs.

**Affected routes include:** `format`, `format-stream`, `enhance-meeting-note`, `transcribe`, `process-file`, `trigger-processing`, and `process-pending-uploads`.

**Options:**

1. **Recommended:** Self-host with **Docker**, **local Node** (`pnpm build:self-host` + `pnpm start`), or a VPS. These paths are not limited by Vercel plan caps.
2. **Vercel Pro:** Deploy on a Pro plan if you want to stay on Vercel with the current timeout settings.
3. **Vercel Hobby fork:** In your fork, change `maxDuration` from `800` to `300` in the routes above. Builds will succeed, but very long transcription or formatting jobs may hit the 5-minute limit.

Self-hosting does **not** require a paid Vercel plan. Docker and local setup are the supported paths in this guide.

#### OCR / vision fails on self-hosted (OpenRouter, pasted images)

- **`/api/health` OK does not test vision** — health only confirms the server is up
- **Use a vision-capable model** on the server (not in the Obsidian plugin). For OpenRouter:

  ```env
  ENABLE_USER_MANAGEMENT=false
  OPENAI_API_BASE=https://openrouter.ai/api/v1
  OPENAI_API_KEY=sk-or-v1-...
  MODEL_PROVIDER=openai
  MODEL_NAME=openai/gpt-4o
  VISION_MODEL=openai/gpt-4o
  ```

- **`MODEL_PROVIDER=anthropic` does not support OCR/vision** in Note Companion
- **If you migrated from Vercel lifetime hosting:** if `SOLO_API_KEY` is set in Docker, the plugin **License Key** must match it — or remove `SOLO_API_KEY` for simple self-hosting
- **Error: `The "data" argument must be of type string or Buffer… Received undefined`** — usually missing/invalid image data. Check Docker logs during a failed `/api/vision` request and try a small PNG saved to disk (not a pasted image) to isolate Obsidian file-read issues
- **Enable Debug Mode** in plugin settings (Advanced tab) for full error text in the in-plugin log viewer

### Checking Logs

View server logs:

```bash
# If using PM2
pm2 logs note-companion

# If using systemd
journalctl -u note-companion -f

# Direct output
pnpm start 2>&1 | tee server.log
```

## Updating

To update to the latest version:

```bash
cd note-companion
git pull origin master
pnpm install
cd packages/web
pnpm build:self-host
# Restart your server
```

## Security Considerations

### Network Security

1. **Firewall**: Only expose port 3000 (or your configured port) to trusted networks
2. **HTTPS**: Use a reverse proxy (nginx/Caddy) with SSL for internet access
3. **Authentication**: The self-hosted version doesn't include authentication by default

### API Key Security

- Never commit `.env` files to version control
- Use environment-specific configurations
- Rotate API keys regularly
- Monitor API usage on provider dashboards

### Example Nginx Configuration

For HTTPS access with nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Advanced Configuration

### Database Setup (Optional)

By default, the self-hosted version uses SQLite. For production use, you can configure PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/notecompanion
```

### Resource Limits

Configure processing limits in `.env`:

```env
MAX_FILE_SIZE=10485760  # 10MB in bytes — enforced on /api/vision image payloads
MAX_TOKENS_PER_REQUEST=8000
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
```

> **Note:** `MAX_FILE_SIZE` is currently enforced for OCR/vision (`/api/vision`). Other limits above are configuration placeholders and may not be wired to every endpoint yet.

### Custom Models

To use custom OpenAI-compatible model endpoints (including local LLMs), configure `OPENAI_API_BASE` in your `.env` file:

```env
OPENAI_API_BASE=https://your-model-api.com/v1
OPENAI_API_KEY=your_key  # Or any dummy value if not required
```

This will route all AI requests to your custom endpoint. See the "Local Models (Ollama)" section above for an example with Ollama.

- **`OPENAI_WHISPER_BASE_URL`** (optional): When set, all Whisper/audio transcription requests use this URL. When unset, transcription uses `OPENAI_API_BASE`. Use this when you host Whisper on a different endpoint than your main LLM (e.g. Ollama for chat, local Whisper for transcription).

## Getting Help

- **GitHub Issues**: [github.com/Nexus-JPF/note-companion/issues](https://github.com/Nexus-JPF/note-companion/issues)
- **Documentation**: Check the `/docs` folder in the repository
- **Community**: Join our Discord server (link in main README)

## License

The self-hosted version is provided under the MIT License. You're free to modify and distribute it according to the license terms.

---

**Note**: Self-hosting requires technical knowledge and ongoing maintenance. If you prefer a managed solution, consider our cloud service at [notecompanion.ai](https://notecompanion.ai).
