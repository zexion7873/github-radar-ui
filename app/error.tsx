"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p className="font-semibold">出了點問題</p>
      <p className="mt-1 font-mono text-xs text-red-700/80 dark:text-red-300/80">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="mt-3 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white"
      >
        重試
      </button>
    </div>
  );
}
