import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import StickyHeader from "@/components/StickyHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { logout } from "@/app/login/actions";
import { cookies } from "next/headers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GitHub Radar",
  description: "Trending repos and loot from the GitHub routines",
};

// Only needed for first visit (no cookie yet): apply the system preference
// before paint. Once the user has a theme cookie, the server renders the class
// directly on <html> below, so it survives soft navigations (e.g. logout).
const themeScript = `(function(){try{if(/(?:^|; )theme=/.test(document.cookie))return;if(matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white dark:focus:bg-white dark:focus:text-black"
        >
          跳到主要內容
        </a>
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <StickyHeader>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">📡 GitHub Radar</h1>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle />
                <form action={logout} className="shrink-0">
                  <button
                    type="submit"
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    登出
                  </button>
                </form>
              </div>
            </div>
            <Nav />
          </StickyHeader>
          <main id="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
