import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sightline", template: "%s · Sightline" },
  description:
    "Sightline is the SaaS control plane: every vendor, seat, dollar, overage and renewal for the whole company in one place.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/** Applies the stored theme before first paint so the page never flashes. */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("sl-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
