"use client";
import { useEffect, useState } from "react";
import {
  Code2,
  ArrowUpRight,
  Check,
  Terminal,
  Plus,
  Search,
  ChevronRight,
  ArrowLeft,
  Send,
  Clock,
  Database,
  Save,
  Trash2,
  Settings2,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { Problem } from "@/lib/problems";
const starter: Record<string, string> = {
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Write your solution here\n    return 0;\n}\n",
  python:
    "# Read input and write your solution\nimport sys\n\ndata = sys.stdin.read().split()\n",
  javascript:
    "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n\n// Write your solution here\n",
};
const checkerExample =
  'import json, sys\ndata = json.load(sys.stdin)\n# Replace with your problem-specific validation.\nactual = data["actual"].split()\nexpected = data["expected"].split()\nprint("AC" if actual == expected else "WA")\n';
const blank = (): Problem => ({
  id: "P" + Date.now().toString(36).toUpperCase(),
  title: "",
  statement: "",
  inputFormat: "",
  outputFormat: "",
  tags: "",
  rating: 800,
  timeLimit: 2,
  memoryLimit: 256,
  checker: "tokens",
  tolerance: 0.000001,
  checkerSource: checkerExample,
  published: false,
  tests: [{ input: "", output: "", sample: true }],
});
async function api(path: string, options?: RequestInit) {
  const r = await fetch("/api/" + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete request");
  return d;
}
function Choice({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (x: string) => void;
  items: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Home() {
  const [view, setView] = useState("problems"),
    [list, setList] = useState<Problem[]>([]),
    [platform, setPlatform] = useState<any>(null),
    [selected, setSelected] = useState<Problem | null>(null),
    [query, setQuery] = useState(""),
    [language, setLanguage] = useState("cpp"),
    [source, setSource] = useState(starter.cpp),
    [submissions, setSubmissions] = useState<any[]>([]),
    [current, setCurrent] = useState<any>(null),
    [draft, setDraft] = useState<Problem | null>(null),
    [adminList, setAdminList] = useState<Problem[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [brand, setBrand] = useState({ name: "verdict", accent: "#2563eb" });
  const go = (v: string) => {
    setView(v);
    setSelected(null);
    setCurrent(null);
    setError("");
    setNotice("");
    history.replaceState(null, "", v === "problems" ? "/" : "?view=" + v);
  };
  async function load() {
    try {
      const [p, l] = await Promise.all([api("platform"), api("problems")]);
      setPlatform(p);
      setBrand(p.brand);
      setList(l);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const v = new URLSearchParams(location.search).get("view");
    if (v) setView(v);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", brand.accent);
  }, [brand.accent]);
  useEffect(() => {
    if (view === "submissions" && platform?.user)
      api("submissions")
        .then(setSubmissions)
        .catch((e) => setError(e.message));
    if (view === "studio" && platform?.admin)
      api("problems?admin=1")
        .then(setAdminList)
        .catch((e) => setError(e.message));
  }, [view, platform]);
  useEffect(() => {
    if (!platform?.user) return;
    let cancelled = false;
    const pending = [
      ...(current?.status === "Judging" ? [current] : []),
      ...submissions.filter((s) => s.status === "Judging"),
    ];
    if (!pending.length) return;
    const t = setTimeout(async () => {
      for (const s of [...new Map(pending.map((x) => [x.id, x])).values()]) {
        try {
          const next = await api("submissions?id=" + s.id);
          if (cancelled) return;
          if (current?.id === s.id) setCurrent(next);
          setSubmissions((old) => old.map((x) => (x.id === s.id ? next : x)));
        } catch (e) {
          if (!cancelled) setError((e as Error).message);
        }
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [current, submissions, platform]);
  useEffect(() => {
    const mc = (document as any).modelContext;
    if (!mc?.registerTool) return;
    const abort = new AbortController();
    Promise.resolve(
      mc.registerTool(
        {
          name: "open_problem",
          title: "Open a programming problem",
          description:
            "Navigate to a published problem and its solution editor.",
          inputSchema: {
            type: "object",
            properties: { problemId: { type: "string" } },
            required: ["problemId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async (input: any) => {
            if (typeof input.problemId !== "string")
              throw new Error("problemId must be a string");
            const p = list.find((x) => x.id === input.problemId);
            if (!p) throw new Error("Problem not found");
            setView("problems");
            setSelected(p);
            setCurrent(null);
            return { id: p.id, title: p.title };
          },
        },
        { signal: abort.signal },
      ),
    ).catch(() => {});
    return () => abort.abort();
  }, [list]);
  async function action(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const open = (p: Problem) => {
    setSelected(p);
    setCurrent(null);
    setError("");
  };
  const submit = () =>
    action(async () => {
      if (!selected) return;
      const s = await api("submissions", {
        method: "POST",
        body: JSON.stringify({ problemId: selected.id, language, source }),
      });
      setCurrent(s);
    });
  const update = (key: keyof Problem, value: any) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const filtered = list.filter((p) =>
    (p.title + " " + p.tags + " " + p.id)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const signin = (
    <a
      className="primary buttonlink"
      href={
        "/signin-with-chatgpt?return_to=" + encodeURIComponent("/?view=" + view)
      }
      target="_top"
    >
      Sign in with ChatGPT <ArrowUpRight size={16} />
    </a>
  );
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brandmark">
            <Code2 size={22} />
          </span>
          {brand.name}
          <span className="beta">ARENA</span>
        </a>
        <nav>
          {[
            ["problems", "Problemset"],
            ["submissions", "My submissions"],
            ["studio", "Problem studio"],
          ].map(([v, l]) => (
            <a
              key={v}
              href={v === "problems" ? "/" : "?view=" + v}
              onClick={(e) => {
                e.preventDefault();
                go(v);
              }}
              className={view === v ? "active" : ""}
            >
              {l}
            </a>
          ))}
        </nav>
        {platform?.user ? (
          <span className="account" title={platform.user.email}>
            <span className="avatar">
              {platform.user.name[0].toUpperCase()}
            </span>
            {platform.admin ? "Administrator" : "Participant"}
          </span>
        ) : (
          <a
            className="account"
            href="/signin-with-chatgpt?return_to=/"
            target="_top"
          >
            Sign in <ArrowUpRight size={16} />
          </a>
        )}
      </header>
      <main className="shell">
        {error && (
          <div role="alert" className="alert error">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {notice && (
          <div role="status" className="alert success">
            {notice}
          </div>
        )}
        {view === "problems" && !selected && (
          <>
            <div className="eyebrow">YOUR NEXT CHALLENGE</div>
            <div className="heading">
              <div>
                <h1>Small steps. Better solutions.</h1>
                <p>
                  Pick a problem, write your approach, and put it to the test.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  go("studio");
                  setDraft(blank());
                }}
              >
                <Plus size={17} /> Create problem
              </button>
            </div>
            <div className="workspace">
              <section>
                <div className="sectionhead">
                  <h2>
                    Problemset{" "}
                    <span>{String(list.length).padStart(2, "0")}</span>
                  </h2>
                  <span className="muted">Practice at your own pace</span>
                </div>
                <div className="filter">
                  <Search size={18} />
                  <input
                    aria-label="Search problems"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or tag…"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PROBLEM</TableHead>
                      <TableHead>TOPIC</TableHead>
                      <TableHead>RATING</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <button
                            className="problem-name"
                            onClick={() => open(p)}
                          >
                            <span className="problem-id">{p.id}</span>
                            {p.title}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="tag">
                            {p.tags.split(",")[0] || "general"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              p.rating > 1400 ? "rating high" : "rating"
                            }
                          >
                            {p.rating}
                          </span>
                        </TableCell>
                        <TableCell>
                          <button
                            className="iconbutton"
                            onClick={() => open(p)}
                            aria-label={"Open " + p.title}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(loading || !filtered.length) && (
                  <div className="empty">
                    {loading
                      ? "Loading problems…"
                      : "No problems match your search."}
                  </div>
                )}
                <div className="tablefoot">
                  {list.length} original practice problems
                  <span>C++ · Python · JavaScript</span>
                </div>
              </section>
              <aside>
                <div className="feature">
                  <Terminal size={24} />
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h2>
                    Your problems.
                    <br />
                    Your rules.
                  </h2>
                  <p>
                    Write challenges, add hidden tests, and choose how every
                    solution is judged.
                  </p>
                  <button className="light" onClick={() => go("studio")}>
                    Open problem studio <ArrowUpRight size={17} />
                  </button>
                  <div className="code-mini">
                    <span>01</span> input → solution
                    <br />
                    <span>02</span> solution → tests
                    <br />
                    <span>03</span> tests → <em>accepted ✓</em>
                  </div>
                </div>
                <div className="quietcard">
                  <Check size={19} />
                  <div>
                    <h3>A fair test, every time</h3>
                    <p>
                      Isolated execution. Hidden tests.
                      <br />
                      Clear verdicts.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
        {view === "problems" && selected && (
          <>
            <button className="back" onClick={() => setSelected(null)}>
              <ArrowLeft size={16} /> Problemset
            </button>
            <div className="heading">
              <div>
                <div className="eyebrow">
                  PROBLEM {selected.id} / {selected.rating}
                </div>
                <h1>{selected.title}</h1>
                <div className="metadata">
                  <span>
                    <Clock size={15} />
                    {selected.timeLimit} seconds
                  </span>
                  <span>
                    <Database size={15} />
                    {selected.memoryLimit} MB
                  </span>
                  <span>{selected.tags}</span>
                </div>
              </div>
            </div>
            <div className="solvegrid">
              <article className="panel statement">
                <h2>Statement</h2>
                <p>{selected.statement}</p>
                <h3>Input</h3>
                <p>{selected.inputFormat}</p>
                <h3>Output</h3>
                <p>{selected.outputFormat}</p>
                <h3>Examples</h3>
                {selected.tests.map((t, i) => (
                  <div className="sample" key={i}>
                    <div>
                      <b>Input</b>
                      <pre>{t.input}</pre>
                    </div>
                    <div>
                      <b>Output</b>
                      <pre>{t.output}</pre>
                    </div>
                  </div>
                ))}
              </article>
              <section className="panel solution">
                <div className="editorhead">
                  <h2>Your solution</h2>
                  <Choice
                    label="Programming language"
                    value={language}
                    onChange={(v) => {
                      setLanguage(v);
                      setSource(starter[v]);
                    }}
                    items={[
                      ["cpp", "C++ 17"],
                      ["python", "Python 3"],
                      ["javascript", "JavaScript"],
                    ]}
                  />
                </div>
                <label className="sr-only" htmlFor="code">
                  Source code
                </label>
                <textarea
                  id="code"
                  className="codeeditor"
                  spellCheck={false}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
                <div className="submitbar">
                  <span>
                    {source.length.toLocaleString()} / 30,000 characters
                  </span>
                  {platform?.user ? (
                    <button
                      className="primary"
                      disabled={busy || !platform?.judgeReady}
                      onClick={submit}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}{" "}
                      Submit solution
                    </button>
                  ) : (
                    signin
                  )}
                </div>
                {!platform?.judgeReady && (
                  <div className="setupnote">
                    Judging needs setup. Problems are ready to explore;
                    submissions will open when the judge is connected.
                  </div>
                )}
                {current && (
                  <div className="result">
                    <div className="resulthead">
                      <strong
                        className={
                          current.status === "Accepted" ? "accepted" : ""
                        }
                      >
                        {current.status}
                      </strong>
                      <span>
                        {current.passed} / {current.total} tests passed
                      </span>
                    </div>
                    <div className="testchips">
                      {current.runs.map((r: any) => (
                        <span
                          key={r.number}
                          className={
                            r.verdict === "Accepted" ? "test ac" : "test"
                          }
                          title={r.verdict}
                        >
                          #{r.number}{" "}
                          {r.verdict === "Accepted"
                            ? "✓"
                            : r.verdict === "Judging"
                              ? "…"
                              : "×"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {view === "submissions" && (
          <>
            <div className="eyebrow">EVERY ATTEMPT COUNTS</div>
            <div className="heading">
              <div>
                <h1>My submissions</h1>
                <p>Your solutions and their latest verdicts.</p>
              </div>
            </div>
            {!platform?.user ? (
              <div className="panel empty">
                <p>Sign in to see your submission history.</p>
                {signin}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "PROBLEM",
                      "LANGUAGE",
                      "VERDICT",
                      "TESTS",
                      "SUBMITTED",
                    ].map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.problemTitle}</TableCell>
                      <TableCell>{s.language}</TableCell>
                      <TableCell
                        className={s.status === "Accepted" ? "accepted" : ""}
                      >
                        {s.status}
                      </TableCell>
                      <TableCell>
                        {s.passed}/{s.total}
                      </TableCell>
                      <TableCell>
                        {new Date(s.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {platform?.user && !submissions.length && (
              <div className="panel empty">
                <Terminal size={32} />
                <h2>Your first submission starts here.</h2>
                <p>Choose a problem and put your solution to the test.</p>
                <button className="primary" onClick={() => go("problems")}>
                  Explore problems
                </button>
              </div>
            )}
          </>
        )}
        {view === "studio" && (
          <>
            <div className="eyebrow">CREATE THE CHALLENGE</div>
            <div className="heading">
              <div>
                <h1>Problem studio</h1>
                <p>Shape the problem. Define what accepted means.</p>
              </div>
              {platform?.admin && (
                <button className="primary" onClick={() => setDraft(blank())}>
                  <Plus size={17} /> New problem
                </button>
              )}
            </div>
            {!platform?.admin ? (
              <div className="panel empty">
                <Settings2 size={30} />
                <h2>Administrator access</h2>
                <p>Problem editing is limited to the site administrator.</p>
                {!platform?.user && signin}
              </div>
            ) : (
              <>
                <Tabs defaultValue="problems">
                  <TabsList variant="line">
                    <TabsTrigger value="problems">
                      Problems & judges
                    </TabsTrigger>
                    <TabsTrigger value="settings">Site settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="problems">
                    {!draft ? (
                      <div className="panel studio-list">
                        {adminList.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setDraft(structuredClone(p))}
                          >
                            <span className="problem-id">{p.id}</span>
                            <strong>{p.title}</strong>
                            <span className="muted">
                              {p.published ? "Published" : "Draft"} ·{" "}
                              {p.tests.length} tests · {p.checker}
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <form
                        className="panel editform"
                        onSubmit={(e) => {
                          e.preventDefault();
                          action(async () => {
                            await api("problems", {
                              method: "POST",
                              body: JSON.stringify(draft),
                            });
                            setNotice("Problem saved.");
                            setAdminList(await api("problems?admin=1"));
                            setList(await api("problems"));
                          });
                        }}
                      >
                        <div className="editorhead">
                          <button
                            type="button"
                            className="back"
                            onClick={() => setDraft(null)}
                          >
                            <ArrowLeft size={16} /> All problems
                          </button>
                          <button className="primary" disabled={busy}>
                            <Save size={16} /> Save problem
                          </button>
                        </div>
                        <div className="formgrid">
                          <label>
                            Problem ID
                            <input
                              required
                              value={draft.id}
                              maxLength={40}
                              pattern="[a-zA-Z0-9-]+"
                              onChange={(e) => update("id", e.target.value)}
                            />
                          </label>
                          <label>
                            Title
                            <input
                              required
                              minLength={3}
                              maxLength={100}
                              value={draft.title}
                              onChange={(e) => update("title", e.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          Problem statement
                          <textarea
                            required
                            minLength={10}
                            rows={5}
                            value={draft.statement}
                            onChange={(e) =>
                              update("statement", e.target.value)
                            }
                          />
                        </label>
                        <div className="formgrid">
                          <label>
                            Input format
                            <textarea
                              rows={3}
                              value={draft.inputFormat}
                              onChange={(e) =>
                                update("inputFormat", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Output format
                            <textarea
                              rows={3}
                              value={draft.outputFormat}
                              onChange={(e) =>
                                update("outputFormat", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Tags (comma-separated)
                            <input
                              value={draft.tags}
                              onChange={(e) => update("tags", e.target.value)}
                            />
                          </label>
                          <label>
                            Difficulty rating
                            <input
                              type="number"
                              min="0"
                              max="4000"
                              value={draft.rating}
                              onChange={(e) =>
                                update("rating", +e.target.value)
                              }
                            />
                          </label>
                        </div>
                        <h2>Judge configuration</h2>
                        <div className="formgrid thirds">
                          <label>
                            Time limit (seconds)
                            <input
                              type="number"
                              min="0.1"
                              max="10"
                              step="0.1"
                              value={draft.timeLimit}
                              onChange={(e) =>
                                update("timeLimit", +e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Memory limit (MB)
                            <input
                              type="number"
                              min="32"
                              max="512"
                              value={draft.memoryLimit}
                              onChange={(e) =>
                                update("memoryLimit", +e.target.value)
                              }
                            />
                          </label>
                          <label>
                            Output checker
                            <Choice
                              label="Output checker"
                              value={draft.checker}
                              onChange={(v) => update("checker", v)}
                              items={[
                                ["tokens", "Ignore whitespace"],
                                ["exact", "Exact text"],
                                ["float", "Floating point"],
                                ["custom", "Custom Python checker"],
                              ]}
                            />
                          </label>
                        </div>
                        {draft.checker === "float" && (
                          <label>
                            Absolute / relative tolerance
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max="1"
                              value={draft.tolerance}
                              onChange={(e) =>
                                update("tolerance", +e.target.value)
                              }
                            />
                          </label>
                        )}
                        {draft.checker === "custom" && (
                          <label>
                            Python checker
                            <p className="hint">
                              Read JSON from stdin: input, expected, actual.
                              Print AC or WA. Runs in a separate sandbox.
                            </p>
                            <textarea
                              className="codeeditor checkereditor"
                              spellCheck={false}
                              rows={9}
                              value={draft.checkerSource}
                              onChange={(e) =>
                                update("checkerSource", e.target.value)
                              }
                            />
                          </label>
                        )}
                        <div className="editorhead">
                          <h2>
                            Test cases{" "}
                            <span className="muted">
                              {draft.tests.length}/30
                            </span>
                          </h2>
                          <button
                            type="button"
                            className="secondary"
                            disabled={draft.tests.length >= 30}
                            onClick={() =>
                              update("tests", [
                                ...draft.tests,
                                { input: "", output: "", sample: false },
                              ])
                            }
                          >
                            <Plus size={16} /> Add test
                          </button>
                        </div>
                        {draft.tests.map((t, i) => (
                          <div className="testedit" key={i}>
                            <div className="editorhead">
                              <strong>Test {i + 1}</strong>
                              <label className="inline">
                                <Checkbox
                                  checked={t.sample}
                                  onCheckedChange={(v) =>
                                    update(
                                      "tests",
                                      draft.tests.map((x, n) =>
                                        n === i ? { ...x, sample: !!v } : x,
                                      ),
                                    )
                                  }
                                />{" "}
                                Show as sample
                              </label>
                              <button
                                type="button"
                                className="iconbutton"
                                disabled={draft.tests.length === 1}
                                aria-label={"Remove test " + (i + 1)}
                                onClick={() =>
                                  update(
                                    "tests",
                                    draft.tests.filter((_, n) => n !== i),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="formgrid">
                              <label>
                                Input
                                <textarea
                                  rows={3}
                                  value={t.input}
                                  onChange={(e) =>
                                    update(
                                      "tests",
                                      draft.tests.map((x, n) =>
                                        n === i
                                          ? { ...x, input: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Expected output
                                <textarea
                                  rows={3}
                                  value={t.output}
                                  onChange={(e) =>
                                    update(
                                      "tests",
                                      draft.tests.map((x, n) =>
                                        n === i
                                          ? { ...x, output: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                        <label className="inline publish">
                          <Checkbox
                            checked={draft.published}
                            onCheckedChange={(v) => update("published", !!v)}
                          />{" "}
                          Published — visible in the problemset
                        </label>
                      </form>
                    )}
                  </TabsContent>
                  <TabsContent value="settings">
                    <div className="panel editform">
                      <h2>Identity</h2>
                      <div className="formgrid">
                        <label>
                          Site name
                          <input
                            maxLength={30}
                            value={brand.name}
                            onChange={(e) =>
                              setBrand({ ...brand, name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Accent color
                          <input
                            type="color"
                            value={brand.accent}
                            onChange={(e) =>
                              setBrand({ ...brand, accent: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await api("platform", {
                              method: "POST",
                              body: JSON.stringify(brand),
                            });
                            setNotice("Site settings saved.");
                          })
                        }
                      >
                        Save site settings
                      </button>
                      <hr />
                      <h2>Judge service</h2>
                      <p>
                        {platform.judgeReady
                          ? "Judge endpoint configured. Verify the connection below."
                          : "Connect your Judge0 service to enable real submissions."}
                      </p>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const r = await api("platform", {
                              method: "POST",
                              body: JSON.stringify({ action: "check" }),
                            });
                            setNotice(r.message);
                          })
                        }
                      >
                        Check judge connection
                      </button>
                      <p className="hint">
                        The project includes a dedicated judge setup guide in
                        docs/JUDGE.md. Configure the judge URL and credentials
                        in the hosting environment; credentials never appear in
                        the browser.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
        <footer>
          <span>{brand.name.toUpperCase()} / Built for the next attempt.</span>
          <span>Think. Code. Submit.</span>
        </footer>
      </main>
    </>
  );
}
