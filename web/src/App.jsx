import { useEffect, useRef, useState } from "react";
import Talk from "./components/Talk.jsx";
import Kitchen from "./components/Kitchen.jsx";
import Apps from "./components/Apps.jsx";
import Vaults from "./components/Vaults.jsx";
import Day from "./components/Day.jsx";
import Test from "./components/Test.jsx";
import System from "./components/System.jsx";
import { load, save } from "./lib/store.js";

function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let stars = [];
    let raf = 0;
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        p: Math.random() * Math.PI * 2,
        s: 0.5 + Math.random() * 1.5,
      }));
    }
    function tick(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 1000 * s.s + s.p));
        ctx.globalAlpha = tw;
        ctx.fillStyle = "#dfe6ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas id="starfield" ref={ref} aria-hidden="true" />;
}

function Palace() {
  return (
    <svg className="palace" viewBox="0 0 480 150" aria-hidden="true">
      <defs>
        <radialGradient id="moonglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fdf6d8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fdf6d8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="398" cy="34" r="46" fill="url(#moonglow)" />
      <circle cx="398" cy="34" r="20" fill="#f7efcd" />
      <circle cx="390" cy="28" r="4" fill="#e3d6a8" opacity="0.7" />
      <circle cx="405" cy="40" r="3" fill="#e3d6a8" opacity="0.6" />
      <g fill="#04061a">
        <path d="M0 150 V118 H52 V100 H84 V118 H140 V94 Q140 66 168 66 Q196 66 196 94 V118 H252 V102 H284 V118 H336 V86 Q336 58 364 58 Q392 58 392 86 V118 H428 V100 H460 V118 H480 V150 Z" />
        <rect x="112" y="52" width="10" height="66" />
        <circle cx="117" cy="48" r="9" />
        <rect x="114.5" y="30" width="5" height="14" />
        <rect x="238" y="60" width="10" height="58" />
        <circle cx="243" cy="56" r="9" />
        <rect x="240.5" y="38" width="5" height="14" />
      </g>
      <g fill="#f0c75e" opacity="0.85">
        <rect x="160" y="96" width="6" height="10" rx="3" />
        <rect x="172" y="96" width="6" height="10" rx="3" />
        <rect x="356" y="88" width="6" height="10" rx="3" />
        <rect x="368" y="88" width="6" height="10" rx="3" />
        <rect x="60" y="106" width="6" height="8" rx="3" />
        <rect x="260" y="108" width="6" height="8" rx="3" />
      </g>
    </svg>
  );
}

const icon = (paths) => (
  <svg className="glyph" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">{paths}</svg>
);

const TABS = [
  { id: "talk", label: "TALK", glyph: icon(<><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></>) },
  { id: "kitchen", label: "KITCHEN", glyph: icon(<><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 0 2 2h13" /><path d="M9 7h6" /></>) },
  { id: "apps", label: "APPS", glyph: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { id: "vaults", label: "VAULTS", glyph: icon(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>) },
  { id: "day", label: "DAY", glyph: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>) },
  { id: "test", label: "TEST", glyph: icon(<><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></>) },
  { id: "system", label: "SYSTEM", glyph: icon(<><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2.2" /><circle cx="10" cy="16" r="2.2" /></>) },
];

export default function App() {
  const [tab, setTab] = useState("talk");
  const [settings, setSettings] = useState(() =>
    load("settings", { speakReplies: true, lang: "en-US", voiceURI: "", autoSave: true })
  );

  useEffect(() => { save("settings", settings); }, [settings]);

  return (
    <div className="app">
      <Starfield />
      <header className="hero">
        <Palace />
        <h1>GENIE</h1>
        <p className="sub">Your wish is my command.</p>
      </header>
      <main>
        {tab === "talk" && <Talk settings={settings} />}
        {tab === "kitchen" && <Kitchen />}
        {tab === "apps" && <Apps />}
        {tab === "vaults" && <Vaults />}
        {tab === "day" && <Day />}
        {tab === "test" && <Test />}
        {tab === "system" && <System settings={settings} setSettings={setSettings} />}
      </main>
      <nav className="bottom-nav" aria-label="Sections">
        <div className="inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-btn${tab === t.id ? " active" : ""}`}
              onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.glyph}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
