import { useState } from "react";
import { getVaults, addVault, deleteVault } from "../lib/api.js";
import { recognitionSupported, synthesisSupported } from "../lib/speech.js";

const CHECKS = [
  {
    id: "sr",
    name: "Speech recognition",
    run: async () => recognitionSupported()
      ? { pass: true, detail: "SpeechRecognition available — mic + wake word can run." }
      : { pass: false, detail: "Not supported here — use Chrome or Edge. Typing still works." },
  },
  {
    id: "tts",
    name: "Speech synthesis",
    run: async () => synthesisSupported()
      ? { pass: true, detail: "speechSynthesis available — GENIE can speak replies." }
      : { pass: false, detail: "Not supported in this browser." },
  },
  {
    id: "mic",
    name: "Microphone permission",
    run: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return { pass: false, detail: "getUserMedia unavailable (needs HTTPS or localhost)." };
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        return { pass: true, detail: "Microphone granted." };
      } catch (e) {
        return { pass: false, detail: `Blocked or denied (${e.name || "error"}). Voice input will not work until allowed.` };
      }
    },
  },
  {
    id: "backend",
    name: "Backend ping",
    run: async () => {
      try {
        const r = await fetch("/api/vaults?notebook=GENIE");
        if (!r.ok) throw new Error(`status ${r.status}`);
        return { pass: true, detail: "GENIE server answered." };
      } catch (e) {
        return { pass: false, detail: `Server unreachable (${e.message}). Start it on :8787.` };
      }
    },
  },
  {
    id: "timer",
    name: "Timer accuracy",
    run: async () => {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 1000));
      const drift = Math.round(performance.now() - t0 - 1000);
      return Math.abs(drift) < 300
        ? { pass: true, detail: `1s timer drifted ${drift}ms — accurate.` }
        : { pass: false, detail: `1s timer drifted ${drift}ms — this tab may be throttled.` };
    },
  },
  {
    id: "vault",
    name: "Vault write + read",
    run: async () => {
      try {
        const { id } = await addVault("GENIE Self-Test", `self-test ${Date.now()}`);
        const list = await getVaults("GENIE Self-Test");
        const found = list.some((e) => e.id === id);
        await deleteVault(id);
        return found
          ? { pass: true, detail: "Wrote, read back, and cleaned up a test page." }
          : { pass: false, detail: "Wrote a test page but could not read it back." };
      } catch (e) {
        return { pass: false, detail: `Vault roundtrip failed (${e.message}).` };
      }
    },
  },
  {
    id: "download",
    name: "File download",
    run: async () => {
      try {
        const blob = new Blob(["GENIE self-test"], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "genie-self-test.txt";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return { pass: true, detail: "A test file was offered for download — check your downloads." };
      } catch (e) {
        return { pass: false, detail: `Download failed (${e.message}).` };
      }
    },
  },
];

export default function Test() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  async function runAll() {
    if (running) return;
    setRunning(true);
    setResults({});
    for (const c of CHECKS) {
      setResults((r) => ({ ...r, [c.id]: { status: "running" } }));
      try {
        const out = await c.run();
        setResults((r) => ({ ...r, [c.id]: { status: out.pass ? "pass" : "fail", detail: out.detail } }));
      } catch (e) {
        setResults((r) => ({ ...r, [c.id]: { status: "fail", detail: `Check crashed: ${e.message}` } }));
      }
    }
    setRunning(false);
  }

  const done = Object.values(results).filter((r) => r.status === "pass" || r.status === "fail").length;
  const passed = Object.values(results).filter((r) => r.status === "pass").length;

  return (
    <section className="card">
      <h2>GENIE self-tests</h2>
      <p className="muted">Real checks against this device and the GENIE server. No simulated passes — a fail tells you exactly why.</p>
      <button className="primary" onClick={runAll} disabled={running}>
        {running ? `Running… (${done}/${CHECKS.length})` : "Run all checks"}
      </button>
      {!running && done > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>{passed} of {CHECKS.length} passed.</p>
      )}
      <div style={{ marginTop: 10 }}>
        {CHECKS.map((c) => {
          const r = results[c.id];
          const cls = !r ? "idle" : r.status === "running" ? "idle" : r.status;
          const label = !r ? "—" : r.status === "running" ? "…" : r.status === "pass" ? "PASS" : "FAIL";
          return (
            <div key={c.id} className="check">
              <span className={`dot ${cls}`}>{label}</span>
              <span>
                <strong>{c.name}</strong>
                {r?.detail && <div className="detail">{r.detail}</div>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
