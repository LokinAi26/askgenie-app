import { useEffect, useState } from "react";
import { getVaults } from "../lib/api.js";

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function Apps() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState("");
  const [notebook, setNotebook] = useState("Recipe & Cooking");
  const [canvaPrompt, setCanvaPrompt] = useState("");
  const [higgsPrompt, setHiggsPrompt] = useState("");
  const [calTitle, setCalTitle] = useState("GENIE reminder");
  const [calDate, setCalDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [calTime, setCalTime] = useState("08:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    getVaults().then(setEntries).catch(() => setEntries([]));
  }, []);

  const filtered = entries.filter((e) =>
    (`${e.notebook} ${e.body}`.toLowerCase().includes(filter.toLowerCase()))
  );

  async function saveToNotion() {
    const body = entries
      .filter((e) => e.notebook === notebook)
      .map((e) => `- ${e.body}`)
      .join("\n") || "(notebook is empty)";
    try {
      await copyText(`${notebook}\n\n${body}`);
      setNote("Notebook copied to clipboard — paste it into your new Notion page.");
    } catch {
      setNote("Copy failed — your notebook text is shown above; copy it manually.");
    }
    window.open("https://www.notion.so", "_blank", "noopener");
  }

  function designIt() {
    if (canvaPrompt.trim()) copyText(canvaPrompt.trim()).catch(() => {});
    window.open("https://www.canva.com/", "_blank", "noopener");
  }

  function makeImage() {
    if (higgsPrompt.trim()) copyText(higgsPrompt.trim()).catch(() => {});
    window.open("https://higgsfield.ai/", "_blank", "noopener");
  }

  function openCalendar() {
    const start = new Date(`${calDate}T${calTime || "08:00"}`);
    const end = new Date(start.getTime() + 30 * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const url =
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      `&text=${encodeURIComponent(calTitle || "GENIE reminder")}` +
      `&dates=${f(start)}/${f(end)}` +
      `&details=${encodeURIComponent("Created with GENIE")}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <section className="card">
        <h2>Connected apps</h2>
        <p className="muted">
          Phase 1: GENIE drafts and hands off — nothing is sent until you tap a button,
          and each handoff opens the real app in a new tab. Real OAuth connections are Phase 2.
        </p>
      </section>

      <section className="card">
        <h3>Notion</h3>
        <p className="muted">Search your vaults, or save a notebook to a new Notion page.</p>
        <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Search your notes…" aria-label="Search notes" />
        <div className="answer-box" style={{ maxHeight: 140, overflowY: "auto" }}>
          {filtered.length === 0 ? "(no matching notes — add some in VAULTS)" :
            filtered.map((e) => `[${e.notebook}] ${e.body.slice(0, 120)}`).join("\n")}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={notebook} onChange={(e) => setNotebook(e.target.value)} aria-label="Notebook" style={{ width: 170 }}>
            {["Recipe & Cooking", "Life Journal", "Home & Health"].map((n) => <option key={n}>{n}</option>)}
          </select>
          <button className="primary" onClick={saveToNotion}>Save vault to Notion</button>
        </div>
        {note && <p className="muted">{note}</p>}
      </section>

      <section className="card">
        <h3>Canva</h3>
        <p className="muted">Describe the design — GENIE copies your prompt and opens Canva, where you pick the design.</p>
        <div className="chat-input">
          <input type="text" value={canvaPrompt} onChange={(e) => setCanvaPrompt(e.target.value)}
            placeholder="e.g. birthday card, gold and navy" aria-label="Design prompt" />
          <button className="primary" onClick={designIt}>Design it</button>
        </div>
      </section>

      <section className="card">
        <h3>Higgsfield</h3>
        <p className="muted">Describe the image — GENIE copies your prompt and opens Higgsfield. They confirm the credit cost there before anything is made.</p>
        <div className="chat-input">
          <input type="text" value={higgsPrompt} onChange={(e) => setHiggsPrompt(e.target.value)}
            placeholder="e.g. magic lamp at midnight" aria-label="Image prompt" />
          <button className="primary" onClick={makeImage}>Make image</button>
        </div>
      </section>

      <section className="card">
        <h3>Calendar and reminders</h3>
        <p className="muted">This page cannot reach your phone's calendar, so it opens a prefilled Google Calendar event in a new tab.</p>
        <div className="row">
          <input type="text" value={calTitle} onChange={(e) => setCalTitle(e.target.value)} aria-label="Event title" className="grow" />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} aria-label="Event date" />
          <input type="time" value={calTime} onChange={(e) => setCalTime(e.target.value)} aria-label="Event time" />
          <button className="primary" onClick={openCalendar}>Open in Google Calendar</button>
        </div>
      </section>
    </>
  );
}
