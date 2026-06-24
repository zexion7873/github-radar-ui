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
        <input type="hidden" name="from" value={from ?? "/"} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Wrong password.
          </p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
