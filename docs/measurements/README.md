# TWS-50 measurements (checkpoints 6 and 7)

Recorded 2026-10-06 on the `tws-50-angular-frontend` branch. Mode: owner. Not logged in.

## Checkpoint 6: front end

Production build (`ng build`) served gzip-compressed with the same API proxy as the dev server.
Lighthouse 13.5.0, default mobile emulation (412 px wide), Chrome headless.

| Page    | Performance | Accessibility | Best practices | Page weight | LCP   | Requests |
| ------- | ----------- | ------------- | -------------- | ----------- | ----- | -------- |
| Gallery | 99          | 100           | 96             | 95.1 KiB    | 2.0 s | 8        |
| Log in  | 99          | 100           | 96             | 103.1 KiB   | 2.0 s | 8        |

- Best practices loses points only for `errors-in-console`: the browser logs the expected 401 from `/me`
  when logged out, and the 405 from `GET /photos` (that route does not exist in the API yet).
- Accessibility check: Lighthouse's axe-based audits, 0 failures on both pages. Keyboard use was built for
  (native buttons, links and inputs, skip link, visible focus ring, labeled fields, `role="alert"` messages)
  but not walked through by hand.
- Screenshots: `gallery-desktop.png`, `login-desktop.png` (1280×800), `gallery-mobile.jpg`, `login-mobile.jpg`
  (Lighthouse's mobile final frame).
- Not captured: a gallery with photos, upload and delete controls, or the signup page. The API has no
  `GET /photos`, and logged-in or accounts-mode screens need credentials or a mode change.
- Baseline comparison: the legacy app could not be run, so it has no numbers to compare.

## Checkpoint 7: whole repo

| Measure                                   | Result                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm audit`, `client/`                    | 0 total (0 critical, 0 high, 0 moderate, 0 low)                                          |
| `npm audit`, repo root (legacy Node app)  | 3 high, 3 total. Unchanged from baseline; the legacy app is still in the repo            |
| Client unit tests (Vitest)                | 17 passed / 17 (3 files)                                                                 |
| API tests (`dotnet test`)                 | 0 tests in `tests/Api.Tests`                                                             |
| Fresh install + build of `client/`        | `npm ci` 3.2 s (warm npm cache), `ng build` 2.5 s                                        |
| Fresh clone to running app, README only   | Not measurable yet: README.md still describes the legacy app and has no setup steps (TWS-23) |

## What was learned

1. Skeleton: the proxy shares `/login` and `/signup` with client routes, so it needs a bypass that serves
   `index.html` when a browser navigates (a GET that accepts HTML).
2. Gallery: the front end was written to the agreed contract, and running it showed the API is missing `GET /photos`.
3. Login: the UI only hides controls; the API is the real check, and a 401 mid-session refreshes `/me` so the header and controls catch up.
6. `ng serve --configuration production` reports about 1.8 MB and performance 56 because of dev-server scripts; measure the built `dist/` instead.
7. The client has 0 audit findings; the 3 high are all in the legacy Node app that is still at the repo root.
