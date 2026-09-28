# Verdict Arena

A customizable competitive programming site built with React/Vinext, Cloudflare Workers, D1, and a pluggable execution adapter.

## Features

- Problemset with search and four original starter problems.
- Code submissions in C++17, Python 3, and JavaScript.
- Persistent submission history, per-test verdicts, and automatic refresh while viewing pending submissions.
- Administrator studio for statements, examples, hidden tests, resource limits, publication state, and difficulty.
- Exact, token, floating-point, and sandboxed custom Python checkers.
- Editable site name and accent color.
- ChatGPT sign-in with server-side administrator authorization.
- Vercel Sandbox judge service, optional Judge0 Docker setup, and GitHub CI.

## Current deployment

The website uses Sites hosting. Source is mirrored to this GitHub repository. Editing or pushing this GitHub repository does **not** automatically publish the Site; build and publish through Sites after changes.

Real code execution requires connecting the [Vercel judge service](docs/VERCEL-JUDGE.md) or a Judge0 server. The interface disables submission until configured; it does not simulate verdicts. See [judge setup](docs/JUDGE.md). This repository contains no API tokens.

## Local development

Requires Node 24 or newer.

```sh
npm run install:ci
cp .env.example .env
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_melodic_maria_hill.sql
npm run dev
```

The development sign-in flow uses `seedy@sites.test`; set `ADMIN_EMAILS=seedy@sites.test` in your **local** `.env` to try the studio. Production must use the actual administrator email in Sites runtime settings. Local sign-in is provided by the development-only plugin and is not shipped as authentication in production.

Migration commands are for an empty local database. Do not replay already-applied migrations. Add schema changes to `db/schema.ts`, run `npm run db:generate`, and append new migrations. Sites applies production migrations during publication.

```sh
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

## Customize

Use Problem studio for everyday editing. Implementation map:

| File | Purpose |
| --- | --- |
| `app/page.tsx` | Problemset, editor, submission history, studio |
| `app/globals.css` | Layout, typography, colors, responsive behavior |
| `lib/problems.ts` | Problem validation and server-only starter content |
| `lib/checker.ts` | Built-in output comparison rules |
| `lib/judge.ts` | Judge0 execution, polling, custom checker orchestration |
| `app/api/*` | Authenticated APIs |
| `db/schema.ts` | Persistent data model |
| `judge/` | Optional dedicated Judge0 host setup |
| `services/vercel-judge/` | Vercel execution service, sandbox supervisor, tests and provisioning |

Hidden starter tests live in server source and are filtered from public responses. This GitHub repository is public, so anyone can read starter tests. Add real competition tests through the administrator studio; do not commit them.

## Deployment and access

`.openai/hosting.json` identifies the Site and its logical D1 binding. Keep credentials in Sites environment settings, not this manifest. Set `ADMIN_EMAILS` and the Judge0 environment values from `.env.example`. Runtime environment changes need a new deployment. Sites private access and app administrator permissions are separate: private access controls who can visit; ADMIN_EMAILS controls who can edit.

Site access is managed in Sites; this site currently allows public visitors. Administrator actions still require an allowlisted signed-in account. Sign-in uses the platform-dispatched ChatGPT authentication flow; deploying outside Sites needs a separately configured trusted authentication gateway and D1 bindings. Never expose an unprotected server that trusts user-supplied identity headers.

## Scope and operational limits

This is a practice and problem-authoring platform, not a full Codeforces clone: contests, ratings, plagiarism detection, interactive judging, and background queue reconciliation are not implemented. There are at most 30 tests per problem, 30,000 source characters, five submissions per minute and 100 per day per participant. Judge results refresh when the submission or history is open; a background reconciler is recommended for production contests. A submission snapshots the problem's tests/checker so later edits do not change its verdict.

Before opening public access, connect and verify the external judge with accepted, incorrect, timeout, runtime-error, and compile-error programs. Unit tests validate comparison rules and data exposure; they do not prove the isolation of your external judge installation.

Sources: [Judge0 API](https://ce.judge0.com/), [Judge0 deployment](https://github.com/judge0/judge0/blob/master/CHANGELOG.md#v1131-2024-04-18). The original site code is provided under MIT; vendored starter components and separately deployed Judge0 retain their upstream licenses.

## Color theme

The interface uses colors from [Pac-Man Theme by vampyrsoda](https://marketplace.visualstudio.com/items?itemName=vampyrsoda.pac-man-theme), version 0.0.10: charcoal `#1e2129`, yellow `#fce566`, cyan `#5ad4e6`, pink `#fc618d`, purple `#948ae3`, and green `#7bd88f`. Semantic palette variables live at the top of `app/globals.css`; the default editable accent is yellow.
