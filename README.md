# Rachel's Favorite Pets

A small photo-gallery site, migrated from a legacy app to Angular + a Node.js/TypeScript API + Amazon DynamoDB + Amazon S3. Local development only, running against emulators.

## What it is

Visitors browse and search a gallery of animal photos. Depending on the configured auth mode, people can upload and delete photos.

| Layer       | Tech                                                   |
| ----------- | ------------------------------------------------------ |
| Frontend    | Angular (`client/`)                                    |
| API         | Node.js + TypeScript, Express 5 (`api/`), cookie auth  |
| Data        | Amazon DynamoDB (AWS SDK for JavaScript v3)            |
| Files       | Amazon S3                                              |
| Local infra | DynamoDB Local and S3Mock, via Docker                  |
| Legacy app  | The original 2015 Express app, kept in `legacy/`       |

The built Angular app is served by the API itself (`api/wwwroot`), so everything is same-origin: no proxy, no CORS.

## Prerequisites

Tested with these versions:

- Node.js 22.22+ or 24.15+ and npm. The API runs its TypeScript directly on Node (type stripping), so there is no build step. No global Angular CLI needed.
- Docker with Compose v2 (`docker compose`, not `docker-compose`)

Ports used: `5017` (API + site), `8000` (DynamoDB Local), `9090` (S3Mock).

## Run it

From a fresh clone, zero-config (open mode):

```bash
git clone https://github.com/ptums/rachels-favorite-pets.git
cd rachels-favorite-pets

# 1. Start the emulators (DynamoDB Local + S3Mock), from the repo root
docker compose up -d

# 2. Build the client and copy it into the API
cd client
npm ci
npm run build
rm -rf ../api/wwwroot && mkdir -p ../api/wwwroot
cp -R dist/client/browser/* ../api/wwwroot/

# 3. Local settings: the example works as-is (open mode, emulator endpoints)
cd ../api
cp .env.example .env

# 4. Install and run the API
npm ci
npm start
```

Open `http://localhost:5017`. Use that port, not the Angular dev server's 4200. In open mode anyone can upload, but the gallery itself (viewing and deleting) needs a login, and with the example file as-is nobody can log in yet. To see photos, add owner credentials (next section). Check the API from another terminal:

```bash
curl http://localhost:5017/config
# {"mode":"open"}
```

The API creates its DynamoDB tables and S3 bucket on startup if they are missing. DynamoDB Local runs in memory, so `docker compose down` (or restarting its container) clears all records.

### Owner mode (second path)

Owner mode has one login, configured in `api/.env`. The API stores only a password hash. Generate one from `api/`:

```bash
cd api
npm run -s hash -- 'your-password'
# scrypt:hwgZE...
```

Then set the mode and owner in `api/.env` (keep the AWS and endpoint lines from the example):

```bash
AUTH_MODE=owner
OWNER_USERNAME=rachel
OWNER_PASSWORD_HASH=scrypt:hwgZE...
```

Stop the running API (Ctrl+C in its terminal), run `npm start` again, and sign in with that username and password. If either value is missing in owner mode, the API refuses to start and says so.

The same owner lines also work in open mode: keep `AUTH_MODE=open` and add `OWNER_USERNAME` and `OWNER_PASSWORD_HASH`, and anonymous visitors can still upload while the owner logs in to view and delete.

### Troubleshooting

- **`EADDRINUSE` on port 5017**: another API instance is still running (it shows up as `node`). Find it with `lsof -nP -iTCP:5017 -sTCP:LISTEN` and stop it (`kill <PID>`), then `npm start` again.

Emulator tools:

- Inspect data with the AWS CLI and the dummy keys from `.env.example`, for example `aws dynamodb scan --table-name photos --endpoint-url http://localhost:8000` and `aws s3 ls s3://photos --endpoint-url http://localhost:9090`.
- Stop them with `docker compose down` from the repo root.

## Configuration

`api/.env` is git-ignored and loaded by `npm start` (`node --env-file-if-exists=.env`). Real environment variables take precedence over it. Start from `api/.env.example`:

| Key                                                | Meaning                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PORT`                                             | API and site port, default `5017`                                                       |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Dummy values for the emulators, which accept any key                            |
| `DYNAMODB_ENDPOINT`, `S3_ENDPOINT`                 | Emulator URLs. Leave unset to use real AWS with the normal credential chain             |
| `DYNAMODB_PHOTOS_TABLE`, `DYNAMODB_USERS_TABLE`    | Table names, created on startup if missing                                              |
| `S3_BUCKET`                                        | Photo bucket, created on startup if missing                                             |
| `SESSION_SECRET`                                   | Signs the session cookie. If unset, a random one is used and logins end on restart      |
| `AUTH_MODE`                                        | `owner`, `open`, or `accounts` (see below)                                              |
| `OWNER_USERNAME`, `OWNER_PASSWORD_HASH`            | Required in `owner` mode. Optional in `open` mode, where it is the only login (to view and delete). Hash from `npm run -s hash -- <password>` |

The keys in the example are emulator placeholders, not secrets. Never put real AWS keys or a real password hash in a tracked file.

| Mode                                           | Behavior                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `owner` (default if `AUTH_MODE` is unset)      | One account from config. Only the owner can upload and delete.                      |
| `open` (the example file)                      | No login to upload. Type and size limits apply. Viewing and deleting need a login, and the only login is the owner (if the owner is set). |
| `accounts`                                     | Signup and login routes. Users are stored in DynamoDB.                              |

Other API scripts, from `api/`: `npm run dev` (restarts on file changes) and `npm run typecheck` (`tsc`, no output files).

## Why local-only, no CI, no tests

Deliberate scope choices for a portfolio migration, not oversights: emulators only, no CI/CD pipeline, no automated tests. Verification was manual and is logged below.

## Results

### Lighthouse (migrated app)

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

### Methodology note

My first measurement was invalid: it ran against the Angular dev server, which serves unminified bundles. The second was also wrong: a static server that didn't route API calls, so the app rendered an empty gallery and returned `index.html` for `/config` and `/me`. The fix was serving the build from the API and enabling response compression. Compression did most of the speed work (CSS 232 KB to 49 KB on the wire, main JS 280 KB to 112 KB); serving from the API fixed correctness.

### Dependency check

`npm audit` in `api/` on Oct 20 2026: 0 vulnerabilities (147 packages audited, including transitive ones). This is a point-in-time check against the npm advisory database, not a guarantee.

### Fresh-clone setup

Oct 8 2026, macOS, following only the "Run it" steps above (open mode) from a new clone of `master` into `/tmp/fresh-test`, with brand-new emulator containers:

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

### Delete route verification

Oct 8 2026, `AUTH_MODE=owner`. Re-run Oct 20 2026 against the TypeScript API, with the same results:

| #   | Check                                                | Result |
| --- | ---------------------------------------------------- | ------ |
| 1   | Upload test photo                                    | pass   |
| 2   | Present in DynamoDB and S3                           | pass   |
| 3   | Owner delete returns 204                             | pass   |
| 4   | Removed from DynamoDB and S3, image URL returns 404  | pass   |
| 5   | Unauthenticated delete returns 401, photo intact     | pass   |
| 6   | Nonexistent ID returns 404                           | pass   |

## Backlog: future enhancements

Not done, on purpose. This is where I stopped.

**Documentation and verification**

- Add the legacy baseline (tag `legacy-baseline`, code now in `legacy/`) and a before/after comparison.
- Pin Node.js (`.nvmrc`). `api/package.json` declares `engines`, but nothing enforces it.
- Re-run Lighthouse 3x in Incognito (logged-out view) and record the median.

**Backend**

- `GET /photos` scans the whole table. Add a GSI on `uploadedBy` + `uploadedAt` if the gallery grows.
- Deploy target: Lambda behind API Gateway, with the static client on S3 + CloudFront.

**Performance and accessibility**

- LCP: the first gallery thumbnail is discovered late and is lazy-loaded. Eager-load the first few and add `fetchpriority="high"`.
- Banner images: convert to WebP and right-size (about 195 KiB estimated savings).
- CSS: roughly 94% of the stylesheet is unused (looks like a full Bootstrap import).
- Caching: add long `max-age` and `immutable` on hashed assets.
- Thumbnails: served at 710x430 for a ~336x203 slot; add explicit `width`/`height`.
- Accessibility: the banner link's `aria-label` doesn't contain its visible text.
