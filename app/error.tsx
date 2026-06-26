"use client";

// `error` is logged by Next automatically; we deliberately don't render its raw
// message (it can echo Notion API internals like data-source UUIDs into the page).
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p className="font-semibold">出了點問題</p>
      <p className="mt-1 text-red-700/80 dark:text-red-300/80">
        請重試；若持續發生，檢查資料來源設定。
      </p>
      <button
        onClick={reset}
        className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-red-950"
      >
        重試
      </button>
    </div>
  );
}
