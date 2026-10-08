# TWS-50 measurements (checkpoints 6 and 7)

Recorded 2026-10-07 on the `tws-50-angular-frontend` branch, after front-end QA. API in accounts mode,
not logged in.

## Checkpoint 6: front end

Production build (`ng build`) served gzip-compressed with the same API proxy as the dev server.
Lighthouse 13.5.0, default mobile emulation (412 px wide), Chrome headless.

| Page    | Performance | Accessibility | Best practices | Page weight | LCP   | Requests |
| ------- | ----------- | ------------- | -------------- | ----------- | ----- | -------- |
| Gallery | 95          | 100           | 96             | 404.1 KiB   | 2.8 s | 21       |
| Log in  | 88          | 100           | 96             | 411.9 KiB   | 3.7 s | 22       |
| Sign up | 88          | 100           | 96             | 412.0 KiB   | 3.7 s | 22       |

- Measured after restyling with Bootstrap 5.3.8 to match the original app (gradient, Tahoma, jumbotron,
  masonry gallery, photo banner). Before the restyle the same pages were 95–103 KiB with performance 98–100.
  The added weight is mostly the 13 banner photos (296 KiB) and Bootstrap's full stylesheet
  (232 KB raw, 23 KB compressed), which also delays first paint.

- Best practices loses points only for `errors-in-console`: the browser logs the expected 401 from `/me`
  when no one is logged in.
- Accessibility check: Lighthouse's axe-based audits, 0 failures on all three pages. Keyboard use was built
  for (native buttons, links and inputs, skip link, visible focus ring, labeled fields, `role="alert"`
  messages) but not walked through by hand.
- Screenshots: `gallery-desktop.png`, `login-desktop.png`, `signup-desktop.png` (1280×800), and
  `gallery-mobile.jpg`, `login-mobile.jpg`, `signup-mobile.jpg` (Lighthouse's mobile final frame).
- Logged out, the gallery shows "Log in to see photos" instead of the grid, because the API serves the photo
  list and images only to logged-in users.
- Not captured: logged-in screens (gallery with photos, upload form, delete buttons). They need an account
  on the local API. Upload, delete and the per-user gallery were checked by hand during QA.
- Raw Lighthouse reports (`lighthouse-*.report.html` / `.json`) are kept locally and gitignored.
- Baseline comparison: the legacy app could not be run, so it has no numbers to compare.

## Checkpoint 7: whole repo

| Measure                                  | Result                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm audit`, `client/`                   | 0 total (0 critical, 0 high, 0 moderate, 0 low)                                               |
| `npm audit`, repo root (legacy Node app) | 3 high, 3 total. Unchanged from baseline; the legacy app is still in the repo                 |
| Client unit tests (Vitest)               | 18 passed / 18 (3 files)                                                                      |
| API tests (`dotnet test`)                | 0 tests in `tests/Api.Tests`                                                                  |
| Fresh install + build of `client/`       | `npm ci` 3.2 s (warm npm cache), `ng build` 2.5 s                                             |
| Fresh clone to running app, README only  | Not measurable yet: README.md still describes the legacy app and has no setup steps (TWS-23) |

## What was learned

1. Skeleton: the proxy shares `/login` and `/signup` with client routes, so it needs a bypass that serves
   `index.html` when a browser navigates (a GET that accepts HTML).
2. Gallery: writing the client to the agreed contract first surfaced the API gaps (no list route, a
   duplicate upload route) as soon as it ran against the real server.
3. Login: the UI only hides controls; the API is the real check. What the client may show has to follow
   what the API serves, so when images required login, the logged-out gallery became a login prompt.
6. Bringing back the original look costs about 300 KiB, almost all banner photos; resizing them or using
   WebP is the obvious next saving. `ng serve --configuration production` reports about 1.8 MB and performance 56 because of dev-server
   scripts; measure the built `dist/` instead.
7. The client has 0 audit findings; the 3 high are all in the legacy Node app that is still at the repo root.
