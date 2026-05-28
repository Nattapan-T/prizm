import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { parseDiff, getRelevantFiles, getDiffStats } from '@/lib/parseDiff'
import { mergeResults } from '@/lib/mergeResults'
import { MOCK_DIFF_RESULT } from '@/lib/mockResult'

export const maxDuration = 60 // seconds — Vercel Hobby plan max

// Schema เดิม — ใช้กับทั้ง single และ per-file
const AnalysisSchema = z.object({
  summary: z.string().describe('Plain English summary of what changed'),
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

// Prompt สำหรับ single file (เดิม)
const SINGLE_PROMPT = (code: string) => `
You are a senior frontend engineer and Design System expert.
Analyze the following code and return a structured analysis.

## Design System Rule Codes
| Code  | Rule                        |
|-------|-----------------------------|
| DS001 | Hardcoded spacing           |
| DS002 | Hardcoded color             |
| DS003 | Hardcoded typography        |
| DS004 | Hardcoded border radius     |
| DS005 | Missing semantic token      |
| DS006 | Inconsistent naming         |

## Accessibility Rule Codes
| Code    | Rule                        |
|---------|-----------------------------|
| A11Y001 | Missing accessible name     |
| A11Y002 | Missing focus management    |
| A11Y003 | Missing ARIA role           |
| A11Y004 | Color-only indicator        |
| A11Y005 | Keyboard navigation missing |
| A11Y006 | Missing alt text            |

Only flag real issues. Return empty arrays if no issues found.

Code:
\`\`\`
${code}
\`\`\`
`

// Prompt สำหรับ diff ของ 1 ไฟล์
const DIFF_FILE_PROMPT = (filename: string, hunks: string) => `
You are a senior frontend engineer and Design System expert.
Analyze ONLY the changed lines (+ lines) in this git diff.

File: ${filename}

## Design System Rule Codes
| Code  | Rule                        |
|-------|-----------------------------|
| DS001 | Hardcoded spacing           |
| DS002 | Hardcoded color             |
| DS003 | Hardcoded typography        |
| DS004 | Hardcoded border radius     |
| DS005 | Missing semantic token      |
| DS006 | Inconsistent naming         |

## Accessibility Rule Codes
| Code    | Rule                        |
|---------|-----------------------------|
| A11Y001 | Missing accessible name     |
| A11Y002 | Missing focus management    |
| A11Y003 | Missing ARIA role           |
| A11Y004 | Color-only indicator        |
| A11Y005 | Keyboard navigation missing |
| A11Y006 | Missing alt text            |

Focus on lines starting with + (new code).
Ignore lines starting with - (removed code).
Only flag real issues in the new code.
For summary: briefly describe what changed in this file only.

Diff:
\`\`\`diff
${hunks}
\`\`\`
`

// Prompt สำหรับ PR summary รวม
const PR_SUMMARY_PROMPT = (
  fileSummaries: string[],
  stats: ReturnType<typeof getDiffStats>
) => `
You are a senior frontend engineer writing a PR description.
Based on these per-file summaries, write a concise PR summary.

Files changed: ${stats.relevantFiles} frontend files
${fileSummaries.map((s, i) => `File ${i + 1}: ${s}`).join('\n')}

Write a clear, professional PR summary in 2-4 sentences.
Focus on what changed and why it matters.
`

// ── Error handling ──────────────────────────────────────────

function getStatus(err: any): number | undefined {
  return (
    err?.statusCode ??
    err?.status ??
    err?.response?.status ??
    err?.cause?.statusCode ??
    err?.cause?.status
  )
}

function isRateLimit(err: any): boolean {
  if (getStatus(err) === 429) return true
  const msg = String(err?.message ?? err?.cause?.message ?? '').toLowerCase()
  return msg.includes('quota exceeded') || msg.includes('exceeded your current quota') || msg.includes('rate limit')
}

function isOverload(err: any): boolean {
  if (getStatus(err) === 503) return true
  const msg = String(err?.message ?? err?.cause?.message ?? '').toLowerCase()
  return msg.includes('overloaded') || msg.includes('service unavailable')
}

function parseRetryAfterSec(err: any): number {
  const msg = String(err?.message ?? err?.cause?.message ?? err?.toString() ?? '')
  const match = msg.match(/retry in ([0-9.]+)s/i)
  return match ? Math.ceil(parseFloat(match[1])) + 1 : 60
}

async function generateWithRetry(prompt: string, maxRetries = 3) {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: AnalysisSchema,
        prompt,
        maxRetries: 0,
      })
      return object
    } catch (err: any) {
      lastError = err
      if (isRateLimit(err)) throw err  // 429 → client handles countdown
      if (!isOverload(err)) throw err  // non-503 → unrecoverable
      const delay = 1000 * Math.pow(2, attempt)
      console.warn(`Attempt ${attempt + 1} failed (overload), retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError
}

// ── Route handler ───────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { code, mode = 'single' } = await req.json()

    if (!code?.trim()) {
      return Response.json({ error: 'No code provided' }, { status: 400 })
    }

    // ── Mock mode — dev only, no quota used ──────────────
    if (process.env.MOCK_API === 'true') {
      await new Promise(r => setTimeout(r, 1500)) // simulate delay
      return Response.json(MOCK_DIFF_RESULT)
    }

    // ── Single file mode (เดิม) ──────────────────────────
    if (mode === 'single') {
      const result = await generateWithRetry(SINGLE_PROMPT(code))
      return Response.json(result)
    }

    // ── Git diff mode (ใหม่) ─────────────────────────────
    const parsed = parseDiff(code)
    const relevant = getRelevantFiles(parsed)
    const stats = getDiffStats(parsed)

    if (relevant.length === 0) {
      return Response.json({
        error: 'No frontend files found in this diff',
        detail: `Found ${parsed.length} files but none are frontend files (.tsx, .ts, .css etc.)`,
      }, { status: 422 })
    }

    // วิเคราะห์แต่ละไฟล์ parallel
    const fileAnalyses = await Promise.all(
      relevant.map(async (file) => {
        const result = await generateWithRetry(
          DIFF_FILE_PROMPT(file.filename, file.hunks)
        )
        return {
          filename: file.filename,
          summary: result.summary,
          ds_violations: result.ds_violations,
          a11y_issues: result.a11y_issues,
        }
      })
    )

    // Generate PR summary รวม
    const prSummaryResult = await generateWithRetry(
      PR_SUMMARY_PROMPT(fileAnalyses.map(f => f.summary), stats)
    )

    // Merge ทุกอย่าง
    const merged = mergeResults(fileAnalyses, prSummaryResult.summary, stats)

    return Response.json(merged)

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
        { error: 'Gemini is experiencing high demand. Please try again.' },
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
