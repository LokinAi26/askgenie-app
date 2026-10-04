import { useState } from "react";
import { load, save } from "../lib/store.js";

const DAY_TYPES = ["Normal", "Work from home", "Busy", "Weekend"];
const LIST_TABS = ["Shopping", "Packing", "Chores"];

const SEED_BLOCKS = [
  { id: 1, time: "08:00", label: "Breakfast" },
  { id: 2, time: "13:00", label: "Lunch" },
  { id: 3, time: "18:00", label: "Dinner" },
  { id: 4, time: "20:00", label: "Tidy up" },
  { id: 5, time: "22:00", label: "Wind down" },
];
const SEED_LISTS = {
  Shopping: ["2 onions", "Toothpaste"],
  Packing: ["Phone charger"],
  Chores: ["Wipe counters", "Water plants"],
};

function downloadFile(name, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Day() {
  const [dayType, setDayType] = useState(() => load("day-type", "Normal"));
  const [blocks, setBlocks] = useState(() => load("day-blocks", SEED_BLOCKS));
  const [newTime, setNewTime] = useState("09:00");
  const [newLabel, setNewLabel] = useState("");
  const [lists, setLists] = useState(() => load("lists", SEED_LISTS));
  const [listTab, setListTab] = useState(LIST_TABS[0]);
  const [newItem, setNewItem] = useState("");
  const [note, setNote] = useState(() => load("note", ""));
  const [copied, setCopied] = useState(false);

  function persistBlocks(b) { setBlocks(b); save("day-blocks", b); }
  function persistLists(l) { setLists(l); save("lists", l); }

  function addBlock() {
    const label = newLabel.trim();
    if (!label) return;
    persistBlocks([...blocks, { id: Date.now(), time: newTime, label }].sort((a, b) => a.time.localeCompare(b.time)));
    setNewLabel("");
  }

  function editBlock(id, field, value) {
    persistBlocks(blocks.map((b) => (b.id === id ? { ...b, [field]: value } : b)).sort((a, b) => a.time.localeCompare(b.time)));
  }

  function addItem() {
    const t = newItem.trim();
    if (!t) return;
    persistLists({ ...lists, [listTab]: [...(lists[listTab] || []), t] });
    setNewItem("");
  }

  function delItem(i) {
    persistLists({ ...lists, [listTab]: lists[listTab].filter((_, x) => x !== i) });
  }

  function downloadICS() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const events = blocks.map((b, i) => {
      const [hh, mm] = b.time.split(":");
      const start = `${today}T${hh}${mm}00`;
      return [
        "BEGIN:VEVENT",
        `UID:genie-${Date.now()}-${i}@genie`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${start}`,
        `SUMMARY:${b.label.replace(/[,;]/g, " ")}`,
        "END:VEVENT",
      ].join("\r\n");
    }).join("\r\n");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GENIE//Day//EN", events, "END:VCALENDAR"].join("\r\n");
    downloadFile("genie-day.ics", ics, "text/calendar");
  }

  async function copySummary() {
    const text = [
      `GENIE day plan (${dayType})`,
      "",
      ...blocks.map((b) => `${b.time} — ${b.label}`),
      "",
      ...LIST_TABS.map((t) => `${t}: ${(lists[t] || []).join(", ") || "—"}`),
      "",
      note ? `Note to self: ${note}` : "",
    ].join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <section className="card">
        <h2>Plan my day</h2>
        <div className="row">
          <select value={dayType} onChange={(e) => { setDayType(e.target.value); save("day-type", e.target.value); }} aria-label="Day type" style={{ width: 200 }}>
            {DAY_TYPES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </section>

      <section className="card">
        <h3>Time blocks</h3>
        {blocks.map((b) => (
          <div key={b.id} className="list-item">
            <input type="time" value={b.time} onChange={(e) => editBlock(b.id, "time", e.target.value)} style={{ width: 110 }} aria-label="Block time" />
            <input type="text" value={b.label} onChange={(e) => editBlock(b.id, "label", e.target.value)} className="grow" aria-label="Block label" />
            <button className="icon-btn danger" onClick={() => persistBlocks(blocks.filter((x) => x.id !== b.id))} aria-label="Delete block">X</button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 110 }} aria-label="New block time" />
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlock()}
            placeholder="New block…" className="grow" aria-label="New block label" />
          <button onClick={addBlock}>Add</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={downloadICS}>Download .ics</button>
          <button onClick={copySummary}>{copied ? "Copied!" : "Copy text summary"}</button>
        </div>
      </section>

      <section className="card">
        <h3>Lists</h3>
        <div className="tabs" role="tablist" aria-label="Lists">
          {LIST_TABS.map((t) => (
            <button key={t} className={`pill${listTab === t ? " active" : ""}`} onClick={() => setListTab(t)} role="tab" aria-selected={listTab === t}>
              {t} ({(lists[t] || []).length})
            </button>
          ))}
        </div>
        {(lists[listTab] || []).map((item, i) => (
          <div key={i} className="list-item">
            <span className="txt">{item}</span>
            <button className="icon-btn danger" onClick={() => delItem(i)} aria-label="Delete item">X</button>
          </div>
        ))}
        <div className="chat-input" style={{ marginTop: 8 }}>
          <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder={`Add to ${listTab}…`} aria-label="New list item" />
          <button className="primary" onClick={addItem}>Add</button>
        </div>
      </section>

      <section className="card">
        <h3>Note to self</h3>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Something to remember…" aria-label="Note to self" />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" onClick={() => save("note", note)}>Save note</button>
          <span className="muted">Saved on this device.</span>
        </div>
      </section>
    </>
  );
}
