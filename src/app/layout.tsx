import type { Metadata } from "next";
import { Suspense } from "react";
import { Fredoka, Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodeQuest",
  description: "Live coding quiz games for K-12 classrooms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense>
          <Nav />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Suspense fallback={<p className="text-slate-400">Loading…</p>}>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}
