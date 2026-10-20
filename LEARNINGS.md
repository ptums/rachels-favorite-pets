Summary
AI made working in an unfamiliar stack cheap to start, and it moved my time from typing code to deciding, checking, and documenting. I migrated Rachel's Favorite Pets from a legacy app to Angular, a Node.js/TypeScript API, Amazon DynamoDB, and Amazon S3, all on local emulators, with Claude as a working partner. The migration is finished and documented in the repo README. Performance, accessibility, and SEO were measured, and the delete route was verified by hand.
What I learned
The new material was DynamoDB and running AWS services locally. The concepts underneath were not new.
• Node.js + TypeScript API: Express 5, the AWS SDK for JavaScript v3 (DynamoDB document client, S3 client), and npm tooling, including npm audit. Node runs the TypeScript directly, so tsc only type-checks.
• DynamoDB, simulated locally: running DynamoDB Local in Docker on port 8000, with tables created on startup and uniqueness enforced by a conditional put.
• S3, simulated locally: S3Mock exposing the S3 API on port 9090, with path-style URLs.
• Already knew: routes, cookie auth, authorization rules, and blob storage as a pattern. Those transferred directly; only the syntax and tooling were new.
How AI changed the work
The skills I already had transferred into a stack I had never used, because AI removed most of the ramp-up cost. The decisions stayed mine.
• Unfamiliar stack, familiar concepts. I knew what a protected route and a blob upload should do. AI helped me express that in TypeScript, the AWS SDK, and DynamoDB without a long documentation detour.
• Options, then my call. I used AI to compare stack choices, then made and recorded the decision myself (STACK.md). The same applied to the three auth modes (owner, open, accounts).
• Scope set deliberately. I chose emulators only, no CI/CD, and no automated tests, and I wrote that down in the README so it reads as a decision, not an omission.
• Documentation as a byproduct. The verification log, the Lighthouse record, and the README came out of the same working session as the code.
Where I stayed in the loop
AI output was wrong or incomplete several times, and each time the catch came from checking the real environment instead of trusting the answer.
What went wrong
How it was caught
Fix
First Lighthouse run was on the Angular dev server (11.3 s FCP, 1.57 MB unminified bundle)
The report still showed @vite/client and an unminified main file
Rerun against a production build
Second run used a static server that returned index.html for /config, /me, and robots.txt
Network table showed 200 text/html instead of JSON, plus a console error
Serve the build from the API
Direct check of DynamoDB Local returned nothing after the API had saved records
The empty output contradicted the API's 200 responses; the AWS CLI had no credentials set
Pass the emulator's dummy keys to the CLI
A delete route can return success and still leave a blob behind
I checked the DynamoDB item and the S3 object separately
Confirmed both were removed
The pattern: AI is fast at producing a plausible answer, and I owned making sure it was true for my setup.
Results
Serving the build from the API with response compression moved Performance from 70 to 85 and SEO from 91 to 100. Compression, not the hosting change, did most of the speed work.
Measure
Before (static server)
After (served from API)
Performance
70
85
Accessibility
100
100
Best Practices
96
96
SEO
91
100
Total transfer
828 KiB
496 KiB
Main JS transferred
280 KB
112 KB
CSS transferred
232 KB
49 KB
FCP / LCP (simulated mobile)
3.7 s / 5.9 s
1.9 s / 4.1 s
The "before" column is a misconfigured setup with an empty gallery, so it is a methodology note, not a legacy baseline. The after run is a single Lighthouse mobile run, signed in as owner.
• Dependencies: npm audit in api/ found 0 vulnerabilities on Oct 20 2026. This is a point-in-time check.
• Delete route: all six manual checks passed, including blob removal, unauthenticated rejection, and 404 on a nonexistent ID.
What I'd do differently, and what's next
Next time I would validate the measurement setup before measuring anything, and I would record the legacy baseline in a form I can compare against.
• Validate the harness first. Two of my first measurements were invalid. Checking that the page loads real data and that API routes return JSON, before running Lighthouse, would have saved two rounds.
• Check AI suggestions against the actual environment. Container names, image versions, and ports are the kind of detail an answer can get plausibly wrong.
• Plan the baseline up front. The legacy numbers were not directly comparable, which weakens the before/after story.
Open items are in the README backlog: eager-loading and fetchpriority on the first thumbnails, WebP and right-sized banner images, trimming unused CSS, long cache lifetimes on hashed assets, and the fresh-clone setup measurement.
