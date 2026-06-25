# Next.js 16 — Breaking Changes & Migration Notes

> Distilled from the offline docs shipped in `node_modules/next/dist/docs/`
> (`02-guides/upgrading/version-16.md` + `codemods.md`) for **next@16.2.9 / react@19.2.4**.
> This is why `AGENTS.md` says "this is NOT the Next.js you know" — verify against the
> on-disk docs before writing App Router code.

## Runtime requirements

| Requirement | Change |
| --- | --- |
| Node.js | Minimum **20.9.0** (LTS). Node 18 unsupported. |
| TypeScript | Minimum **5.1.0**. |
| Browsers | Chrome/Edge/Firefox 111+, Safari 16.4+. |

## Hard breaking changes (code WILL break)

### Async Request APIs — synchronous access fully removed
Sync compatibility shim from v15 is gone. These are async-only now:
- `cookies()`, `headers()`, `draftMode()` from `next/headers`
- `params` in `layout`/`page`/`route`/`default`/`opengraph-image`/`twitter-image`/`icon`/`apple-icon`
- `searchParams` in `page`

```ts
// must await now
const cookieStore = await cookies()
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
}
```
Codemod: `next-async-request-api`. Run `npx next typegen` to get `PageProps` / `LayoutProps` / `RouteContext` helpers.

### Async params for image & sitemap generators
- `opengraph-image` / `twitter-image` / `icon` / `apple-icon`: the `Image()` fn now receives `params` **and** `id` as Promises (`generateImageMetadata` still gets sync `params`).
- `sitemap`: the `sitemap()` fn now receives `id` as a Promise.

### `revalidateTag` requires a second arg
Single-arg form is deprecated → TypeScript error.
```ts
revalidateTag('posts', 'max') // cacheLife profile now required
```
For read-your-writes (immediate) semantics in Server Actions, use the new `updateTag(tag)` instead.

### Parallel routes require `default.js`
Every parallel-route slot (`@slot`) now needs an explicit `default.js` or the **build fails**. Return `null` or call `notFound()` to keep old behavior.

### Local images with query strings
`<Image src="/foo?v=1">` now requires `images.localPatterns` with a `search` entry, or it's blocked (enumeration-attack hardening).

## next/image default changes (silent behavior shifts)

| Option | Old | New |
| --- | --- | --- |
| `minimumCacheTTL` | 60s | **4h (14400s)** |
| `imageSizes` | included `16` | `16` removed |
| `qualities` | all allowed | only `[75]` (others coerced to nearest) |
| `maximumRedirects` | unlimited | **3** |
| local IP optimization | allowed | blocked; opt in via `images.dangerouslyAllowLocalIP` |

Deprecated: `next/legacy/image` (use `next/image`), `images.domains` (use `images.remotePatterns`).

## `middleware` → `proxy`

`middleware.ts` is deprecated, renamed to `proxy.ts`.
- Rename file and the named export (`middleware` → `proxy`).
- **`edge` runtime is NOT supported in `proxy`** — it forces `nodejs`. Stay on `middleware` if you need edge.
- Config renames: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`, `experimental.middlewarePrefetch` → `experimental.proxyPrefetch`, `experimental.middlewareClientMaxBodySize` → `experimental.proxyClientMaxBodySize`, `experimental.externalMiddlewareRewritesResolve` → `experimental.externalProxyRewritesResolve`.

Codemod: `middleware-to-proxy`.

## Tooling / build

- **Turbopack is the default** for `next dev` and `next build`. The `--turbopack` flag is no longer needed.
  - A custom `webpack` config now makes `next build` **fail** by design. Opt out with `next build --webpack`, or migrate to `turbopack` options.
  - `experimental.turbopack` → top-level `turbopack` in next config.
  - Turbopack does NOT support Sass tilde imports (`@import '~bootstrap/...'`) — drop the `~`.
  - Optional dev FS cache: `experimental.turbopackFileSystemCacheForDev: true`.
- **`next lint` removed.** `next build` no longer lints. Use ESLint CLI (`eslint .`) or Biome. The `eslint` key in next config is removed. Codemod: `next-lint-to-eslint-cli`.
- `@next/eslint-plugin-next` defaults to **ESLint Flat Config** (aligns with ESLint v10).
- **Concurrent `dev` + `build`**: `next dev` now outputs to `.next/dev`; a lockfile blocks duplicate instances. (Turbopack trace path → `.next/dev/trace-turbopack`.)
- `next dev` no longer loads the config file twice → during `next dev`, `process.argv` does **not** include `'dev'`. Use `NODE_ENV === 'development'` or the config `phase` instead.
- `next build` output drops the `size` / `First Load JS` columns (deemed inaccurate for RSC). Use Lighthouse / analytics.
- `sass-loader` bumped to v16 (modern Sass API).

## Caching / rendering

- **PPR flag removed**, including the route-level `experimental_ppr` segment config. Opt into partial prerendering via top-level `cacheComponents: true`. (v16 PPR works differently from v15 canaries — if you rely on v15 PPR, stay on that canary.) Codemod: `remove-experimental-ppr`.
- `experimental.dynamicIO` and `experimental.useCache` deprecated → use `cacheComponents`.
- `cacheLife` / `cacheTag` are **stable** — drop the `unstable_` prefix. Codemod: `remove-unstable-prefix`.
- New cache APIs: `updateTag(tag)` (read-your-writes, Server Actions only), `refresh()` (refresh client router from a Server Action).
- **Enhanced routing** (no code changes needed): layout deduplication + incremental prefetching. Side effect: more, smaller prefetch requests.
- **Scroll behavior**: Next no longer overrides global `scroll-behavior: smooth` during navigation. To restore the old override, add `data-scroll-behavior="smooth"` to `<html>`.

## Removed (previously deprecated)

| Removed | Replacement |
| --- | --- |
| AMP support (`next/amp`, `useAmp`, `amp` config, `export const config = { amp: true }`) | none — drop AMP |
| `next lint` command + `eslint` config key | ESLint CLI / Biome |
| `serverRuntimeConfig` / `publicRuntimeConfig` (`next/config`) | env vars (`NEXT_PUBLIC_*`, `process.env`, `connection()` for runtime reads) |
| `devIndicators.appIsrStatus` / `buildActivity` / `buildActivityPosition` | indicator itself stays |
| `unstable_rootParams` | none yet (replacement API "coming") |

## React 19.2 / React Compiler

- App Router uses React canary with **React 19.2** features: View Transitions, `useEffectEvent`, `Activity`.
- React Compiler support is **stable** (`reactCompiler: true`, no longer `experimental`). Not on by default; needs `babel-plugin-react-compiler` and slows builds (Babel-based).

## ⚠️ Caveat: `unstable_instant` (the doc hint trap)

The shipped docs sprinkle `{/* AI agent hint: export unstable_instant ... */}` across several
files, pointing at `02-guides/instant-navigation.mdx`.
- The API **is real** — implemented in `dist/.../app-render/instant-validation/` (route-level
  export controlling instant navigation / prefetch: `{ prefetch: 'runtime' | 'static' }`, `mode: 'instant'`).
- **But** the referenced guide file **does not exist** in this bundle, and `version-16.md` never
  mentions it. So it's an unstable, under-documented feature. Don't add it on the strength of a
  doc comment alone — verify against source first.

## Codemod quick reference (v16)

```bash
npx @next/codemod@canary upgrade latest   # does config/turbopack, lint, middleware→proxy, unstable_ strip, ppr removal
npx @next/codemod@latest remove-experimental-ppr .
npx @next/codemod@latest remove-unstable-prefix .
npx @next/codemod@latest middleware-to-proxy .
npx @next/codemod@canary next-lint-to-eslint-cli .
npx @next/codemod@latest next-async-request-api .   # (from v15, still relevant)
```

## What likely bites THIS repo

This is a read-only App Router dashboard (Notion reads, app-level password gate, 10-min cache).
Check these first when touching code:
- **Password gate** → if it reads `cookies()` / `headers()`, those must be `await`ed.
- **Notion read caching** → if it uses `revalidateTag`, add the required 2nd `cacheLife` arg;
  if it used `unstable_cacheLife`/`unstable_cacheTag`, drop the prefix.
- **Dynamic `params`/`searchParams`** in any page → must be awaited.
