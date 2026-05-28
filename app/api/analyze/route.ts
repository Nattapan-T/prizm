import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { parseDiff, getRelevantFiles, getDiffStats } from '@/lib/parseDiff'
import { mergeResults } from '@/lib/mergeResults'
import { MOCK_DIFF_RESULT } from '@/lib/mockResult'

export const maxDuration = 60 // seconds — Vercel Hobby plan max

// ── Schemas ─────────────────────────────────────────────────

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

const CommitSchema = z.object({
  type: z.enum(['feat', 'fix', 'refactor', 'style', 'test', 'docs', 'chore', 'perf']),
  scope: z.string().optional().describe('Component name or module, e.g. Button or auth'),
  description: z.string().max(72).describe('Imperative, present tense, max 72 chars'),
  body: z.string().optional().describe('Optional 2–3 line explanation of why, not what'),
  breaking_change: z.boolean(),
  breaking_change_description: z.string().optional(),
})

const PRTemplateSchema = z.object({
  what: z.string().describe('What does this MR do? 2–3 sentences'),
  how: z.string().describe('Key implementation decisions, 2–4 sentences'),
  testing: z.string().describe('Step-by-step testing instructions'),
})

// ── Prompts ──────────────────────────────────────────────────

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

const COMMIT_PROMPT = (diff: string) => `
You are an expert at writing Conventional Commits.
Analyze this git diff and generate a commit message.

Format: <type>(<scope>): <description>

Types: feat, fix, refactor, style, test, docs, chore, perf
Scope: component name or module (optional, keep short)
Description: imperative, present tense, max 72 chars

For body: optional 2–3 line explanation of WHY (not what).
For breaking_change: set true only if the API/interface changed in a non-backward-compatible way.

Diff:
\`\`\`diff
${diff}
\`\`\`
`

const PR_TEMPLATE_PROMPT = (diff: string) => `
You are a senior engineer writing a GitLab/GitHub MR description.
Analyze this diff and fill in the following fields:

- what: What does this MR do? (2–3 sentences summarizing the change)
- how: How was this implemented? (key technical decisions, 2–4 sentences)
- testing: How to test? (step-by-step, numbered list as a plain string)

Be specific and professional. Focus on the actual changes in the diff.

Diff:
\`\`\`diff
${diff}
\`\`\`
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

// Generic retry wrapper — works with any Zod schema
async function generateWithSchema<T>(
  schema: z.ZodType<T>,
  prompt: string,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema,
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
      await new Promise(r => setTimeout(r, 1500))
      return Response.json(MOCK_DIFF_RESULT)
    }

    // ── Single file mode ──────────────────────────────────
    if (mode === 'single') {
      const result = await generateWithSchema(AnalysisSchema, SINGLE_PROMPT(code))
      return Response.json(result)
    }

    // ── Git diff mode ─────────────────────────────────────
    const parsed = parseDiff(code)
    const relevant = getRelevantFiles(parsed)
    const stats = getDiffStats(parsed)

    if (relevant.length === 0) {
      return Response.json({
        error: 'No frontend files found in this diff',
        detail: `Found ${parsed.length} files but none are frontend files (.tsx, .ts, .css etc.)`,
      }, { status: 422 })
    }

    // Run per-file analysis + commit + PR template in parallel
    const [fileAnalyses, commitResult, prTemplateResult] = await Promise.all([
      Promise.all(
        relevant.map(async (file) => {
          const result = await generateWithSchema(
            AnalysisSchema,
            DIFF_FILE_PROMPT(file.filename, file.hunks)
          )
          return {
            filename: file.filename,
            summary: result.summary,
            ds_violations: result.ds_violations,
            a11y_issues: result.a11y_issues,
          }
        })
      ),
      generateWithSchema(CommitSchema, COMMIT_PROMPT(code)).catch(() => null),
      generateWithSchema(PRTemplateSchema, PR_TEMPLATE_PROMPT(code)).catch(() => null),
    ])

    // PR summary needs file summaries — runs after file analyses
    const prSummaryResult = await generateWithSchema(
      AnalysisSchema,
      PR_SUMMARY_PROMPT(fileAnalyses.map(f => f.summary), stats)
    )

    const merged = mergeResults(
      fileAnalyses,
      prSummaryResult.summary,
      stats,
      commitResult,
      prTemplateResult,
    )

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
