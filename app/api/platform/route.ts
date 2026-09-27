import {
  authorize,
  body,
  config,
  db,
  failure,
  identity,
  json,
} from "@/lib/server";
import { judge, languages } from "@/lib/judge";
export async function GET(req: Request) {
  try {
    const { user, admin } = await identity();
    const row = await db()
      .prepare("SELECT data FROM settings WHERE id=?")
      .bind("brand")
      .first<{ data: string }>();
    return json({
      user: user ? { name: user.displayName, email: user.email } : null,
      admin,
      judgeReady: !!config().JUDGE0_URL,
      brand: row
        ? JSON.parse(row.data)
        : { name: "verdict", accent: "#2563eb" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(req, true);
    const data = await body(req);
    if (data.action === "check") {
      const available = await judge("/languages");
      const ids = Object.values(languages());
      if (ids.some((id) => !available.some((l: any) => l.id === id)))
        throw new Error(
          "Judge is missing a configured language. Check language IDs.",
        );
      return json({
        message:
          "Judge connected. All three configured languages are available.",
      });
    }
    if (
      typeof data.name !== "string" ||
      data.name.length < 1 ||
      data.name.length > 30 ||
      !/^#[0-9a-f]{6}$/i.test(data.accent)
    )
      throw new Error("Enter a site name and valid hex color");
    await db()
      .prepare(
        "INSERT INTO settings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .bind("brand", JSON.stringify({ name: data.name, accent: data.accent }))
      .run();
    return json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
