# Connect real code execution

For the Vercel backend, follow [Vercel Sandbox judge](VERCEL-JUDGE.md). The Docker instructions below are an alternative.

Verdict never runs participant code in the web server. It sends code and test input to Judge0 over authenticated HTTPS. Until connected, the UI explicitly shows that judging needs setup and rejects submissions rather than inventing verdicts.

## Dedicated Linux server

Use an isolated Linux machine reserved for judging. Judge0's containers require privileged operation; do not put personal data, the application database, or other workloads on this host. Review upstream security updates before public launch.

1. Follow the supported host requirements in https://github.com/judge0/judge0/blob/master/CHANGELOG.md#v1131-2024-04-18 (Ubuntu 22.04, cgroup configuration, Docker and Compose).
2. Copy this `judge` folder to that host. Run `python3 judge/configure.py` from the repository root. It generates unique secrets in an ignored file.
3. Run `docker compose -f judge/compose.yaml up -d db redis`; once ready, run `docker compose -f judge/compose.yaml up -d`.
4. Put a TLS reverse proxy in front of `127.0.0.1:2358`. Require the generated X-Auth-Token. Keep PostgreSQL/Redis private. Judge0 must not be exposed without authentication.
5. Configure Site runtime secrets: `JUDGE0_URL=https://your-judge-domain`, `JUDGE0_AUTH_TOKEN` from the generated AUTHN_TOKEN, and `ADMIN_EMAILS` with your exact login email (comma-separated for multiple administrators). Deploy again to apply them.
6. Open Problem studio → Check judge connection. Submit a correct and incorrect solution to Two Integers and verify Accepted and Wrong Answer.

Alternatively use a hosted Judge0 CE account. Set `JUDGE0_URL`, `JUDGE0_RAPIDAPI_KEY`, and `JUDGE0_RAPIDAPI_HOST` for that provider instead of X-Auth-Token.

Default language IDs follow Judge0 CE 1.13.1: C++ 54, Python 71, Node.js 63. The connection check verifies these languages. Set JUDGE0_CPP_ID, JUDGE0_PYTHON_ID, JUDGE0_JS_ID if your service uses different IDs.

## Custom checkers

Each problem supports exact text, whitespace-separated tokens, floating-point tolerance, or a custom Python checker. The checker runs in a separate Judge0 sandbox after solution execution. It reads one JSON object from stdin with `input`, `expected`, and `actual` strings, and prints exactly `AC` or `WA`. Exceptions/timeouts are Checker Error, never an Accepted result. Hidden data and checker source stay on the server.

The web app applies request size limits, per-user submission quotas, and ownership checks. Before opening a large public contest, add provider-side budgets and a queue/worker reconciler; the initial implementation refreshes pending verdicts when participants open their submission history. Interactive problems and contests/rating algorithms are not included.

Upstream API: https://ce.judge0.com/
