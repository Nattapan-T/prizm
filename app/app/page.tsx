"use client";

import { useState, useRef } from "react";
import Editor from "@monaco-editor/react";

// ── Types ──────────────────────────────────────────────────
type Violation = {
  line?: number;
  code: string;
  issue: string;
  fix: string;
  severity: "error" | "warning" | "info";
  filename?: string; // injected by mergeResults in diff mode
};

type A11yIssue = {
  line?: number;
  issue: string;
  fix: string;
  wcag: string;
  severity: "error" | "warning" | "info";
  filename?: string; // injected by mergeResults in diff mode
};

// Single file result (mode: single)
type SingleResult = {
  summary: string;
  ds_violations: Violation[];
  a11y_issues: A11yIssue[];
};

// Per-file result (mode: diff)
type FileResult = {
  filename: string;
  ds_violations: Violation[];
  a11y_issues: A11yIssue[];
};

// Multi-file result (mode: diff)
type DiffResult = {
  summary: string;
  ds_violations: Violation[];
  a11y_issues: A11yIssue[];
  files: FileResult[];
  stats: {
    totalFiles: number;
    relevantFiles: number;
    skippedFiles: number;
    totalDsViolations: number;
    totalA11yIssues: number;
  };
};

type AnalysisResult = SingleResult | DiffResult;
type Mode = "single" | "diff";
type TabId = "summary" | "files" | "ds" | "a11y";

function isDiffResult(r: AnalysisResult): r is DiffResult {
  return "files" in r && "stats" in r;
}

const SEV_COLOR = {
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--info)",
};
const SEV_BG = {
  error: "var(--error-bg)",
  warning: "var(--warning-bg)",
  info: "var(--info-bg)",
};

// ── Home ───────────────────────────────────────────────────
export default function Home() {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const analyze = async () => {
    if (!code.trim()) return;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setRetryCountdown(null);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, mode }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setLoading(false);
        let rem = (data?.retryAfter ?? 60) as number;
        setRetryCountdown(rem);
        const tick = () => {
          rem--;
          if (rem <= 0) { setRetryCountdown(0); retryTimerRef.current = null; return; }
          setRetryCountdown(rem);
          retryTimerRef.current = setTimeout(tick, 1000);
        };
        retryTimerRef.current = setTimeout(tick, 1000);
        return;
      }

      setLoading(false);
      if (!res.ok) { setError(data?.error ?? "Analysis failed. Please try again."); return; }
      setResult(data);
      setHasAnalyzed(true);
      setActiveTab("summary");
    } catch {
      setLoading(false);
      setError("Network error. Please check your connection and try again.");
    }
  };

  const statusMessage = loading
    ? "Analyzing code, please wait..."
    : result
      ? `Analysis complete. Found ${result.ds_violations.length} DS violations and ${result.a11y_issues.length} accessibility issues.`
      : "";

  const generateMarkdown = (r: AnalysisResult): string => {
    const sevEmoji = { error: "🔴", warning: "🟡", info: "🔵" };
    let md = `## PR Summary\n\n${r.summary}\n\n---\n\n`;

    // Stats (diff mode only)
    if (isDiffResult(r)) {
      md += `## 📊 Stats\n\n`;
      md += `- **${r.stats.relevantFiles}** frontend files analyzed`;
      if (r.stats.skippedFiles > 0) md += ` (${r.stats.skippedFiles} skipped)`;
      md += `\n- **${r.stats.totalDsViolations}** DS violations\n`;
      md += `- **${r.stats.totalA11yIssues}** accessibility issues\n\n---\n\n`;
    }

    // DS Violations
    md += `## 🎨 DS Violations (${r.ds_violations.length} found)\n\n`;
    if (r.ds_violations.length === 0) {
      md += `✅ No Design System violations detected\n\n`;
    } else {
      md += `| Severity | Line | Code | Issue | Fix |\n`;
      md += `|----------|------|------|-------|-----|\n`;
      r.ds_violations.forEach((v) => {
        const sev = `${sevEmoji[v.severity]} ${v.severity.toUpperCase()}`;
        const line = v.line ? `${v.line}` : "—";
        const code = v.code ? `\`${v.code}\`` : "—";
        md += `| ${sev} | ${line} | ${code} | ${v.issue} | ${v.fix} |\n`;
      });
      md += "\n";
    }
    md += `---\n\n`;

    // A11y
    md += `## ♿ Accessibility Issues (${r.a11y_issues.length} found)\n\n`;
    if (r.a11y_issues.length === 0) {
      md += `✅ No accessibility issues detected\n\n`;
    } else {
      md += `| Severity | Line | Issue | Fix | WCAG |\n`;
      md += `|----------|------|-------|-----|------|\n`;
      r.a11y_issues.forEach((v) => {
        const sev = `${sevEmoji[v.severity]} ${v.severity.toUpperCase()}`;
        const line = v.line ? `${v.line}` : "—";
        md += `| ${sev} | ${line} | ${v.issue} | ${v.fix} | ${v.wcag} |\n`;
      });
      md += "\n";
    }

    md += `---\n*Generated by PRetina — AI Code Review for Frontend Teams*`;
    return md;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-base)" }}>

      {/* Top nav */}
      <nav style={{
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 2rem",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "var(--bg-base)",
        backdropFilter: "blur(12px)",
        zIndex: 50,
      }}>
        {/* Logo — link กลับ landing */}
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: "20px" }}>🔮</span>
          <span style={{
            fontWeight: 700,
            fontSize: "20px",
            letterSpacing: "-.02em",
            color: "var(--text-primary)",
          }}>
            PR<span style={{ color: "var(--brand)" }}>etina</span>
          </span>
        </a>
      </nav>

      {/* aria-live region */}
      <div role="status" aria-live="polite" aria-atomic="true" style={{
        position: "absolute", width: "1px", height: "1px", padding: 0,
        margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap", border: 0,
      }}>
        {statusMessage}
      </div>

      {/* Split-screen */}
      <div id="main-content" style={{
        display: "grid",
        gridTemplateColumns: "40% 60%",
        height: "calc(100vh - 56px)",
        overflow: "hidden",
      }}>

        {/* Left: Input Zone */}
        <main aria-label="Code input" style={{
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
          overflow: "hidden",
          height: "100%",
        }}>

          {/* Editor header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg-elevated)",
          }}>
            {/* Traffic lights */}
            <div style={{ display: "flex", gap: "6px" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10B981" }} />
            </div>

            {/* Mode toggle */}
            <div style={{
              display: "flex",
              marginLeft: "8px",
              background: "var(--bg-overlay)",
              borderRadius: "var(--r-sm)",
              padding: "2px",
              gap: "2px",
            }}>
              {(["single", "diff"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setResult(null); setError(""); }}
                  aria-pressed={mode === m}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: mode === m ? "var(--bg-surface)" : "transparent",
                    color: mode === m ? "var(--text-primary)" : "var(--text-tertiary)",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all .15s",
                    letterSpacing: ".02em",
                  }}
                >
                  {m === "single" ? "Single File" : "Git Diff"}
                </button>
              ))}
            </div>

            {/* Filename label */}
            <span style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              marginLeft: "4px",
              fontFamily: "monospace",
            }}>
              {mode === "single" ? "input.tsx" : "changes.diff"}
            </span>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, minHeight: "400px" }}>
            <Editor
              height="100%"
              language={mode === "diff" ? "diff" : "typescript"}
              defaultLanguage="typescript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                renderLineHighlight: "all",
                cursorBlinking: "smooth",
                smoothScrolling: true,
                rulers: mode === "diff" ? [80] : [],
              }}
            />
          </div>

          {/* Action bar */}
          <div style={{
            padding: "16px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                {code.length > 0 ? `${code.split("\n").length} lines` : "No code"}
              </span>
              {code.length > 0 && (
                <button
                  onClick={() => { setCode(""); setResult(null); setError(""); }}
                  aria-label="Reset code editor"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <button
              onClick={analyze}
              disabled={loading || !code.trim()}
              aria-busy={loading}
              style={{
                padding: "12px 24px",
                background: loading || !code.trim() ? "var(--bg-overlay)" : "var(--brand)",
                color: loading || !code.trim() ? "var(--text-tertiary)" : "#fff",
                border: "1px solid",
                borderColor: loading || !code.trim() ? "var(--border-default)" : "var(--brand)",
                borderRadius: "var(--r-md)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading || !code.trim() ? "not-allowed" : "pointer",
                transition: "all .15s",
                letterSpacing: "-.01em",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {loading ? <><div className="loader-btn" />Analyzing...</> : <>🔮 Analyze Code</>}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" style={{
              margin: "0 16px 16px",
              background: "var(--error-bg)",
              border: "1px solid var(--error)",
              borderRadius: "var(--r-md)",
              padding: "12px 16px",
              color: "var(--error)",
              fontSize: "13px",
            }}>
              {error}
            </div>
          )}
        </main>

        {/* Right: Insight Zone */}
        <section aria-label="Analysis results" aria-live="polite" style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          background: "var(--bg-base)",
        }}>
          <div style={{ flex: 1, overflow: "hidden", padding: "16px", display: "flex", flexDirection: "column", minHeight: 0 }}>

            {retryCountdown !== null ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "40px" }}>{retryCountdown === 0 ? "✅" : "⏳"}</div>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {retryCountdown === 0 ? "Ready to retry" : "Rate limited"}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                  {retryCountdown === 0
                    ? "Quota window cleared — click Analyze to continue"
                    : <>Gemini asked us to wait.{" "}
                        <span style={{ color: "var(--warning)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {retryCountdown}s
                        </span>{" "}remaining</>
                  }
                </p>
                <button
                  onClick={() => {
                    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
                    setRetryCountdown(null);
                    analyze();
                  }}
                  style={{
                    marginTop: "4px", padding: "8px 18px", fontSize: "13px", fontWeight: 600,
                    background: retryCountdown === 0 ? "var(--brand)" : "transparent",
                    color: retryCountdown === 0 ? "#fff" : "var(--text-tertiary)",
                    border: "1px solid", borderColor: retryCountdown === 0 ? "var(--brand)" : "var(--border-default)",
                    borderRadius: "var(--r-md)", cursor: "pointer",
                  }}
                >
                  {retryCountdown === 0 ? "🔮 Analyze now" : "Skip wait"}
                </button>
              </div>

            ) : loading && !hasAnalyzed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "20px" }}>
                <div className="loader" />
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", letterSpacing: ".01em" }}>
                  {mode === "diff" ? "Analyzing files with Gemini 2.5 Flash..." : "Analyzing with Gemini 2.5 Flash..."}
                </p>
              </div>

            ) : loading && hasAnalyzed ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{
                      height: "80px", borderRadius: "var(--r-lg)",
                      background: "linear-gradient(90deg, var(--bg-surface) 0%, var(--bg-elevated) 50%, var(--bg-surface) 100%)",
                      backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite",
                    }} />
                  ))}
                </div>
                <div style={{
                  height: "52px", borderRadius: "var(--r-xl)",
                  background: "linear-gradient(90deg, var(--bg-surface) 0%, var(--bg-elevated) 50%, var(--bg-surface) 100%)",
                  backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite",
                }} />
                {[120, 90, 110].map((h, i) => (
                  <div key={i} style={{
                    height: `${h}px`, borderRadius: "var(--r-md)",
                    background: "linear-gradient(90deg, var(--bg-surface) 0%, var(--bg-elevated) 50%, var(--bg-surface) 100%)",
                    backgroundSize: "200% 100%", animation: `shimmer 1.4s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
                <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-tertiary)" }}>Re-analyzing...</p>
              </div>

            ) : !result ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", color: "var(--text-tertiary)" }}>
                <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.5 }}>🔮</div>
                <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "var(--text-secondary)" }}>
                  Ready to analyze
                </h2>
                <p style={{ fontSize: "14px", maxWidth: "320px" }}>
                  {mode === "single"
                    ? `Paste your code in the editor and click "Analyze Code"`
                    : `Paste your git diff and click "Analyze Code"`}
                </p>
              </div>

            ) : (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <ResultTabs result={result} activeTab={activeTab} setActiveTab={setActiveTab} />
              </div>
            )}
          </div>

          {/* Footer */}
          {result && (
            <div style={{
              flexShrink: 0,
              padding: "12px 24px",
              borderTop: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <CopyMarkdownButton text={generateMarkdown(result)} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function ResultTabs({ result, activeTab, setActiveTab }: {
  result: AnalysisResult;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
}) {
  const isDiff = isDiffResult(result);

  const tabs: { id: TabId; label: string; icon: string; count?: number; countColor?: string; hidden?: boolean }[] = [
    { id: "summary" as const, label: "Summary", icon: "📄" },
    {
      id: "files" as const, label: "By File", icon: "📁",
      count: isDiff ? result.files.length : 0,
      countColor: "var(--brand)",
      hidden: !isDiff,
    },
    {
      id: "ds" as const, label: "DS", icon: "◈",
      count: result.ds_violations.length,
      countColor: result.ds_violations.length > 0 ? "var(--error)" : "var(--success)",
    },
    {
      id: "a11y" as const, label: "A11y", icon: "◎",
      count: result.a11y_issues.length,
      countColor: result.a11y_issues.length > 0 ? "var(--warning)" : "var(--success)",
    },
  ].filter(t => !t.hidden);

  const visibleIds = tabs.map(t => t.id);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setActiveTab(visibleIds[(idx + 1) % visibleIds.length]); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setActiveTab(visibleIds[(idx - 1 + visibleIds.length) % visibleIds.length]); }
    else if (e.key === "Home") { e.preventDefault(); setActiveTab(visibleIds[0]); }
    else if (e.key === "End") { e.preventDefault(); setActiveTab(visibleIds[visibleIds.length - 1]); }
  };

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--r-xl)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
    }}>

      {/* Stats row — diff mode only */}
      {isDiff && (
        <div style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          fontSize: "12px",
          color: "var(--text-tertiary)",
        }}>
          <span><span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{result.stats.relevantFiles}</span> files analyzed</span>
          {result.stats.skippedFiles > 0 && <span>{result.stats.skippedFiles} skipped</span>}
          <span><span style={{ color: "var(--error)", fontWeight: 700 }}>{result.stats.totalDsViolations}</span> DS</span>
          <span><span style={{ color: "var(--warning)", fontWeight: 700 }}>{result.stats.totalA11yIssues}</span> A11y</span>
        </div>
      )}

      {/* Tab list */}
      <div role="tablist" aria-label="Analysis sections" style={{
        display: "flex",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
      }}>
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                padding: "10px 8px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: "12px",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                transition: "all .15s",
                marginBottom: "-1px",
              }}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: tab.count > 0 ? `${tab.countColor}20` : "var(--success-bg)",
                  color: tab.countColor,
                  border: `1px solid ${tab.countColor}40`,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "1rem" }}>

        {/* Summary */}
        <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary"
          hidden={activeTab !== "summary"} tabIndex={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.75, whiteSpace: "pre-wrap", flex: 1 }}>
              {result.summary}
            </p>
            <CopyButton text={result.summary} />
          </div>
        </div>

        {/* By File — diff only */}
        {isDiff && (
          <div role="tabpanel" id="panel-files" aria-labelledby="tab-files"
            hidden={activeTab !== "files"} tabIndex={0}>
            {result.files.map((file, i) => (
              <FileCard key={i} file={file} />
            ))}
          </div>
        )}

        {/* DS Violations */}
        <div role="tabpanel" id="panel-ds" aria-labelledby="tab-ds"
          hidden={activeTab !== "ds"} tabIndex={0}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {result.ds_violations.length === 0
            ? <PassMessage text="No Design System violations detected" />
            : result.ds_violations.map((v, i) => <IssueCard key={i} {...v} />)
          }
        </div>

        {/* A11y */}
        <div role="tabpanel" id="panel-a11y" aria-labelledby="tab-a11y"
          hidden={activeTab !== "a11y"} tabIndex={0}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {result.a11y_issues.length === 0
            ? <PassMessage text="No accessibility issues detected" />
            : result.a11y_issues.map((v, i) => <IssueCard key={i} {...v} />)
          }
        </div>
      </div>
    </div>
  );
}

function FileCard({ file }: { file: FileResult }) {
  const [expanded, setExpanded] = useState(true);
  const totalIssues = file.ds_violations.length + file.a11y_issues.length;
  const parts = file.filename.split("/");
  const basename = parts.pop() ?? file.filename;
  const dir = parts.length > 0 ? parts.join("/") + "/" : "";

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--r-md)",
      overflow: "hidden",
      marginBottom: "8px",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          fontSize: "10px",
          color: "var(--text-tertiary)",
          transition: "transform .15s",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          display: "inline-block",
        }}>▶</span>
        <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-primary)", fontWeight: 600, flex: 1 }}>
          {basename}
        </span>
        {dir && (
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
            {dir}
          </span>
        )}
        <div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
          {file.ds_violations.length > 0 && (
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error)30" }}>
              {file.ds_violations.length} DS
            </span>
          )}
          {file.a11y_issues.length > 0 && (
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning)30" }}>
              {file.a11y_issues.length} A11y
            </span>
          )}
          {totalIssues === 0 && (
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success)30" }}>
              ✓ Clean
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{
          padding: "10px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          {totalIssues === 0
            ? <PassMessage text="No issues found in this file" />
            : <>
                {file.ds_violations.map((v, i) => <IssueCard key={`ds-${i}`} {...v} filename={file.filename} />)}
                {file.a11y_issues.map((v, i) => <IssueCard key={`a11y-${i}`} {...v} filename={file.filename} />)}
              </>
          }
        </div>
      )}
    </div>
  );
}

function IssueCard({
  code,
  issue,
  fix,
  severity,
  wcag,
  line,
  filename,
}: {
  code?: string;
  issue: string;
  fix: string;
  severity: "error" | "warning" | "info";
  wcag?: string;
  line?: number;
  filename?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const sevLabel =
    severity === "error" ? "Error" : severity === "warning" ? "Warning" : "Info";

  const fileRef = filename ? (line ? `${filename}:${line}` : filename) : null;
  const copyPath = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't toggle expand
    if (!fileRef) return;
    navigator.clipboard.writeText(fileRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article
      aria-label={`${sevLabel}: ${issue}`}
      style={{
        background: SEV_BG[severity],
        border: `1px solid ${SEV_COLOR[severity]}30`,
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        transition: "all 0.15s ease",
      }}
    >
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Severity badge */}
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "3px 7px",
          borderRadius: "4px",
          background: `${SEV_COLOR[severity]}25`,
          color: SEV_COLOR[severity],
          flexShrink: 0,
        }}>
          {severity}
        </span>

        {/* Rule code */}
        {code && (
          <span style={{
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: 600,
            color: SEV_COLOR[severity],
            flexShrink: 0,
          }}>
            {code}
          </span>
        )}

        {/* Filename chip — copyable, CMD+P friendly */}
        {fileRef && (
          <button
            onClick={copyPath}
            title={copied ? "Copied!" : `Copy path: ${fileRef}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "none",
              background: copied ? "var(--success-bg)" : "var(--bg-overlay)",
              color: copied ? "var(--success)" : "var(--text-tertiary)",
              fontFamily: "monospace",
              fontSize: "11px",
              cursor: "pointer",
              transition: "all .15s",
              flexShrink: 0,
            }}
          >
            <span style={{ opacity: 0.6, fontSize: "10px" }}>{copied ? "✓" : "⎘"}</span>
            {filename!.split("/").pop()}{line ? `:${line}` : ""}
          </button>
        )}

        {/* Issue summary — truncate when collapsed */}
        <span style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: expanded ? "normal" : "nowrap",
          lineHeight: 1.4,
        }}>
          {issue}
        </span>

        {/* Line number */}
        {line && (
          <span style={{
            fontSize: "10px",
            color: "var(--text-tertiary)",
            fontFamily: "monospace",
            flexShrink: 0,
          }}>
            :{line}
          </span>
        )}

        {/* WCAG badge */}
        {wcag && (
          <span style={{
            fontSize: "10px",
            color: "var(--text-tertiary)",
            fontFamily: "monospace",
            background: "var(--bg-overlay)",
            padding: "2px 5px",
            borderRadius: "4px",
            flexShrink: 0,
          }}>
            {wcag.split("/")[0].trim()}
          </span>
        )}

        {/* Expand icon */}
        <span style={{
          fontSize: "10px",
          color: "var(--text-tertiary)",
          flexShrink: 0,
          transition: "transform .15s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          display: "inline-block",
        }}>
          ▼
        </span>
      </button>

      {/* Detail — only when expanded */}
      {expanded && (
        <div style={{
          padding: "0 12px 12px",
          borderTop: `1px solid ${SEV_COLOR[severity]}20`,
          paddingTop: "10px",
        }}>
          {/* Code snippet */}
          {code && (
            <div style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "6px 10px",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginBottom: "8px",
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}>
              {code}
            </div>
          )}

          {/* Full issue */}
          <p style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            marginBottom: "6px",
            lineHeight: 1.6,
            fontWeight: 500,
          }}>
            {issue}
          </p>

          {/* Fix */}
          <p style={{
            fontSize: "13px",
            color: "var(--success)",
            lineHeight: 1.6,
          }}>
            ✦ {fix}
          </p>

          {/* Full WCAG ref */}
          {wcag && (
            <p style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              marginTop: "6px",
              fontFamily: "monospace",
            }}>
              WCAG {wcag}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function PassMessage({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      color: "var(--success)", fontSize: "14px", padding: "1rem",
      background: "var(--success-bg)", borderRadius: "var(--r-md)",
      border: "1px solid var(--success)30",
    }}>
      <span style={{ fontSize: "18px" }}>✓</span>
      <span style={{ fontWeight: 500 }}>{text}</span>
    </div>
  );
}

function CopyMarkdownButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      aria-label={copied ? "Report copied to clipboard" : "Copy full analysis report as Markdown for GitHub PR"}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 16px", fontSize: "13px", fontWeight: 600,
        background: copied ? "var(--success-bg)" : "var(--brand)",
        color: copied ? "var(--success)" : "#fff",
        border: "1px solid", borderColor: copied ? "var(--success)40" : "var(--brand)",
        borderRadius: "var(--r-md)", cursor: "pointer", transition: "all .15s", letterSpacing: "-.01em",
      }}
    >
      {copied ? <>✓ Copied to clipboard</> : <>⬇ Copy full report as Markdown</>}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      aria-label="Copy to clipboard"
      style={{
        padding: "6px 12px", fontSize: "12px", fontWeight: 600,
        background: copied ? "var(--success-bg)" : "var(--bg-elevated)",
        color: copied ? "var(--success)" : "var(--text-tertiary)",
        border: "1px solid", borderColor: copied ? "var(--success)40" : "var(--border-subtle)",
        borderRadius: "var(--r-sm)", cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.02em",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}
