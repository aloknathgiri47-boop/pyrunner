import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "PyRunner — Online Python Compiler",
  description: "Write, run, and share Python code right in your browser. A fast, clean, sandboxed Python 3 code playground with stdin support, syntax highlighting, and live output.",
  keywords: ["Python", "compiler", "online IDE", "Python playground", "code runner", "Python 3", "snippet", "Z.ai"],
  authors: [{ name: "Z.ai" }],
  manifest: "/manifest.json",
  icons: {
    // Classic .ico (multi-resolution 16/32/48) for legacy browsers + IE/Edge.
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Apple touch icon (180x180) — used by iOS Safari for "Add to Home Screen".
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    // PWA / Android Chrome maskable icons (192, 512) — referenced from manifest too.
    other: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "PyRunner",
    statusBarStyle: "black-translucent",
  },
  applicationName: "PyRunner",
  openGraph: {
    title: "PyRunner — Online Python Compiler",
    description: "Write, run, and share Python code right in your browser.",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PyRunner — Online Python Compiler",
    description: "Write, run, and share Python code right in your browser.",
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
