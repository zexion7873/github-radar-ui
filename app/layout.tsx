import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import StickyHeader from "@/components/StickyHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { logout } from "@/app/login/actions";
import { cookies } from "next/headers";
import { isAuthed } from "@/lib/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// DM Serif Display is non-variable — only ships weight 400 — so the weight is
// required. It's the editorial voice: masthead, section heads, and big numerals.
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

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
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  // Only logged-in pages wear the chrome (title + nav + 登出). On /login the user
  // has no session, so showing nav tabs (every one bounces back to /login) and a
  // 登出 button is just a confusing dead-loop — render the bare page instead.
  const authed = isAuthed(cookieStore.get("gh_radar")?.value);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {authed && (
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-none focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background"
          >
            跳到主要內容
          </a>
        )}
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          {authed && (
            <StickyHeader>
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-serif text-xl tracking-tight">
                  📡 GitHub <span className="text-accent">Radar</span>
                </h1>
                <div className="flex shrink-0 items-center gap-1">
                  <ThemeToggle />
                  <form action={logout} className="shrink-0">
                    <button
                      type="submit"
                      className="rounded-none px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground"
                    >
                      登出
                    </button>
                  </form>
                </div>
              </div>
              <Nav />
            </StickyHeader>
          )}
          <main id="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
