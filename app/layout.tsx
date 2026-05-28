import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRizm — AI Code Review for Frontend Teams",
  description:
    "Catch DS violations, accessibility issues, and generate PR docs instantly",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        {/* Skip link — keyboard/screen reader users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
