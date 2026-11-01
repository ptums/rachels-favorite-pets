# Results

## Lighthouse (migrated app)

Mobile, simulated throttling, single run, Oct 8 2026. Production build served from the API with response compression, signed in as owner (so the upload form was visible).

| Category       | Score |
| -------------- | ----- |
| Performance    | 85    |
| Accessibility  | 100   |
| Best Practices | 96    |
| SEO            | 100   |

| Metric         | Value                           |
| -------------- | ------------------------------- |
| FCP            | 1.9 s                           |
| LCP            | 4.1 s                           |
| TBT            | 0 ms                            |
| CLS            | 0.018                           |
| Total transfer | 496 KiB                         |
| Main JS        | 112 KB transferred (280 KB raw) |
| CSS            | 49 KB transferred (232 KB raw)  |

## Methodology note

My first measurement was invalid: it ran against the Angular dev server, which serves unminified bundles. The second was also wrong: a static server that didn't route API calls, so the app rendered an empty gallery and returned `index.html` for `/config` and `/me`. The fix was serving the build from the API and enabling response compression. Compression did most of the speed work (CSS 232 KB to 49 KB on the wire, main JS 280 KB to 112 KB); serving from the API fixed correctness.

## Dependency check

`npm audit` in `api/` on Oct 20 2026: 0 vulnerabilities (147 packages audited, including transitive ones). This is a point-in-time check against the npm advisory database, not a guarantee.

Re-run Nov 1 2026: 2 new high alerts had appeared (body-parser, multer). `npm audit fix` moved body-parser 2.3.0 to 2.4.0 and multer 2.4.0 to 2.5.0, and `npm audit` in `api/` is back to 0. `npm run typecheck` passes.

## Fresh-clone setup

Oct 8 2026, macOS, following only the "Try it" steps in the README (open mode) from a new clone of `master` into `/tmp/fresh-test`, with brand-new emulator containers:

| Measure                                                  | Value                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `git clone` to `curl http://localhost:5017/config` → JSON | 17 s (16 s on the first run)                                |
| Of which `npm start` to first response                   | 3 s                                                         |
| Commands                                                 | 13 lines (10 excluding `cd`), including the `curl` check    |
| Steps that failed or needed a guess                      | None for the zero-config path, first try on both runs. Second run found one gap in the owner path (below), now fixed. |

Measured twice, the second time after correcting the open-mode docs. Also checked after startup, in the same clone, following the README:

| Check                                                              | Result                |
| ------------------------------------------------------------------ | --------------------- |
| `GET /` serves the Angular app                                      | 200                   |
| Open mode, anonymous `POST /photos`                                 | 200                   |
| Open mode, anonymous `GET /photos`                                  | 401                   |
| `npm run -s hash` output pasted into `OWNER_PASSWORD_HASH`          | accepted              |
| Open mode + owner: login, list, image, delete                       | 200, listed, 200, 204 |
| Owner mode: anonymous upload / owner login / owner upload           | 401 / 200 / 200       |
| Owner mode with the owner lines removed                             | refuses to start, names the fix |
| Second `npm start` while one is running                             | `EADDRINUSE` (troubleshooting line) |

Gap found on the second run: "run `npm start` again" in the owner steps didn't say to stop the running API first, which led straight to the port-5017 error. The step now says to stop it.

Caveat: Docker images and the npm cache were already on the machine, so a truly cold machine will spend extra time pulling the emulator images and downloading packages.

## Delete route verification

Oct 8 2026, `AUTH_MODE=owner`. Re-run Oct 20 2026 against the TypeScript API, with the same results:

| #   | Check                                                | Result |
| --- | ---------------------------------------------------- | ------ |
| 1   | Upload test photo                                    | pass   |
| 2   | Present in DynamoDB and S3                           | pass   |
| 3   | Owner delete returns 204                             | pass   |
| 4   | Removed from DynamoDB and S3, image URL returns 404  | pass   |
| 5   | Unauthenticated delete returns 401, photo intact     | pass   |
| 6   | Nonexistent ID returns 404                           | pass   |

