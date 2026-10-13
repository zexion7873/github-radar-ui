// Layout-neutral, so it never promises a grid the page won't render.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-full rounded-none bg-border/60" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-none bg-border/60" />
      ))}
    </div>
  );
}
