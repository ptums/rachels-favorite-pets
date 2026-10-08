# Rachel's Favorite Pets

A small photo-gallery site, migrated from a legacy app to Angular + ASP.NET Core + Azure Cosmos DB + Azure Blob Storage. Local development only, running against emulators.

## What it is

Visitors browse and search a gallery of animal photos. Depending on the configured auth mode, people can upload and delete photos.

| Layer       | Tech                                                    |
| ----------- | ------------------------------------------------------- |
| Frontend    | Angular (`client/`)                                     |
| API         | C# ASP.NET Core (`api/`), cookie auth                   |
| Data        | Azure Cosmos DB (native NoSQL via EF Core)              |
| Files       | Azure Blob Storage                                      |
| Local infra | Cosmos DB emulator (vnext-preview), Azurite, via Docker |

The built Angular app is served by the API itself (`wwwroot`), so everything is same-origin: no proxy, no CORS.

## Prerequisites

Tested with these versions:

- .NET SDK 10 (10.0.401)
- Node.js 22.22+ or 24.15+ (Angular 22 requirement) and npm. No global Angular CLI needed.
- Docker with Compose v2 (`docker compose`, not `docker-compose`)

Ports used: `5017` (API + site), `8081` and `1234` (Cosmos emulator), `10000` (Azurite).

## Run it

From a fresh clone, zero-config (open mode):

```bash
git clone https://github.com/ptums/rachels-favorite-pets.git
cd rachels-favorite-pets

# 1. Start the emulators (Cosmos DB + Azurite), from the repo root
docker compose up -d

# 2. Build the client and copy it into the API (only client/ needs npm)
cd client
npm ci
npm run build
rm -rf ../api/wwwroot && mkdir -p ../api/wwwroot
cp -R dist/client/browser/* ../api/wwwroot/
cd ..

# 3. Local settings: the example works as-is (open mode, emulator connection strings)
cp api/appsettings.example.json api/appsettings.Local.json

# 4. Run the API
cd api
dotnet run
```

Open `http://localhost:5017`. Use that port, not the Angular dev server's 4200. Check it from another terminal:

```bash
curl http://localhost:5017/config
# {"mode":"open"}
```

### Owner mode (second path)

Owner mode has one login, configured in `api/appsettings.Local.json`. The API stores only a password hash. Generate one from `api/` (`--no-launch-profile` keeps the output to just the hash):

```bash
cd api
dotnet run --no-launch-profile -- hash 'your-password'
# AQAAAAIAAYagAAAAE...
```

Then set the mode and owner in `api/appsettings.Local.json` (keep the `Cosmos` and `BlobStorage` sections from the example):

```json
{
  "Auth": { "Mode": "owner" },
  "Owner": {
    "Username": "rachel",
    "PasswordHash": "AQAAAAIAAYagAAAAE..."
  }
}
```

Run `dotnet run` again and sign in with that username and password. If either value is missing in owner mode, the API refuses to start and says so.

### Troubleshooting

- **`address already in use` on port 5017**: another API instance is still running. Find it with `lsof -nP -iTCP:5017 -sTCP:LISTEN` and stop it (`kill <PID>`), then `dotnet run` again.

Emulator tools:

- Cosmos Data Explorer: `http://localhost:1234`
- Cosmos endpoint: `8081`, Azurite blob service: `10000`
- Stop them with `docker compose down` from the repo root.

## Configuration

`api/appsettings.Local.json` is git-ignored and loaded after `appsettings.json`, so it overrides it. Start from `api/appsettings.example.json`:

| Key                                | Meaning                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `Cosmos:Endpoint`, `Cosmos:Key`    | Cosmos emulator at `http://localhost:8081`, using the emulator's public well-known key |
| `Cosmos:DatabaseName`              | Created on startup if missing                                                           |
| `BlobStorage:ConnectionString`     | Azurite at `http://localhost:10000`, using the emulator's public well-known account key |
| `BlobStorage:PhotosContainer`      | Blob container, created on startup if missing                                           |
| `Auth:Mode`                        | `owner`, `open`, or `accounts` (see below)                                              |
| `Owner:Username`, `Owner:PasswordHash` | Required only in `owner` mode. Hash from `dotnet run --no-launch-profile -- hash <password>` |

The keys in the example are the published emulator defaults, not secrets. Never put real Azure keys or a real password hash in a tracked file.

| Mode                                           | Behavior                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `owner` (default if `Auth:Mode` is unset)      | One account from config. Only the owner can upload and delete.                      |
| `open` (the example file)                      | No login to upload. Type and size limits apply. Anyone can delete their own photos. |
| `accounts`                                     | Signup and login routes. Users are stored in Cosmos.                                |

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

`dotnet list api package --vulnerable` on Oct 8 2026: no vulnerable packages found against the configured NuGet sources. This is a point-in-time check against NuGet's advisory data, not a guarantee.

### Fresh-clone setup

Oct 8 2026, macOS, following only the "Run it" steps above (open mode) from a new clone of `master` into `/tmp/fresh-test`, with brand-new emulator containers:

| Measure                                                  | Value                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `git clone` to `curl http://localhost:5017/config` → JSON | 16 s                                                        |
| Of which `dotnet run` to first response                  | 3 s                                                         |
| Commands                                                 | 13 lines (9 excluding `cd`), including the `curl` check     |
| Steps that failed or needed a guess                      | None, first try                                             |

Also checked after startup: `GET /` returns the Angular app, and an open-mode `POST /photos` upload returns 200. Caveat: Docker images, npm cache, and NuGet packages were already on the machine, so a truly cold machine will spend extra time pulling the Cosmos emulator image and downloading packages.

### Delete route verification

Oct 8 2026, `Auth:Mode=owner`:

| #   | Check                                               | Result |
| --- | --------------------------------------------------- | ------ |
| 1   | Upload test photo                                   | pass   |
| 2   | Present in Cosmos and blob storage                  | pass   |
| 3   | Owner delete returns 2xx                            | pass   |
| 4   | Removed from Cosmos and blob, image URL returns 404 | pass   |
| 5   | Unauthenticated delete rejected, photo intact       | pass   |
| 6   | Nonexistent ID returns 404                          | pass   |

## Backlog: future enhancements

Not done, on purpose. This is where I stopped.

**Documentation and verification**

- Add the legacy baseline (tag `legacy-baseline`) and a before/after comparison.
- Pin the .NET SDK (`global.json` `sdk` section) and Node.js (`.nvmrc` / `engines`). Versions are documented under Prerequisites but not enforced.
- Record the exact status codes for delete checks 3, 5, and 6.
- Re-run the vulnerability check with `--include-transitive`.
- Re-run Lighthouse 3x in Incognito (logged-out view) and record the median.

**Performance and accessibility**

- LCP: the first gallery thumbnail is discovered late and is lazy-loaded. Eager-load the first few and add `fetchpriority="high"`.
- Banner images: convert to WebP and right-size (about 195 KiB estimated savings).
- CSS: roughly 94% of the stylesheet is unused (looks like a full Bootstrap import).
- Caching: add long `max-age` and `immutable` on hashed assets.
- Thumbnails: served at 710x430 for a ~336x203 slot; add explicit `width`/`height`.
- Accessibility: the banner link's `aria-label` doesn't contain its visible text.
