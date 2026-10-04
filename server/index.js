// GENIE backend — Claude answers, vault persistence.
// The API key lives in server env only. The browser never sees it.

import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const __dirname = dirname(fileURLToPath(import.meta.url));

// JSON file store (zero native deps). SQLite upgrade path later if needed.
const DB_PATH = "genie-db.json";
function loadDb() {
  if (!existsSync(DB_PATH)) return { seq: 1, entries: [] };
  try { return JSON.parse(readFileSync(DB_PATH, "utf8")); }
  catch { return { seq: 1, entries: [] }; }
}
function saveDb(db) { writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

// POST /api/ask
// Accepts three shapes:
//   { question, notebook?, imageBase64? }   — original voice UI (unchanged behavior)
//   { messages: [{role, content}] }         — Claude artifact bridge (Kendall's real UI)
//   { prompt: "..." }                       — single-prompt shorthand
// All -> { answer, notebookUsed }
app.post("/api/ask", async (req, res) => {
  const { question, notebook, imageBase64, imageMediaType, messages, prompt } = req.body ?? {};
  if (!question && !imageBase64 && !messages && !prompt) return res.status(400).json({ error: "empty" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "server missing ANTHROPIC_API_KEY" });

  // --- artifact bridge: {messages} or {prompt} ---
  if (messages || prompt) {
    const sysText =
      "You are GENIE, Kendall's voice-first AI assistant. Keep answers short, plain, and speakable — no markdown unless asked.";
    let msgs;
    if (Array.isArray(messages)) {
      msgs = [];
      for (const m of messages) {
        const role = m && m.role === "assistant" ? "assistant" : "user";
        const text = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
        const last = msgs[msgs.length - 1];
        if (last && last.role === role) last.content += "\n\n" + text;
        else msgs.push({ role, content: text });
      }
      if (!msgs.length) return res.status(400).json({ error: "empty" });
    } else {
      msgs = [{ role: "user", content: String(prompt) }];
    }
    if (imageBase64) {
      const last = msgs[msgs.length - 1];
      const prior = typeof last.content === "string" ? last.content : "";
      last.content = [
        { type: "image", source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: prior },
      ];
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.GENIE_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: sysText,
        messages: msgs,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `anthropic ${r.status}` });
    const data = await r.json();
    const answer = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return res.json({ answer, notebookUsed: null });
  }

  // --- original {question} path — behavior untouched ---

  // Vault context: only the selected notebook, named in the answer.
  let vaultContext = "";
  if (notebook) {
    const rows = loadDb().entries.filter((e) => e.notebook === notebook);
    if (rows.length) vaultContext = rows.map((r) => r.body).join("\n---\n");
  }

  const system = [
    "You are GENIE, a warm, concise voice-first assistant.",
    vaultContext
      ? `Answer ONLY from the "${notebook}" notebook below when it covers the question, and name the notebook in your reply. Notebook:\n${vaultContext}`
      : "No notebook context was provided.",
    "Keep spoken answers short: 1-3 sentences unless asked for detail.",
  ].join("\n");

  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } });
  }
  if (question) content.push({ type: "text", text: question });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.GENIE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) return res.status(502).json({ error: `anthropic ${r.status}` });
  const data = await r.json();
  const answer = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  res.json({ answer, notebookUsed: notebook || null });
});

// Vault CRUD — GET /api/vaults?notebook=, POST /api/vaults {notebook, body}, DELETE /api/vaults/:id
app.get("/api/vaults", (req, res) => {
  const { notebook } = req.query;
  const db = loadDb();
  const rows = notebook ? db.entries.filter((e) => e.notebook === notebook) : db.entries;
  res.json(rows);
});

app.post("/api/vaults", (req, res) => {
  const { notebook, body } = req.body ?? {};
  if (!notebook || !body) return res.status(400).json({ error: "notebook and body required" });
  const db = loadDb();
  const entry = { id: db.seq++, notebook, body, created_at: new Date().toISOString() };
  db.entries.push(entry);
  saveDb(db);
  res.json({ id: entry.id });
});

app.delete("/api/vaults/:id", (req, res) => {
  const db = loadDb();
  db.entries = db.entries.filter((e) => String(e.id) !== String(req.params.id));
  saveDb(db);
  res.json({ ok: true });
});

const port = process.env.PORT || 8787;

// Serve the built frontend (~/workspace/genie-live/web/dist) on the same origin.
// In dev the Vite server proxies /api to here instead.
const distDir = join(__dirname, "..", "web", "dist");
if (existsSync(join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(join(distDir, "index.html"));
  });
}

app.listen(port, () => console.log(`genie-server on :${port}`));
