import {
  authorize,
  body,
  config,
  db,
  failure,
  json,
  problem,
} from "@/lib/server";
import {
  launch,
  publicSubmission,
  refresh,
  saveSubmission,
  type Submission,
} from "@/lib/judge";
export async function POST(req: Request) {
  try {
    const user = await authorize(req);
    const data = await body(req);
    if (
      typeof data.source !== "string" ||
      !data.source.trim() ||
      data.source.length > 30000 ||
      !["cpp", "python", "javascript"].includes(data.language)
    )
      throw new Error(
        "Choose a language and enter code (maximum 30,000 characters).",
      );
    const p = await problem(data.problemId);
    if (!p || !p.published) throw new Error("Problem unavailable");
    if (!config().JUDGE0_URL)
      throw new Error(
        "Judge is not connected yet. Ask the administrator to finish setup.",
      );
    const now = Date.now(),
      id = crypto.randomUUID();
    const s: Submission = {
      id,
      problemId: p.id,
      problemTitle: p.title,
      language: data.language,
      source: data.source,
      createdAt: now,
      status: "Preparing",
      runs: [],
      snapshot: p,
    };
    const inserted = await db()
      .prepare(
        "INSERT INTO submissions(id,user_id,problem_id,data,status,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM submissions WHERE user_id=? AND created_at>?)<5 AND (SELECT COUNT(*) FROM submissions WHERE user_id=? AND created_at>?)<100",
      )
      .bind(
        id,
        user.userId,
        p.id,
        JSON.stringify(s),
        s.status,
        now,
        user.userId,
        now - 60000,
        user.userId,
        now - 86400000,
      )
      .run();
    if (!inserted.meta.changes)
      return json(
        {
          error:
            "Submission limit reached. Wait a minute and try again (100 submissions daily).",
        },
        429,
      );
    try {
      s.runs = await launch(data.source, data.language, p);
      s.status = "Judging";
    } catch (e) {
      s.status = "Judge Error";
      await saveSubmission(s);
      throw e;
    }
    await saveSubmission(s);
    return json(publicSubmission(s), 201);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const user = await authorize(req);
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const row = await db()
        .prepare("SELECT data FROM submissions WHERE id=? AND user_id=?")
        .bind(id, user.userId)
        .first<{ data: string }>();
      if (!row) return json({ error: "Submission not found" }, 404);
      const s = JSON.parse(row.data);
      await refresh(s);
      await saveSubmission(s);
      return json(publicSubmission(s));
    }
    const rows = await db()
      .prepare(
        "SELECT data FROM submissions WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(user.userId)
      .all<{ data: string }>();
    return json(rows.results.map((r) => publicSubmission(JSON.parse(r.data))));
  } catch (e) {
    return failure(e);
  }
}
