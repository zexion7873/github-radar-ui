import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import ThemeToggle from "@/components/ThemeToggle";
import { logout } from "@/app/login/actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GitHub Radar",
  description: "Trending repos and loot from the GitHub routines",
};

// Runs before paint: applies the saved theme (or the system preference when
// none is saved) so the page never flashes the wrong background on load.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg font-semibold">📡 GitHub Radar</h1>
            <div className="flex items-center gap-1">
              <Nav />
              <ThemeToggle />
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  登出
                </button>
              </form>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
