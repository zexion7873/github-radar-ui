# Privacy

GitHub Radar has no accounts for visitors, no sign-up and no tracking cookies.
It uses two Vercel products to measure traffic and page speed, and two cookies
of its own, one of which only the owner ever receives.

## Analytics

The site loads **Vercel Web Analytics** and **Vercel Speed Insights**.

- **Web Analytics** records page views: the time, the URL and route, the
  referrer, filtered query parameters, an approximate location, and your
  browser, OS and device type. It uses no cookies. Vercel identifies a visitor
  by a hash of the incoming request and discards it after 24 hours, and does not
  tie the data to an IP address.
- **Speed Insights** records page-load performance (Web Vitals) with the route,
  URL, network speed, browser, OS, device type and country. Vercel states it is
  not tied to any individual visitor or IP address.

Vercel's own pages describe both in full:
[Web Analytics](https://vercel.com/docs/analytics/privacy-policy) and
[Speed Insights](https://vercel.com/docs/speed-insights/privacy-policy). The
site sends no custom analytics events.

## Cookies

| Cookie | Who gets it | Contents | Lifetime |
|---|---|---|---|
| `theme` | Anyone who uses the light / dark toggle | `light` or `dark` | 1 year |
| `gh_radar` | The owner, after logging in to `/loot` | An expiry and its HMAC signature, nothing about you | 30 days |

## Login attempts

When someone submits the login form, the server counts failed attempts per IP
address to slow down password guessing. The count lives only in the memory of
the server instance that handled the request, for at most 10 minutes, and is
never written to disk or to Notion.

## Hosting

The site runs on Vercel, which processes requests as its host under
[Vercel's privacy notice](https://vercel.com/legal/privacy-policy).

## Questions

Open an issue at <https://github.com/zexion7873/github-radar-ui/issues>, or
report a vulnerability privately as described in [SECURITY.md](SECURITY.md).
