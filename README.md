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

- .NET SDK
- Node.js and the Angular CLI
- Docker (for the emulators)

## Run it

```bash
# 1. Start the emulators (Cosmos DB + Azurite)
docker compose up -d

# 2. Build the client and copy it into the API
cd client
npm install
ng build
rm -rf ../api/wwwroot && mkdir -p ../api/wwwroot
cp -R dist/client/browser/* ../api/wwwroot/
cd ..

# 3. Configure local settings
#    Create api/appsettings.Local.json (see "Configuration" below)

# 4. Run the API
cd api
dotnet run
```

Open the URL the API prints (`http://localhost:5017`). Use that port, not the Angular dev server's 4200.

Emulator tools:

- Cosmos Data Explorer: `http://localhost:1234`
- Cosmos endpoint: `8081`, Azurite blob service: `10000`

## Configuration

Auth mode is set in `api/appsettings.Local.json`:

```json
{
  "Auth": {
    "Mode": "owner"
  }
}
```

| Mode              | Behavior                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| `owner` (default) | One account from config. Only the owner can upload and delete.                      |
| `open`            | No login to upload. Type and size limits apply. Anyone can delete their own photos. |
| `accounts`        | Signup and login routes. Users are stored in Cosmos.                                |

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
- Pin and document .NET SDK and Node.js versions.
- Document the owner credentials and the Cosmos/Blob connection settings in `appsettings.Local.json`.
- Confirm the compose file location and the client `dist` path in the run steps.
- Record the exact status codes for delete checks 3, 5, and 6.
- Re-run the vulnerability check with `--include-transitive`.
- Measure fresh-clone setup: steps and time from `git clone` to a working gallery.
- Re-run Lighthouse 3x in Incognito (logged-out view) and record the median.

**Performance and accessibility**

- LCP: the first gallery thumbnail is discovered late and is lazy-loaded. Eager-load the first few and add `fetchpriority="high"`.
- Banner images: convert to WebP and right-size (about 195 KiB estimated savings).
- CSS: roughly 94% of the stylesheet is unused (looks like a full Bootstrap import).
- Caching: add long `max-age` and `immutable` on hashed assets.
- Thumbnails: served at 710x430 for a ~336x203 slot; add explicit `width`/`height`.
- Accessibility: the banner link's `aria-label` doesn't contain its visible text.
