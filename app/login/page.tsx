import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form action={login} className="flex w-full max-w-xs flex-col gap-3">
        <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          🔒 Loot 需要密碼
        </p>
        <input type="hidden" name="from" value={from ?? "/"} />
        <input
          type="password"
          name="password"
          aria-label="密碼"
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
          placeholder="輸入密碼"
          autoFocus
          autoComplete="current-password"
          className="rounded-none border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
        />
        {error && (
          <p
            id="login-error"
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            密碼錯誤，再試一次。
          </p>
        )}
        <button
          type="submit"
          className="rounded-none bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-accent"
        >
          進入
        </button>
      </form>
    </div>
  );
}
