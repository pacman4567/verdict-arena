import {
  authorize,
  body,
  db,
  failure,
  identity,
  json,
  problems,
} from "@/lib/server";
import { problemSchema } from "@/lib/problems";
export async function GET(req: Request) {
  try {
    const admin = new URL(req.url).searchParams.get("admin") === "1";
    if (admin) await authorize(req, true);
    return json(await problems(admin));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(req, true);
    const p = problemSchema.parse(await body(req));
    if (p.checker === "custom" && !p.checkerSource.trim())
      throw new Error("Add custom checker code");
    if (p.published && !p.tests.some((t) => t.sample))
      throw new Error("Published problems need a sample test");
    await db()
      .prepare(
        "INSERT INTO problems(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      )
      .bind(p.id, JSON.stringify(p), Date.now())
      .run();
    return json({ id: p.id });
  } catch (e) {
    return failure(e);
  }
}
