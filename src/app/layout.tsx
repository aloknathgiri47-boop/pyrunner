import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "CodeHubz — Online Python Compiler",
  description: "Write, run, and share code in 24+ languages right in your browser. A fast, clean, sandboxed Python 3 code playground with stdin support, syntax highlighting, and live output.",
  keywords: ["Python", "compiler", "online IDE", "Python playground", "code runner", "Python 3", "snippet", "Z.ai"],
  authors: [{ name: "Z.ai" }],
  // No favicon, no manifest, no apple-touch-icon — completely remove
  // any icon/logo from the browser tab.
  icons: {
    icon: [],
    shortcut: [],
    apple: [],
    other: [],
  },
  appleWebApp: {
    capable: false,
  },
  openGraph: {
    title: "CodeHubz — Online Python Compiler",
    description: "Write, run, and share code in 24+ languages right in your browser.",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeHubz — Online Python Compiler",
    description: "Write, run, and share code in 24+ languages right in your browser.",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <SonnerToaster richColors position="bottom-right" />
        <Toaster />
      </body>
    </html>
  );
}
