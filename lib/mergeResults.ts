import type { getDiffStats } from './parseDiff'

export type Violation = {
  line?: number
  code: string
  issue: string
  fix: string
  severity: 'error' | 'warning' | 'info'
}

export type A11yIssue = {
  line?: number
  issue: string
  fix: string
  wcag: string
  severity: 'error' | 'warning' | 'info'
}

export type FileResult = {
  filename: string
  ds_violations: Violation[]
  a11y_issues: A11yIssue[]
}

export type MergedResult = {
  summary: string
  ds_violations: Violation[]
  a11y_issues: A11yIssue[]
  files: FileResult[]
  stats: {
    totalFiles: number
    relevantFiles: number
    skippedFiles: number
    totalDsViolations: number
    totalA11yIssues: number
  }
}

export function mergeResults(
  fileResults: FileResult[],
  summary: string,
  diffStats: ReturnType<typeof getDiffStats>
): MergedResult {
  const allDsViolations = fileResults.flatMap(f =>
    f.ds_violations.map(v => ({ ...v, filename: f.filename }))
  )
  const allA11yIssues = fileResults.flatMap(f =>
    f.a11y_issues.map(v => ({ ...v, filename: f.filename }))
  )

  return {
    summary,
    ds_violations: allDsViolations,
    a11y_issues: allA11yIssues,
    files: fileResults,
    stats: {
      totalFiles: diffStats.totalFiles,
      relevantFiles: diffStats.relevantFiles,
      skippedFiles: diffStats.skippedFiles,
      totalDsViolations: allDsViolations.length,
      totalA11yIssues: allA11yIssues.length,
    },
  }
}
