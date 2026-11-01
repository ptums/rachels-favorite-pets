# Rachel's Favorite Pets: a 2015 photo gallery, rebuilt

Rachel's Favorite Pets is a small photo gallery. Visitors browse and search animal photos, and, depending on the login mode, people can upload and delete them.

I first built it around 2015 with Express, Passport and MySQL. It no longer ran: the README had no setup steps, `package.json` was missing at least 5 of the packages the code imports, and `npm start` failed on the first line. The original is kept in `legacy/` for comparison.

This is the migrated version: Angular on the front, a Node.js + TypeScript API, Amazon DynamoDB for records and Amazon S3 for photos. I did the migration with Claude Code as a working partner, to see how far AI could get me in a stack I had never used. It runs locally against emulators, so you don't need an AWS account to try it.

I wrote about the migration here: [Modernizing Rachel's Favorite Pets with AI](https://tumulty.me/words/modernizing-rachels-favorite-pets-with-ai).

## The results

|                     | 2015 app                          | This rebuild                       |
| ------------------- | --------------------------------- | ---------------------------------- |
| Runs from the repo  | No (`Cannot find module 'express'`) | Yes, 17 seconds from `git clone` |
| Setup steps         | None                              | 1 section, works on the first try  |
| Packages declared   | 3 (5+ more imported, not listed)  | All, with a lock file              |
| `npm audit`         | 3 high                            | 0                                  |
| Lighthouse (mobile) | Never ran                         | 85 / 100 / 96 / 100                |

Lighthouse scores are Performance, Accessibility, Best Practices and SEO. The full numbers and how they were measured are in [docs/RESULTS.md](docs/RESULTS.md). The state of the old app is in [BASELINE.md](BASELINE.md).

## How it works

```
browser ──> Express API (:5017) ──> DynamoDB (records)
            serves the Angular  └──> S3 (photo files)
            build, cookie auth
```

- The API serves the built Angular app itself, so everything is same-origin. No proxy, no CORS.
- On startup the API creates its DynamoDB tables and S3 bucket if they are missing.
- Node runs the TypeScript directly (type stripping), so there is no build step for the API. `tsc` only checks types.
- Login has 3 modes, set by `AUTH_MODE`: `owner` (1 login from config, the default), `open` (anyone can upload, the owner views and deletes) and `accounts` (signup and login, users stored in DynamoDB).

## Try it

You need Node 22.22+ (or 24.15+), npm and Docker with Compose v2.

```bash
docker compose up -d                 # DynamoDB Local (8000) and S3Mock (9090)

cd client && npm ci && npm run build
rm -rf ../api/wwwroot && mkdir -p ../api/wwwroot
cp -R dist/client/browser/* ../api/wwwroot/

cd ../api && cp .env.example .env    # open mode, emulator endpoints
npm ci && npm start
```

Open http://localhost:5017. `curl http://localhost:5017/config` returns `{"mode":"open"}`.

In open mode anyone can upload, but viewing the gallery needs the owner login. To add one, make a password hash and put it in `api/.env`:

```bash
npm run -s hash -- 'your-password'   # prints scrypt:...
```

```bash
OWNER_USERNAME=rachel
OWNER_PASSWORD_HASH=scrypt:...
```

Stop the API (Ctrl+C), run `npm start` again, and sign in. Set `AUTH_MODE=owner` too if only the owner should upload.

Other useful commands:

- `npm run dev` (in `api/`) restarts the API on file changes.
- `npm run typecheck` (in `api/`) checks types. No output means no errors.
- `docker compose down -v` stops the emulators and deletes the stored data.
- The DynamoDB table browser is at http://localhost:8002.
- `EADDRINUSE` on port 5017 means another API is still running. Find it with `lsof -nP -iTCP:5017 -sTCP:LISTEN`.

All settings are listed in `api/.env.example`. The keys there are emulator placeholders, not secrets.

## What's inside

| Path                 | What                                                         |
| -------------------- | ------------------------------------------------------------ |
| `client/`            | The Angular app                                              |
| `api/`               | The Express 5 API: config, DynamoDB, S3, password hashing    |
| `legacy/`            | The 2015 app, unchanged, with its failed install and run logs |
| `docs/measurements/` | Lighthouse reports and screenshots                           |
| `docker-compose.yml` | DynamoDB Local, dynamodb-admin and S3Mock                    |

Stack: Angular, Node.js + TypeScript, Express 5, AWS SDK for JavaScript v3, DynamoDB Local and S3Mock in Docker.

## How it was built

| File                                     | What                                                    |
| ---------------------------------------- | ------------------------------------------------------- |
| [BASELINE.md](BASELINE.md)               | The state of the 2015 app before the migration          |
| [STACK.md](STACK.md)                     | The stack I chose, and what each choice should fix      |
| [LEARNINGS.md](LEARNINGS.md)             | What I learned, and how AI changed the work             |
| [docs/RESULTS.md](docs/RESULTS.md)       | Lighthouse, `npm audit`, fresh-clone and delete checks  |
| [docs/AGENT-LOG.md](docs/AGENT-LOG.md)   | Time spent with the agent, per ticket                   |

It is local-only on purpose, with no CI and no automated tests. Verification was by hand, and it is logged in docs/RESULTS.md. Next steps I left open: a GSI so `GET /photos` doesn't scan the whole table, a deploy to Lambda and API Gateway with the client on S3 and CloudFront, and the Lighthouse fixes for LCP, images and unused CSS.
