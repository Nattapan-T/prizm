# PRetina — AI Code Review for Frontend Teams

Catch Design System violations, accessibility issues, and generate PR docs instantly — powered by Gemini 2.5 Flash.

## Features

- 🎨 **DS Violations** — Hardcoded colors, spacing, typography, border radius (DS001–DS006)
- ♿ **Accessibility** — Missing aria-labels, focus management, WCAG 2.1 AA (A11Y001–A11Y006)
- 📝 **PR Summary** — Plain English summary + copy as Markdown for GitHub PRs
- ⚡ **Monaco Editor** — VS Code-like code input with TypeScript support

## Stack

- Next.js 16 + React 19 + TypeScript
- Gemini 2.5 Flash via `@ai-sdk/google`
- Monaco Editor

## Getting Started

```bash
pnpm install
cp .env.local.example .env.local  # add your GOOGLE_GENERATIVE_AI_API_KEY
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nattapan-T/prizm)

Live: [pretina.vercel.app](https://pretina.vercel.app)
