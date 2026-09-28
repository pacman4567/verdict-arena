# Vercel Sandbox judge

The website remains on Sites (Cloudflare Workers + D1 + ChatGPT sign-in). The independent `services/vercel-judge` project runs execution on Vercel Functions and Vercel Sandbox. It implements the subset of the Judge0 protocol used by this website, so the problem studio, hidden tests, and custom Python checkers work without a second frontend or authentication migration.

## Deploy

1. Import this GitHub repository into Vercel. Set **Root Directory** to `services/vercel-judge`, framework **Other**, Node **24.x**. The included `vercel.json` configures routing and a 300-second function duration.
2. Connect an **Upstash Redis** database through Vercel Marketplace. The code reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the Marketplace-provided `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Choose the free plan and disable automatic plan upgrades when appropriate. Redis stores execution results for 24 hours and enforces shared concurrency/daily limits; it never stores submitted source or test input.
3. Generate a random `JUDGE_API_SECRET` of at least 32 characters; store it only as a server-side Vercel environment variable. Never prefix it with `NEXT_PUBLIC_` or commit it. Optionally set `JUDGE_DAILY_RUN_LIMIT` (default 1000 test/checker executions per UTC day).
4. In `services/vercel-judge`, run `npm ci`, `vercel link`, and `vercel env pull .env.local`. Then `npm run snapshot` installs C++/Python into a fresh Node sandbox and prints a snapshot ID. Add it as `JUDGE_SANDBOX_SNAPSHOT_ID` to Vercel. Deployed execution uses Vercel OIDC, not a committed access token. Refresh local credentials with `vercel env pull` when they expire.
5. Deploy the service. If deployment protection applies to the production domain, use a Vercel automation bypass secret via the site's optional `JUDGE_VERCEL_BYPASS_SECRET`; do not remove protection just for testing.
6. Configure the Sites **server runtime** with `JUDGE0_URL=https://your-judge.vercel.app`, `JUDGE0_AUTH_TOKEN=<same JUDGE_API_SECRET>`, and the administrator's `ADMIN_EMAILS`. Leave language IDs at 54/71/63; clear any old RapidAPI configuration. Rebuild and publish through Sites. Git pushes alone do not publish a Sites app.
7. Set `JUDGE_URL` in the judge's local `.env.local` and run `npm run smoke`. This executes real submissions in all three languages, timeout, compilation/runtime/output failures, a custom checker, and network isolation. Then submit correct and incorrect solutions through the actual website and confirm its final Accepted/Wrong Answer verdicts.

## Customization

The site's **Problem studio** edits titles, statements, formats, examples, hidden tests, time/memory limits, rating/tags and publication state. Choose exact output, whitespace-separated tokens, floating-point tolerance, or custom Python. Custom checkers receive JSON on standard input with `input`, `expected`, and `actual`; print exactly `AC` or `WA`. Checker failures produce `Checker Error`.

The **site settings** change the site name and accent. Modify `app/globals.css` for deeper design changes. Update the snapshot script and protocol language allowlist to add compilers; never accept arbitrary compiler commands from public requests.

## Isolation and limits

Each test and each custom checker receives its own disposable microVM with outbound networking denied. The supervisor drops privileges to `nobody`, uses `no_new_privs`, strips environment variables, bounds processes/files/output and CPU, applies address-space limits for C++/Python, monitors aggregate resident memory, and kills remaining contestant processes. Expected answers and service credentials never enter the solution VM. Custom checkers run in a **different** VM.

Returned time is elapsed execution time, not CPU time. CPU limits use kernel integer-second limits plus sampled aggregate CPU monitoring. Memory accounting is a 10ms resident-memory sample plus process peak usage; V8 uses resident-memory monitoring because it reserves large virtual address ranges. These are practice-site limits, not Codeforces-identical contest accounting. Allocation failures under address-space limits may be reported as Runtime Error. Each VM has a 60-second hard lifetime and is stopped after its run.

The service requires authenticated server-to-server requests, supports at most 30 executions per batch, 64KiB of output per run, four parallel executions per batch and eight across the service. The daily budget includes custom checkers. Pending results become Judge Error after five minutes if execution is lost. `waitUntil` keeps work alive after the HTTP response, but this is **not a durable retry queue**: provider interruptions or saturated budgets can require resubmission. Add durable job dispatch and reconciliation before high-stakes or large contests.

Sandbox compute and storage are metered by their providers; the app's daily budget is a run-count cap, not a currency cap. Run the live smoke tests after every toolchain update. CI exercises the supervisor on an ephemeral Linux VM; passing CI does not verify the Vercel deployment or website connection.

## References

- https://vercel.com/docs/sandbox/sdk-reference
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- https://vercel.com/docs/storage
