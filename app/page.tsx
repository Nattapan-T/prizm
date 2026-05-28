import Link from "next/link";

export default function Landing() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Inter', system-ui, sans-serif",
    }}>

      {/* Nav */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🔮</span>
          <span style={{ fontWeight: 700, fontSize: "20px", letterSpacing: "-.02em" }}>
            PR<span style={{ color: "var(--brand)" }}>etina</span>
          </span>
        </div>
        <Link
          href="/app"
          style={{
            padding: "8px 18px",
            background: "var(--brand)",
            color: "#fff",
            borderRadius: "var(--r-md)",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
            transition: "opacity .15s",
          }}
        >
          Open Tool →
        </Link>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "6rem 1.5rem 4rem",
        textAlign: "center",
        position: "relative",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "300px",
          background: "radial-gradient(ellipse, #6366f130 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 14px",
          border: "1px solid var(--border-default)",
          borderRadius: "999px",
          fontSize: "12px",
          color: "var(--text-tertiary)",
          marginBottom: "1.5rem",
          background: "var(--bg-elevated)",
        }}>
          <span style={{ color: "var(--success)", fontSize: "8px" }}>●</span>
          Powered by Gemini 2.5 Flash
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(2.5rem, 6vw, 4rem)",
          fontWeight: 800,
          letterSpacing: "-.04em",
          lineHeight: 1.05,
          marginBottom: "1.25rem",
          background: "linear-gradient(135deg, #fff 0%, #9090c0 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          See what others miss.
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
          color: "var(--text-tertiary)",
          lineHeight: 1.7,
          maxWidth: "520px",
          margin: "0 auto 2.5rem",
        }}>
          AI-powered code review for frontend teams. Catch Design System violations,
          accessibility issues, and generate PR docs — instantly.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/app"
            style={{
              padding: "14px 32px",
              background: "var(--brand)",
              color: "#fff",
              borderRadius: "var(--r-md)",
              fontSize: "15px",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-.01em",
            }}
          >
            Try PRetina free →
          </Link>
          <Link
            href="https://github.com/Nattapan-T/prizm"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "14px 32px",
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--r-md)",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "0 1.5rem 5rem",
      }}>
        {/* Section label */}
        <p style={{
          textAlign: "center",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          color: "var(--text-tertiary)",
          marginBottom: "2rem",
        }}>
          What PRetina checks
        </p>

        {/* Feature cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}>
          {[
            {
              icon: "◈",
              color: "var(--error)",
              title: "DS Violations",
              desc: "Catches hardcoded colors, spacing, typography, and border radius that should use design tokens.",
              codes: ["DS001", "DS002", "DS003", "DS004"],
            },
            {
              icon: "◎",
              color: "var(--warning)",
              title: "Accessibility Issues",
              desc: "Detects missing ARIA labels, broken focus management, keyboard navigation gaps, and WCAG violations.",
              codes: ["A11Y001", "A11Y002", "A11Y005"],
            },
            {
              icon: "📄",
              color: "var(--brand)",
              title: "PR Summary",
              desc: "Generates a clear, professional PR description from your diff. Copy as GitHub Markdown in one click.",
              codes: ["Markdown", "Multi-file", "Git diff"],
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--r-xl)",
                padding: "1.5rem",
              }}
            >
              <div style={{
                fontSize: "1.25rem",
                marginBottom: ".75rem",
                color: f.color,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: "15px",
                fontWeight: 700,
                marginBottom: ".5rem",
                color: "var(--text-primary)",
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: "13px",
                color: "var(--text-tertiary)",
                lineHeight: 1.7,
                marginBottom: "1rem",
              }}>
                {f.desc}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {f.codes.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: "10px",
                      fontFamily: "monospace",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "4px",
                      background: `${f.color}15`,
                      color: f.color,
                      border: `1px solid ${f.color}30`,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "0 1.5rem 5rem",
        textAlign: "center",
      }}>
        <p style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          color: "var(--text-tertiary)",
          marginBottom: "2rem",
        }}>
          How it works
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
        }}>
          {[
            { step: "01", title: "Paste your code", desc: "Paste a single component or full git diff from your PR" },
            { step: "02", title: "AI analyzes", desc: "Gemini 2.5 Flash checks every line against DS rules and WCAG guidelines" },
            { step: "03", title: "Ship with confidence", desc: "Fix violations, copy the PR summary, and merge knowing it's clean" },
          ].map((s) => (
            <div key={s.step} style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-xl)",
              padding: "1.5rem 1.25rem",
            }}>
              <div style={{
                fontSize: "11px",
                fontFamily: "monospace",
                fontWeight: 700,
                color: "var(--brand)",
                marginBottom: ".75rem",
                opacity: .7,
              }}>
                {s.step}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: ".5rem",
                color: "var(--text-primary)",
              }}>
                {s.title}
              </h3>
              <p style={{
                fontSize: "13px",
                color: "var(--text-tertiary)",
                lineHeight: 1.65,
              }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section style={{
        textAlign: "center",
        padding: "0 1.5rem 6rem",
      }}>
        <div style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-xl)",
          padding: "2.5rem 2rem",
        }}>
          <h2 style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-.03em",
            marginBottom: ".75rem",
          }}>
            Ready to review?
          </h2>
          <p style={{
            fontSize: "13px",
            color: "var(--text-tertiary)",
            marginBottom: "1.5rem",
            lineHeight: 1.7,
          }}>
            Free to use. No signup required. Powered by Gemini 2.5 Flash.
          </p>
          <Link
            href="/app"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "var(--brand)",
              color: "#fff",
              borderRadius: "var(--r-md)",
              fontSize: "14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open PRetina →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "1.5rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}>
        <span style={{ fontSize: "13px", fontWeight: 700 }}>
          PR<span style={{ color: "var(--brand)" }}>etina</span>
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          Built with Next.js · Gemini 2.5 Flash · Open Source
        </span>
        <Link
          href="https://github.com/Nattapan-T/prizm"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "12px", color: "var(--text-tertiary)", textDecoration: "none" }}
        >
          GitHub →
        </Link>
      </footer>

    </div>
  );
}
