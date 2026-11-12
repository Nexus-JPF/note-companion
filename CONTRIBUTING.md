# Contributing to Note Companion

Thank you for your interest in contributing to Note Companion! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Package Details](#package-details)
- [Development Guidelines](#development-guidelines)
- [Architecture](#architecture)
- [Testing](#testing)
- [Git Workflow](#git-workflow)
- [Documentation](#documentation)

## Development Setup

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** 10.8.1+ (install with `npm install -g pnpm`)
- **Git** for version control

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Nexus-JPF/note-companion.git
cd note-companion
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:
   - Copy `.env.example` files in each package to `.env.local`
   - Configure your API keys and services

### Development

Run all packages in development mode:

```bash
pnpm dev
```

Run specific packages:

```bash
# Plugin development
pnpm --filter plugin dev

# Web app development (runs on port 3010)
pnpm --filter web dev

# Mobile app
pnpm --filter mobile start

# Landing page
pnpm --filter landing dev
```

### Building

Build all packages:

```bash
pnpm build
```

Build specific package:

```bash
pnpm --filter plugin build
pnpm --filter web build
```

## Project Structure

This is a monorepo project managed with pnpm workspaces and Turborepo. The project consists of several packages:

```
note-companion/
├── packages/
│   ├── plugin/          # Obsidian plugin (TypeScript, React 19)
│   ├── web/             # Web application (Next.js 15, React 19)
│   ├── mobile/          # Mobile app (React Native, Expo SDK 52)
│   └── landing/         # Marketing website (Next.js 15)
├── memory/              # Project memory and learnings
├── pnpm-workspace.yaml  # Workspace configuration
└── turbo.json          # Turborepo configuration
```

## Package Details

### `packages/plugin` - Obsidian Plugin

The core Obsidian plugin that provides AI-powered note organization.

**Tech Stack:**

- TypeScript
- React 19 for UI components
- TailwindCSS (with `fo-` prefix to avoid conflicts)
- Multiple AI provider support (OpenAI, Anthropic, Google, etc.)
- Tiptap editor integration

**Key Features:**

- Automatic file organization based on AI classification
- Custom AI prompt templates
- Audio transcription
- OCR for handwritten notes
- YouTube video summaries
- Context-aware AI chat
- Atomic note generation

**Development:**

```bash
cd packages/plugin
pnpm dev
```

### `packages/web` - Web Application

The cloud backend and web interface for the plugin.

**Tech Stack:**

- Next.js 15.1.6 with App Router
- React 19
- Drizzle ORM with PostgreSQL (Vercel Postgres)
- Clerk authentication
- Stripe payments
- AWS S3/R2 for file storage
- TailwindCSS v4

**Features:**

- User account management
- Subscription handling
- AI API endpoints
- File processing and storage
- Settings synchronization

**Development:**

```bash
cd packages/web
pnpm dev  # Runs on port 3010
```

### `packages/mobile` - Mobile Application

Cross-platform mobile app for Note Companion.

**Tech Stack:**

- React Native with Expo SDK 52
- NativeWind for styling
- Clerk authentication
- Shared functionality with web app

**Development:**

```bash
cd packages/mobile
pnpm start
```

### `packages/landing` - Landing Page

Marketing website for Note Companion.

**Tech Stack:**

- Next.js 15.2.1
- PostHog analytics
- Framer Motion animations
- Radix UI components

**Development:**

```bash
cd packages/landing
pnpm dev
```

## Development Guidelines

### Code Style

- **TypeScript** for type safety
- **React 19** for UI components
- **TailwindCSS** with `fo-` prefix in plugin
- Follow existing patterns and conventions
- Use ESLint and Prettier configurations

### File Naming

- Always use **kebab-case** for file names
- Use descriptive, clear names

### Plugin UI Styling

**CRITICAL:** The plugin uses a theme-agnostic, native Obsidian styling approach. See [AGENTS.MD](AGENTS.MD) for detailed styling guidelines.

Key rules:
- Always wrap components in `StyledContainer`
- Use `tw()` function for className merging
- Use Obsidian CSS variables (e.g., `bg-[--background-primary]`)
- Never use hardcoded colors
- Never use heavy shadows or excessive spacing

## Architecture

### Core Workflow

1. **Inbox Processing**: Users place files in a designated "inbox" folder
2. **AI Classification**: The plugin analyzes files and determines appropriate organization
3. **Automatic Filing**: Files are moved to appropriate folders based on classification
4. **Enhancement**: Notes are enhanced with formatting, tags, and metadata

### AI Integration

Note Companion supports multiple AI providers:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Groq
- Ollama/local models
- Custom base URLs

### Deployment Options

1. **Cloud Service**: Managed subscription service
2. **Self-Hosted**: Run your own instance (see [SELF-HOSTING.md](SELF-HOSTING.md))
3. **Local Development**: Full local setup for development

## Testing

### Unit Tests

- **Jest** for unit tests (web package)
- Run with: `pnpm --filter web test`

### E2E Tests

- **Playwright** for E2E testing (web/landing packages)
- Run with: `pnpm --filter web test:e2e`

### Manual Testing

- Obsidian plugin requires manual testing in Obsidian environment
- Before a plugin release, go through [docs/release-checklist.md](docs/release-checklist.md)
- Test with various themes and configurations
- Verify cross-platform compatibility

## Git Workflow

1. **Fork the repository**
2. **Create your feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Commit your changes**: Use descriptive commit messages
5. **Push to the branch**: `git push origin feature/your-feature-name`
6. **Open a Pull Request**: Submit PR for review

### Commit Message Guidelines

- Use clear, descriptive messages
- Start with a verb (e.g., "Add", "Fix", "Update")
- Reference issues when applicable: "Fix #123: Description"

### Before Submitting

- Run linting: `pnpm lint`
- Run tests: `pnpm test`
- Build all packages: `pnpm build`
- Verify no TypeScript errors

## Documentation

### Project Documentation

- `/AGENTS.MD` - AI assistant instructions and development guide
- `/memory/` - Project learnings and decisions
- `/SELF-HOSTING.md` - Self-hosting setup guide
- Package-specific READMEs in each package directory

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex functions and classes
- Include examples in documentation
- Update README files when adding features

## Getting Help

- **GitHub Issues**: [github.com/Nexus-JPF/note-companion/issues](https://github.com/Nexus-JPF/note-companion/issues)
- **Documentation**: Check the `/docs` folder and package READMEs
- **Code Analysis**: See `/docs/code-analysis/` for architecture insights

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

