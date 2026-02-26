import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import { CursorAura } from "@/components/app/cursor-aura";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AskMyNotes",
  description: "Subject-scoped AI study assistant for your own notes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='askmynotes-theme';var stored=localStorage.getItem(key);var mode=(stored==='light'||stored==='dark'||stored==='system')?stored:'system';var dark=(mode==='dark')||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.themeMode=mode;}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${plexMono.variable} antialiased`}>
        {children}
        <CursorAura />
        <ThemeToggle />
        <ToasterProvider />
      </body>
    </html>
  );
}
