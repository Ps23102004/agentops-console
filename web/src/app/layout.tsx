import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "AgentOps Console",
  description: "See where an agent's context went, and what its memory is quietly costing you.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6eaf4" },
    { media: "(prefers-color-scheme: dark)", color: "#06070c" },
  ],
};

/* Applies the stored theme before first paint so the glass never flashes. */
const noFlash = `try{var t=localStorage.getItem("agentops.theme");if(t&&t!=="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: noFlash }} /></head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
