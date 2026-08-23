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
  // Favicon, SVG icon, and apple-touch-icon are provided via the Next.js
  // file convention (src/app/favicon.ico, src/app/icon.svg,
  // src/app/apple-icon.png). Next.js automatically emits the correct
  // <link rel="icon"> / <link rel="apple-touch-icon"> tags with hashed
  // URLs for cache busting. We intentionally do NOT set metadata.icons
  // here to avoid duplicate link tags.
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
