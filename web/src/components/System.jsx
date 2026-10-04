import { useEffect, useRef, useState } from "react";
import { load, clearAll } from "../lib/store.js";
import { synthesisSupported, getVoices } from "../lib/speech.js";

const LANGS = [
  ["en-US", "English (US)"],
  ["en-GB", "English (UK)"],
  ["es-ES", "Spanish"],
  ["fr-FR", "French"],
  ["de-DE", "German"],
];

function downloadFile(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function System({ settings, setSettings }) {
  const [voices, setVoices] = useState([]);
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!synthesisSupported()) return;
    const update = () => setVoices(getVoices());
    update();
    window.speechSynthesis.onvoiceschanged = update;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  function set(k, v) {
    setSettings({ ...settings, [k]: v });
  }

  function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("genie:")) data[k] = localStorage.getItem(k);
    }
    downloadFile("genie-backup.json", JSON.stringify(data, null, 2));
    setMsg("Backup downloaded.");
  }

  function downloadChat() {
    const chat = load("talk-chat", []);
    const text = chat.map((m) => `${m.role === "genie" ? "GENIE" : "YOU"}: ${m.text}`).join("\n\n");
    const blob = new Blob([text || "(no chat yet)"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genie-chat.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg("Chat transcript downloaded.");
  }

  function importData(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith("genie:")) localStorage.setItem(k, v);
        });
        setMsg("Backup restored — reloading.");
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setMsg("That file is not a valid GENIE backup.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  function resetAll() {
    if (window.confirm("Reset everything? This clears GENIE's local data on this device (chat, lists, blocks, settings). Vault notebooks on the server are kept.")) {
      clearAll();
      window.location.reload();
    }
  }

  return (
    <>
      <section className="card">
        <h2>Voice</h2>
        <div className="row">
          <label className="check">
            <input type="radio" name="vengine" checked readOnly />
            Browser voice
          </label>
        </div>
        <p className="muted">A studio GENIE voice is Phase 2. Today GENIE speaks with your browser's voices.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={settings.voiceURI} onChange={(e) => set("voiceURI", e.target.value)} aria-label="Voice">
            <option value="">Default voice</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={settings.lang} onChange={(e) => set("lang", e.target.value)} aria-label="Language" style={{ width: 220 }}>
            {LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Preferences</h2>
        <div className="row" style={{ gap: 16 }}>
          <label className="check">
            <input type="checkbox" checked={settings.speakReplies} onChange={(e) => set("speakReplies", e.target.checked)} />
            Speak replies
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.autoSave} onChange={(e) => set("autoSave", e.target.checked)} />
            Auto-save chat
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Data</h2>
        <div className="pills">
          <button onClick={exportData}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
          <button onClick={downloadChat}>Download chat</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden-input" onChange={importData} />
        {msg && <p className="muted">{msg}</p>}
      </section>

      <section className="card">
        <h2 style={{ color: "#ff8f8f" }}>Danger zone</h2>
        <button className="danger" onClick={resetAll}>Reset everything</button>
        <p className="muted">Clears GENIE's local data on this device. Server vaults are kept.</p>
      </section>

      <section className="card">
        <h2>About</h2>
        <p><strong>GENIE 1.0.0</strong> — rebuilt as a real web app.</p>
        <p className="muted">
          Real: chat with Claude, voice input and wake word (Chrome/Edge), spoken replies,
          timers, sous-chef camera, vault notebooks, lists, day planner, self-tests.
          Phase 2: OAuth app connections, studio voice, reminders sync.
        </p>
      </section>
    </>
  );
}
