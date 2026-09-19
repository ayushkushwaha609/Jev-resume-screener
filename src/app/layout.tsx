import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { KeyButton, KeyDialogHost } from "@/components/ApiKey";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sift — Resume screening",
  description: "Rank applicants against each role's requirements with Jev.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
            {/* Plain <a>, not <Link>: a full load always returns to a fresh home
                screen, even from the results view on the same route. Unexported
                results still trigger the browser's leave-page warning. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <span className="grid size-5 place-items-center rounded bg-fg text-[11px] font-bold text-bg">S</span>
              Sift
            </a>
            <nav className="flex gap-4 text-[13px] text-muted">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="hover:text-fg">
                Screen resumes
              </a>
              <Link href="/sample" className="hover:text-fg">
                Sample run
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-4">
              <a
                href="https://docs.typesafe.ai"
                target="_blank"
                rel="noreferrer"
                className="hidden text-xs text-muted hover:text-fg sm:inline"
              >
                Powered by Jev ↗
              </a>
              <KeyButton />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <KeyDialogHost />
      </body>
    </html>
  );
}
