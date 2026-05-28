import type { MergedResult } from './mergeResults'

export const MOCK_DIFF_RESULT: MergedResult = {
  summary: "Refactored Button and Modal components. Button now uses semantic color tokens instead of hardcoded hex values. Modal improved with proper accessibility attributes including focus management and ARIA roles.",
  ds_violations: [
    {
      code: "DS002",
      issue: "Hardcoded color '#1A73E8' detected in Button.tsx",
      fix: "Replace with var(--color-primary)",
      severity: "error",
      line: 4,
      filename: "src/components/Button.tsx",
    },
    {
      code: "DS001",
      issue: "Hardcoded spacing '13px' not in spacing scale",
      fix: "Replace with var(--spacing-3) = 12px",
      severity: "warning",
      line: 8,
      filename: "src/components/Button.tsx",
    },
  ],
  a11y_issues: [
    {
      issue: "Modal overlay div uses onClick but is not keyboard accessible",
      fix: "Replace div with button or add role='button' + onKeyDown",
      wcag: "A11Y005 / 2.1.1",
      severity: "error",
      line: 12,
      filename: "src/components/Modal.tsx",
    },
    {
      issue: "Close button has no accessible name",
      fix: "Add aria-label='Close modal'",
      wcag: "A11Y001 / 4.1.2",
      severity: "error",
      line: 15,
      filename: "src/components/Modal.tsx",
    },
  ],
  files: [
    {
      filename: "src/components/Button.tsx",
      ds_violations: [
        {
          code: "DS002",
          issue: "Hardcoded color '#1A73E8'",
          fix: "Replace with var(--color-primary)",
          severity: "error",
          line: 4,
        },
        {
          code: "DS001",
          issue: "Hardcoded spacing '13px'",
          fix: "Replace with var(--spacing-3)",
          severity: "warning",
          line: 8,
        },
      ],
      a11y_issues: [],
    },
    {
      filename: "src/components/Modal.tsx",
      ds_violations: [],
      a11y_issues: [
        {
          issue: "Modal overlay not keyboard accessible",
          fix: "Use button element or add keyboard handler",
          wcag: "A11Y005 / 2.1.1",
          severity: "error",
          line: 12,
        },
        {
          issue: "Close button missing accessible name",
          fix: "Add aria-label='Close modal'",
          wcag: "A11Y001 / 4.1.2",
          severity: "error",
          line: 15,
        },
      ],
    },
  ],
  stats: {
    totalFiles: 3,
    relevantFiles: 2,
    skippedFiles: 1,
    totalDsViolations: 2,
    totalA11yIssues: 2,
  },
}
