import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const problems = sqliteTable("problems", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    problemId: text("problem_id").notNull(),
    data: text("data").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_submissions_user_created").on(t.userId, t.createdAt)],
);
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
});
