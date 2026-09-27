import { config, db } from "./server";
import { compare } from "./checker";
import type { Problem } from "./problems";
export type Run = {
  token: string;
  checkerToken?: string;
  verdict?: string;
  time?: number;
  memory?: number;
};
export type Submission = {
  id: string;
  problemId: string;
  problemTitle: string;
  source: string;
  language: string;
  createdAt: number;
  status: string;
  runs: Run[];
  snapshot: Problem;
};
export function languages() {
  const c = config();
  return {
    cpp: Number(c.JUDGE0_CPP_ID || 54),
    python: Number(c.JUDGE0_PYTHON_ID || 71),
    javascript: Number(c.JUDGE0_JS_ID || 63),
  };
}
export async function judge(path: string, method = "GET", data?: unknown) {
  const c = config();
  if (!c.JUDGE0_URL)
    throw new Error(
      "Judge is not connected yet. Ask the administrator to finish setup.",
    );
  const u = new URL(c.JUDGE0_URL);
  if (u.protocol !== "https:") throw new Error("Judge endpoint must use HTTPS");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (c.JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = c.JUDGE0_AUTH_TOKEN;
  if (c.JUDGE0_RAPIDAPI_KEY) {
    headers["X-RapidAPI-Key"] = c.JUDGE0_RAPIDAPI_KEY;
    headers["X-RapidAPI-Host"] = c.JUDGE0_RAPIDAPI_HOST || u.hostname;
  }
  const res = await fetch(c.JUDGE0_URL.replace(/\/$/, "") + path, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error(
      `Judge service unavailable (${res.status}). Please retry later.`,
    );
  return res.json() as Promise<any>;
}
const enc = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192)
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(out);
};
const dec = (s: string | null) =>
  s
    ? new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))
    : "";
export async function launch(source: string, language: string, p: Problem) {
  const result = await judge("/submissions/batch?base64_encoded=true", "POST", {
    submissions: p.tests.map((t) => ({
      source_code: enc(source),
      language_id: languages()[language as keyof ReturnType<typeof languages>],
      stdin: enc(t.input),
      cpu_time_limit: p.timeLimit,
      wall_time_limit: Math.min(30, p.timeLimit * 3 + 3),
      memory_limit: p.memoryLimit * 1024,
      max_file_size: 64,
      enable_network: false,
    })),
  });
  if (
    !Array.isArray(result) ||
    result.length !== p.tests.length ||
    result.some((r: any) => typeof r.token !== "string")
  )
    throw new Error("Judge did not accept every test. Please retry later.");
  return result.map((r: any) => ({ token: r.token }));
}
export async function refresh(s: Submission) {
  if (s.status !== "Judging") return s;
  if (Date.now() - s.createdAt > 600000) {
    s.status = "Judge Error";
    return s;
  }
  const pending = s.runs.filter((r) => !r.verdict);
  if (!pending.length) return s;
  const tokens = pending.map((r) => r.checkerToken || r.token);
  const result = await judge(
    "/submissions/batch?tokens=" +
      tokens.map(encodeURIComponent).join(",") +
      "&base64_encoded=true&fields=token,status,stdout,time,memory",
  );
  const byToken = new Map<string, any>(
    result.submissions.map((r: any) => [r.token, r]),
  );
  for (let i = 0; i < s.runs.length; i++) {
    const run = s.runs[i];
    if (run.verdict) continue;
    const r = byToken.get(run.checkerToken || run.token);
    if (!r || r.status.id <= 2) continue;
    if (run.checkerToken) {
      run.verdict =
        r.status.id === 3 && dec(r.stdout).trim() === "AC"
          ? "Accepted"
          : r.status.id === 3 && dec(r.stdout).trim() === "WA"
            ? "Wrong Answer"
            : "Checker Error";
      continue;
    }
    run.time = Number(r.time || 0);
    run.memory = Number(r.memory || 0);
    if (r.status.id !== 3) {
      run.verdict =
        (
          {
            5: "Time Limit Exceeded",
            6: "Compilation Error",
            13: "Judge Error",
            14: "Judge Error",
          } as Record<number, string>
        )[r.status.id] || "Runtime Error";
      continue;
    }
    const test = s.snapshot.tests[i];
    if (s.snapshot.checker === "custom") {
      const check = await judge("/submissions?base64_encoded=true", "POST", {
        source_code: enc(s.snapshot.checkerSource),
        language_id: languages().python,
        stdin: enc(
          JSON.stringify({
            input: test.input,
            expected: test.output,
            actual: dec(r.stdout),
          }),
        ),
        cpu_time_limit: 2,
        wall_time_limit: 6,
        memory_limit: 262144,
        max_file_size: 64,
        enable_network: false,
      });
      if (!check.token) throw new Error("Checker service unavailable");
      run.checkerToken = check.token;
    } else
      run.verdict = compare(
        dec(r.stdout),
        test.output,
        s.snapshot.checker,
        s.snapshot.tolerance,
      )
        ? "Accepted"
        : "Wrong Answer";
  }
  if (s.runs.every((r) => r.verdict))
    s.status =
      s.runs.find((r) => r.verdict !== "Accepted")?.verdict || "Accepted";
  return s;
}
export async function saveSubmission(s: Submission) {
  await db()
    .prepare("UPDATE submissions SET data=?,status=? WHERE id=?")
    .bind(JSON.stringify(s), s.status, s.id)
    .run();
}
export function publicSubmission(s: Submission) {
  return {
    id: s.id,
    problemId: s.problemId,
    problemTitle: s.problemTitle,
    language: s.language,
    createdAt: s.createdAt,
    status: s.status,
    runs: s.runs.map((r, i) => ({
      number: i + 1,
      verdict: r.verdict || "Judging",
      time: r.time,
      memory: r.memory,
    })),
    passed: s.runs.filter((r) => r.verdict === "Accepted").length,
    total: s.runs.length,
  };
}
