# Stack decision: Rachel's Favorite Pets migration

Recorded: 2026-10-04. Revised: 2026-10-20, backend moved to Node.js/TypeScript on AWS services (see "Revision" below). Baseline: see BASELINE.md (tag `legacy-baseline`, code in `legacy/`).

| Layer         | Choice                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend      | Angular (current version), in `client/`                                                                                                                                                                      |
| Backend       | Node.js + TypeScript, Express 5, in `api/`. Runs the `.ts` files directly with Node's type stripping; `tsc` only type-checks                                                                                 |
| Database      | Amazon DynamoDB through the AWS SDK for JavaScript v3 (`@aws-sdk/lib-dynamodb`). Two tables, `photos` and `users`, keyed by `id`. Local development uses DynamoDB Local                                     |
| Photo storage | Amazon S3. S3Mock emulator locally                                                                                                                                                                           |
| Login         | Three modes set by `AUTH_MODE`: open, owner, accounts. Build owner first                                                                                                                                    |
| Auth          | Signed cookie session (`cookie-session`), a login-check middleware on protected routes, scrypt password hashing from `node:crypto`, and our own `users` table in DynamoDB (accounts mode). Owner mode reads a hashed password from the environment |
| Configuration | Environment variables, loaded from an uncommitted `api/.env`; `api/.env.example` is committed. The emulators accept any credentials, so this project holds no real secrets                                 |
| Cloud         | AWS services through local emulators only (DynamoDB Local, S3Mock). No AWS account, no hosting, no cost. The app is not deployed to real AWS                                                               |
| Repo          | One repo: `client/`, `api/`, and the original app in `legacy/`                                                                                                                                              |
| Dropped       | A swappable `DATABASE_URL`, hosting and deployment, and real AWS services. IAM roles are not used, since they only apply to code running in AWS                                                             |

## What each choice should fix

| Baseline finding                                              | How the new stack addresses it                                                                                                                                                         | How we will measure                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cannot run from the repo; 9 undeclared packages; no lock file | Dependencies declared in `api/package.json` and `client/package.json`, lock files committed                                                                                           | Setup steps and time from fresh clone to running                         |
| Config file never documented (`settings.js`)                  | Settings come from environment variables; `.env.example` committed with fake values                                                                                                    | A fresh clone runs from `.env.example`                                   |
| Plain-text password comparison                                | Passwords hashed with scrypt, compared in constant time                                                                                                                                | Test: stored value is not the typed password                             |
| Hardcoded session secret                                      | Secrets read from the environment                                                                                                                                                      | Search of the repo finds no secrets                                      |
| Upload accepted before login check; no type or size limits    | Login check runs before the upload handler reads the body; type and size limits                                                                                                       | Tests: logged-out upload rejected, oversized or wrong-type file rejected |
| Path traversal in delete; delete leaves the database row      | Files addressed by generated IDs, not user-supplied paths; delete removes record and file                                                                                             | Tests for both                                                           |
| Calls that fail on Node 22                                    | Current supported runtimes and promise-based APIs                                                                                                                                      | App starts on current versions                                           |
| 3 high vulnerabilities                                        | Current dependencies                                                                                                                                                                   | `npm audit` in `api/` and `client/` shows 0 high                         |
| No tests                                                      | Automated tests for auth modes, upload rules, delete                                                                                                                                   | Test count and pass rate                                                 |

## Verified (2026-10-20)

| Item                                 | Result | How it was checked                                                                                                                                              |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DynamoDB Local on Apple Silicon      | Works  | Image `amazon/dynamodb-local` pulled on arm64 with Docker 28.2.2, run with `-sharedDb -inMemory`. The API created both tables on startup; `aws dynamodb list-tables` against `localhost:8000` listed them |
| S3Mock (S3 emulator)                 | Works  | Image `adobe/s3mock` pulled on arm64. The API created the `photos` bucket on startup; uploads and deletes showed up in `aws s3 ls` against `localhost:9090`        |
| TypeScript code against both         | Works  | All three auth modes exercised with curl: upload, list, image, delete, signup, login, and the DynamoDB item and S3 object checked separately after a delete         |

Not yet verified: which DynamoDB and S3 features the emulators support compared with the real services, and how the app authenticates to real AWS (expected: the SDK's default credential chain).

## Revision (2026-10-20)

The first build used ASP.NET Core (C#), Azure Cosmos DB through EF Core, and Azure Blob Storage, with the Cosmos DB emulator and Azurite. It was replaced with Node.js/TypeScript, DynamoDB, and S3 to match where I want to take my work: TypeScript backends on AWS. The HTTP contract (routes, status codes, JSON shapes, auth modes) stayed the same, so the Angular client did not change.
