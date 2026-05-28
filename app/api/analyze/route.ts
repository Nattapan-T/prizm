import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

export const maxDuration = 60 // seconds — Vercel Hobby plan max

const AnalysisSchema = z.object({
  summary: z.string().describe('Plain English PR summary of what changed'),
  ds_violations: z.array(z.object({
    line: z.number().optional(),
    code: z.string(),
    issue: z.string(),
    fix: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
  })),
  a11y_issues: z.array(z.object({
    line: z.number().optional(),
    issue: z.string(),
    fix: z.string(),
    wcag: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
  })),
})

const PROMPT = (code: string) => `
You are a senior frontend engineer and Design System expert.
Analyze the following code and return a structured analysis.

## Design System Rule Codes
Use these exact rule codes in the \`code\` field for DS violations:

| Code  | Rule                        | Example violation                          |
|-------|-----------------------------|--------------------------------------------|
| DS001 | Hardcoded spacing           | margin: 13px, padding: 7px                |
| DS002 | Hardcoded color             | #1A73E8, rgb(0,0,0), blue-500 as primitive |
| DS003 | Hardcoded typography        | fontSize: 13, fontWeight: 700 inline       |
| DS004 | Hardcoded border radius     | borderRadius: 8px instead of token         |
| DS005 | Missing semantic token      | Using primitive value instead of var(--token) |
| DS006 | Inconsistent naming         | camelCase mixed with kebab-case tokens     |

## Accessibility Rule Codes
Use these exact rule codes in the \`wcag\` field prefix for A11y issues:

| Code    | Rule                          | WCAG Criterion                |
|---------|-------------------------------|-------------------------------|
| A11Y001 | Missing accessible name       | 1.1.1, 4.1.2                  |
| A11Y002 | Missing focus management      | 2.4.3, 2.4.7                  |
| A11Y003 | Missing ARIA role             | 4.1.2                         |
| A11Y004 | Color-only indicator          | 1.4.1                         |
| A11Y005 | Keyboard navigation missing   | 2.1.1                         |
| A11Y006 | Missing alt text on image     | 1.1.1                         |

## Instructions
- For each DS violation, set \`code\` to the rule code (e.g. "DS002") and reference the specific value in \`issue\`
- For each A11y issue, set \`wcag\` to "<RULE_CODE> / <WCAG criterion>" (e.g. "A11Y001 / 4.1.2")
- Only flag real issues present in the code — do not invent violations
- If no issues exist in a category, return an empty array

Code to analyze:
\`\`\`
${code}
\`\`\`
`

// Extract HTTP status from AI SDK errors — tries multiple property paths
function getStatus(err: any): number | undefined {
  return (
    err?.statusCode ??
    err?.status ??
    err?.response?.status ??
    err?.cause?.statusCode ??
    err?.cause?.status
  )
}

// Check if error is a rate-limit (429) by status OR message content
function isRateLimit(err: any): boolean {
  if (getStatus(err) === 429) return true
  const msg = String(err?.message ?? err?.cause?.message ?? err?.toString() ?? '').toLowerCase()
  return msg.includes('quota exceeded') || msg.includes('exceeded your current quota') || msg.includes('rate limit')
}

// Check if error is overload (503) by status OR message content
function isOverload(err: any): boolean {
  if (getStatus(err) === 503) return true
  const msg = String(err?.message ?? err?.cause?.message ?? err?.toString() ?? '').toLowerCase()
  return msg.includes('overloaded') || msg.includes('service unavailable')
}

// Parse "retry in Xs" → seconds (for client countdown)
function parseRetryAfterSec(err: any): number {
  const msg = String(err?.message ?? err?.cause?.message ?? err?.toString() ?? '')
  const match = msg.match(/retry in ([0-9.]+)s/i)
  return match ? Math.ceil(parseFloat(match[1])) + 1 : 60
}

// Retry with exponential backoff — 503 overload only
// 429 rate-limit is returned to the client so it can show a countdown
async function generateWithRetry(code: string, maxRetries = 3) {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: AnalysisSchema,
        prompt: PROMPT(code),
        maxRetries: 0, // disable SDK built-in retry — our code handles it
      })
      return object
    } catch (err: any) {
      lastError = err
      if (isRateLimit(err)) throw err  // 429 → handled by client countdown, don't retry
      if (!isOverload(err)) throw err  // non-503 → unrecoverable, throw immediately
      const delay = 1000 * Math.pow(2, attempt)
      console.warn(`Attempt ${attempt + 1} failed (overload), retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || code.trim() === '') {
      return Response.json({ error: 'No code provided' }, { status: 400 })
    }

    const object = await generateWithRetry(code)
    return Response.json(object)

  } catch (error: any) {
    console.error('Analysis error:', error)

    if (isRateLimit(error)) {
      const retryAfter = parseRetryAfterSec(error)
      return Response.json(
        { error: 'Rate limited by Gemini API.', retryAfter },
        { status: 429 }
      )
    }
    if (isOverload(error)) {
      return Response.json(
        { error: 'Gemini is experiencing high demand. Please try again in a moment.' },
        { status: 503 }
      )
    }
    return Response.json({
      error: 'Analysis failed',
      detail: process.env.NODE_ENV === 'development'
        ? String(error?.message ?? error)
        : undefined,
    }, { status: 500 })
  }
}
