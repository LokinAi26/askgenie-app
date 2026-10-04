import { useEffect, useRef, useState } from "react";
import { ask } from "../lib/api.js";
import { load, save } from "../lib/store.js";
import {
  recognitionSupported, makeRecognizer, speak, stopSpeaking,
} from "../lib/speech.js";

const ENGINES = ["Auto", "Action", "Strategy", "Memory"];
const NOTEBOOKS = ["Recipe & Cooking", "Life Journal", "Home & Health"];
const RHYTHM = [
  ["08:00", "Breakfast"],
  ["13:00", "Lunch"],
  ["18:00", "Dinner"],
  ["20:00", "Tidy up"],
  ["22:00", "Wind down"],
];

function LampGlyph({ active }) {
  return (
    <svg viewBox="0 0 100 70" aria-hidden="true">
      <path d="M24 44 Q10 42 12 30 Q14 21 25 25" fill="none" stroke="#3a2c10" strokeWidth="6" strokeLinecap="round" />
      <path d="M22 48 Q22 32 44 32 L58 32 Q78 32 80 44 Q81 54 68 55 L38 55 Q24 55 22 48 Z"
        fill={active ? "#ffe9a8" : "#8a6a24"} stroke="#3a2c10" strokeWidth="3" />
      <path d="M80 42 L97 33 L94 45 L79 48 Z" fill={active ? "#ffe9a8" : "#8a6a24"} stroke="#3a2c10" strokeWidth="3" strokeLinejoin="round" />
      <rect x="44" y="21" width="16" height="11" rx="4" fill={active ? "#ffe9a8" : "#8a6a24"} stroke="#3a2c10" strokeWidth="3" />
      <circle cx="52" cy="16" r="4.5" fill="#f0c75e" stroke="#3a2c10" strokeWidth="2.5" />
    </svg>
  );
}

function parseTimerCommand(text) {
  if (!/timer/i.test(text)) return null;
  const m = text.match(/(\d+)\s*(second|minute|hour)s?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const minutes = unit === "hour" ? n * 60 : unit === "second" ? Math.max(n / 60, 0.1) : n;
  const lm = text.match(/for\s+["']?(.+?)["']?\s*$/i);
  return { minutes, label: lm ? lm[1].trim() : "Timer" };
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function CameraModal({ onClose, onAnalyze }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [mode, setMode] = useState("choose"); // choose | live | preview
  const [img, setImg] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => () => stop(), []);

  function stop() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function takePhoto() {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("This browser does not allow camera access. Choose a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setMode("live");
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (e) {
      setErr(`Camera blocked (${e.name || "denied"}). Choose a file instead, or allow camera permission.`);
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    const scale = Math.min(1, 900 / Math.max(w, h));
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    stop();
    setImg(c.toDataURL("image/jpeg", 0.8));
    setMode("preview");
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImg(r.result); setMode("preview"); };
    r.readAsDataURL(f);
  }

  return (
    <div className="cam-modal" role="dialog" aria-label="Sous chef camera">
      {mode === "choose" && (
        <>
          <h3 style={{ color: "#f0c75e", margin: 0 }}>Sous Chef camera</h3>
          <p className="muted">Hold up your ingredients. GENIE names them and tells you if they look fresh.</p>
          <button className="primary" onClick={takePhoto}>Take photo</button>
          <button onClick={() => fileRef.current?.click()}>Choose file</button>
          <button className="ghost" onClick={onClose}>Cancel</button>
          {err && <p className="muted" style={{ color: "#ff8f8f" }}>{err}</p>}
        </>
      )}
      {mode === "live" && (
        <>
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="row">
            <button className="primary" onClick={capture}>Capture</button>
            <button className="ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
      {mode === "preview" && img && (
        <>
          <img className="preview" src={img} alt="Ingredients" />
          <div className="row">
            <button className="primary" onClick={() => onAnalyze(img)}>Identify ingredients</button>
            <button className="ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden-input" onChange={onFile} />
    </div>
  );
}

export default function Talk({ settings, setSettings }) {
  const [messages, setMessages] = useState(() =>
    settings.autoSave
      ? load("talk-chat", [{ role: "genie", text: "Hi, I'm GENIE. Try: \"Hey GENIE, set a 10-minute timer for 'Kitchen Prep'\"." }])
      : [{ role: "genie", text: "Hi, I'm GENIE. Try: \"Hey GENIE, set a 10-minute timer for 'Kitchen Prep'\"." }]
  );
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState("Auto");
  const [busy, setBusy] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [lampActive, setLampActive] = useState(false);
  const [holding, setHolding] = useState(false);
  const [srNote, setSrNote] = useState("");
  const [timers, setTimers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [timerMin, setTimerMin] = useState("10");
  const [timerLabel, setTimerLabel] = useState("Kitchen Prep");
  const [camOpen, setCamOpen] = useState(false);
  const [sousBusy, setSousBusy] = useState(false);
  const [sousResult, setSousResult] = useState(null);
  const [memQ, setMemQ] = useState("");
  const [memNotebook, setMemNotebook] = useState(NOTEBOOKS[0]);
  const [memAnswer, setMemAnswer] = useState(null);
  const [memBusy, setMemBusy] = useState(false);

  const chatRef = useRef(null);
  const wakeRecRef = useRef(null);
  const wakeOnRef = useRef(false);
  const lastWakeRef = useRef(0);
  const holdRecRef = useRef(null);
  const srOK = recognitionSupported();

  useEffect(() => {
    if (settings.autoSave) save("talk-chat", messages.slice(-50));
  }, [messages, settings.autoSave]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Timer ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setNow(Date.now());
      setTimers((ts) =>
        ts.map((t) => {
          if (!t.done && Date.now() >= t.endsAt) {
            const msg = `Timer finished: ${t.label}`;
            if (settings.speakReplies) speak(msg, settings).catch(() => {});
            return { ...t, done: true };
          }
          return t;
        })
      );
    }, 500);
    return () => clearInterval(iv);
  }, [settings]);

  // Wake-word listener
  useEffect(() => {
    wakeOnRef.current = wakeOn;
    if (!wakeOn) {
      try { wakeRecRef.current?.stop(); } catch {}
      wakeRecRef.current = null;
      return;
    }
    if (!srOK) return;
    const rec = makeRecognizer(settings.lang);
    rec.continuous = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      if (text.toLowerCase().includes("hey genie")) {
        const t = Date.now();
        if (t - lastWakeRef.current > 4000) {
          lastWakeRef.current = t;
          onWake();
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setSrNote("Microphone blocked — allow mic permission to use the wake word.");
        setWakeOn(false);
      }
    };
    rec.onend = () => {
      if (wakeOnRef.current && wakeRecRef.current === rec) {
        try { rec.start(); } catch {}
      }
    };
    wakeRecRef.current = rec;
    try { rec.start(); } catch {}
    return () => {
      wakeOnRef.current = false;
      try { rec.stop(); } catch {}
      if (wakeRecRef.current === rec) wakeRecRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeOn, settings.lang]);

  function pushMsg(role, text) {
    setMessages((ms) => [...ms, { role, text }]);
  }

  function onWake() {
    setLampActive(true);
    if (settings.speakReplies) speak("Yes?", settings).catch(() => {});
    if (!srOK) { setLampActive(false); return; }
    const cmd = makeRecognizer(settings.lang);
    cmd.continuous = false;
    let got = false;
    cmd.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const t = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
        if (t) {
          got = true;
          setLampActive(false);
          try { cmd.stop(); } catch {}
          send(t.replace(/^hey genie[, ]*/i, ""));
        }
      }
    };
    const done = () => setLampActive(false);
    cmd.onend = done;
    cmd.onerror = done;
    setTimeout(() => { if (!got) { try { cmd.stop(); } catch {} done(); } }, 12000);
    try { cmd.start(); } catch { done(); }
  }

  async function send(raw) {
    const text = raw.trim();
    if (!text || busy) return;
    pushMsg("you", text);
    setInput("");
    const tc = parseTimerCommand(text);
    if (tc) {
      addTimer(tc.minutes, tc.label);
      const reply = `Timer set: ${Math.round(tc.minutes * 10) / 10} minute(s) for "${tc.label}".`;
      pushMsg("genie", reply);
      if (settings.speakReplies) speak(reply, settings).catch(() => {});
      return;
    }
    setBusy(true);
    try {
      const q = engine === "Auto" ? text : `[${engine}] ${text}`;
      const { answer } = await ask(q);
      const a = answer || "(GENIE had nothing to say.)";
      pushMsg("genie", a);
      if (settings.speakReplies) speak(a, settings).catch(() => {});
    } catch {
      pushMsg("genie", "I could not reach my brain just now — the GENIE backend is offline. Timers, lists and vaults still work on this device.");
    } finally {
      setBusy(false);
    }
  }

  function addTimer(minutes, label) {
    setTimers((ts) => [
      ...ts,
      { id: Date.now() + Math.random(), label, endsAt: Date.now() + minutes * 60000, done: false },
    ]);
  }

  function holdStart(e) {
    e.preventDefault();
    if (!srOK) { setSrNote("Voice input needs Chrome or Edge on desktop/Android."); return; }
    const rec = makeRecognizer(settings.lang);
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript + " ";
      }
    };
    rec.onend = () => {
      setHolding(false);
      if (finalText.trim()) send(finalText.trim());
    };
    rec.onerror = () => setHolding(false);
    holdRecRef.current = rec;
    try { rec.start(); setHolding(true); setSrNote(""); } catch { setHolding(false); }
  }
  function holdEnd() {
    try { holdRecRef.current?.stop(); } catch {}
  }

  async function analyzePhoto(img) {
    setCamOpen(false);
    setSousBusy(true);
    setSousResult(null);
    try {
      const base64 = img.split(",")[1];
      const { answer } = await ask(
        "What ingredients do you see in this photo, and do they look fresh? Keep it short.",
        undefined,
        base64
      );
      setSousResult({ img, answer: answer || "(no answer)" });
      if (settings.speakReplies) speak(answer, settings).catch(() => {});
    } catch {
      setSousResult({ img, answer: "I could not reach my brain — the GENIE backend is offline." });
    } finally {
      setSousBusy(false);
    }
  }

  async function askMemory() {
    const q = memQ.trim();
    if (!q || memBusy) return;
    setMemBusy(true);
    setMemAnswer(null);
    try {
      const { answer } = await ask(q, memNotebook);
      setMemAnswer({ notebook: memNotebook, text: answer || "(no answer)" });
    } catch {
      setMemAnswer({ notebook: memNotebook, text: "Backend offline — vault answers need the GENIE server." });
    } finally {
      setMemBusy(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: "center" }}>
          <span className="wake-pill on" style={{ marginTop: 0 }}>Hey GENIE</span>
        </div>
        <div className="lamp-wrap">
          <button
            className={`lamp-btn${lampActive ? " listening" : ""}`}
            onClick={onWake}
            aria-label="Rub the lamp to wake GENIE"
          >
            <LampGlyph active={lampActive} />
          </button>
          <div><span className={`wake-pill${wakeOn ? " on" : ""}`}>
            {wakeOn ? "Wake word is on — listening" : "Wake word is off"}
          </span></div>
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          <label className="check">
            <input
              type="checkbox"
              checked={wakeOn}
              onChange={(e) => {
                setSrNote("");
                setWakeOn(e.target.checked);
              }}
            />
            Always listen for "Hey GENIE"
          </label>
        </div>
        {!srOK && (
          <p className="muted">Voice input is not supported in this browser — use Chrome or Edge. Typing "Hey GENIE" always works.</p>
        )}
        {srNote && <p className="muted" style={{ color: "#ff8f8f" }}>{srNote}</p>}
        <div className="pills" role="group" aria-label="Engine">
          {ENGINES.map((en) => (
            <button key={en} className={`pill${engine === en ? " active" : ""}`} onClick={() => setEngine(en)}>
              {en}
            </button>
          ))}
        </div>
        <p className="muted">Action for schedules and lists, Strategy for planning and cooking, Memory for your vaults.</p>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.speakReplies}
            onChange={(e) => setSettings({ ...settings, speakReplies: e.target.checked })}
          />
          Speak replies
        </label>

        <div className="chat" ref={chatRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">{m.role === "genie" ? "GENIE" : "YOU"}</span>
              {m.text}
            </div>
          ))}
          {busy && <div className="thinking">GENIE is thinking…</div>}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder='Say or type "Hey GENIE…"'
            aria-label="Message GENIE"
          />
          <button className="primary" onClick={() => send(input)} disabled={busy}>Send</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className={holding ? "primary" : ""}
            onPointerDown={holdStart}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {holding ? "Listening… release" : "Hold mic"}
          </button>
          <button className="ghost" onClick={() => stopSpeaking()}>Stop voice</button>
        </div>
      </section>

      <section className="card">
        <h3>Timers</h3>
        <div className="pills">
          {[1, 5, 10, 15, 20, 30].map((m) => (
            <button key={m} className="pill" onClick={() => addTimer(m, timerLabel || "Timer")}>{m} min</button>
          ))}
        </div>
        <div className="row">
          <input type="number" min="1" value={timerMin} onChange={(e) => setTimerMin(e.target.value)} style={{ width: 90 }} aria-label="Minutes" />
          <input type="text" value={timerLabel} onChange={(e) => setTimerLabel(e.target.value)} placeholder="Label" className="grow" aria-label="Timer label" />
          <button onClick={() => addTimer(Math.max(1, parseInt(timerMin, 10) || 1), timerLabel || "Timer")}>Start</button>
        </div>
        {timers.length === 0 && <p className="muted">No timers running. Ask GENIE to set one.</p>}
        {timers.filter((t) => t.done).map((t) => (
          <div key={t.id} className="alert-banner">
            Timer finished: {t.label}
            <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
              <button onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))}>Clear</button>
            </div>
          </div>
        ))}
        {timers.filter((t) => !t.done).map((t) => (
          <div key={t.id} className="timer">
            <span className="t">{fmt(t.endsAt - now)}</span>
            <span className="lbl">{t.label}</span>
            <button className="icon-btn ghost" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))}>Cancel</button>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Sous Chef camera</h3>
        <p className="muted">Hold up your ingredients. GENIE names them and tells you if they look fresh.</p>
        <button className="primary" onClick={() => setCamOpen(true)}>Take or choose photo</button>
        {sousBusy && <p className="thinking">GENIE is looking at your ingredients…</p>}
        {sousResult && (
          <>
            <img className="thumb" src={sousResult.img} alt="Your ingredients" />
            <div className="answer-box">{sousResult.answer}</div>
          </>
        )}
      </section>

      <section className="card">
        <h3>Day's rhythm</h3>
        <ul className="rhythm">
          {RHYTHM.map(([t, label]) => (
            <li key={t}><span className="time">{t}</span><span>{label}</span></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Memory</h3>
        <p className="muted">Answers come only from your vault notebooks, and name the notebook used.</p>
        <div className="row">
          <select value={memNotebook} onChange={(e) => setMemNotebook(e.target.value)} aria-label="Notebook">
            {NOTEBOOKS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div className="chat-input" style={{ marginTop: 8 }}>
          <input type="text" value={memQ} onChange={(e) => setMemQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askMemory()}
            placeholder="Ask about your vaults…" aria-label="Ask your vaults" />
          <button className="primary" onClick={askMemory} disabled={memBusy}>Ask</button>
        </div>
        {memAnswer && (
          <div className="answer-box">
            <span className="notebook-tag">From: {memAnswer.notebook}</span>
            <div>{memAnswer.text}</div>
          </div>
        )}
      </section>

      {camOpen && <CameraModal onClose={() => setCamOpen(false)} onAnalyze={analyzePhoto} />}
    </>
  );
}
