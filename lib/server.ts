import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { seeds, visibleProblem, type Problem } from "./problems";
export const config = () => env as unknown as Record<string, string>;
export function db() {
  if (!env.DB) throw new Error("Database unavailable. Please try again.");
  return env.DB;
}
export async function identity() {
  const user = await getChatGPTUser();
  const admins = (config().ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((x) => x.trim());
  return { user, admin: !!user && admins.includes(user.email.toLowerCase()) };
}
export async function authorize(req: Request, admin = false) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("Forbidden");
  const x = await identity();
  if (!x.user) throw new Error("Sign in to continue");
  if (admin && !x.admin) throw new Error("Administrator access required");
  return x.user;
}
export async function problems(admin = false) {
  const rows = await db()
    .prepare("SELECT data FROM problems")
    .all<{ data: string }>();
  const map = new Map(seeds.map((x) => [x.id, x]));
  for (const r of rows.results) {
    const p = JSON.parse(r.data);
    map.set(p.id, p);
  }
  return [...map.values()]
    .filter((x) => admin || x.published)
    .map((x) => (admin ? x : visibleProblem(x)));
}
export async function problem(id: string): Promise<Problem | undefined> {
  const row = await db()
    .prepare("SELECT data FROM problems WHERE id=?")
    .bind(id)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) : seeds.find((x) => x.id === id);
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(e: unknown) {
  console.error(e);
  const message = e instanceof Error ? e.message : "Unexpected error";
  return json(
    { error: message },
    message === "Forbidden" || message.includes("Administrator")
      ? 403
      : message.includes("Sign in")
        ? 401
        : 400,
  );
}
export async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 700000) throw new Error("Request is too large");
  return JSON.parse(raw);
}
