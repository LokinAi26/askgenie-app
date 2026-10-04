import { useState } from "react";
import { ask } from "../lib/api.js";

const BOOKS = [
  { t: "Cast Iron Classics", a: "Skillet favorites", c: "#7a2e22" },
  { t: "30-Minute Meals", a: "Weeknight wins", c: "#2e5d33" },
  { t: "Baking Basics", a: "Flour, water, fire", c: "#8a5a1e" },
  { t: "Grill Master", a: "Smoke & sear", c: "#4a2e4a" },
  { t: "Vegan Kitchen", a: "Plants, plenty", c: "#2e6b4f" },
  { t: "Sauces & Stocks", a: "The flavor lab", c: "#6b2e3e" },
  { t: "Dessert Lab", a: "Sweet science", c: "#5a3a7a" },
  { t: "World Flavors", a: "A global tour", c: "#1e4a6b" },
];

const YT = [
  ["Beginner cooking", "cooking+videos+for+beginners"],
  ["Easy recipes", "easy+cooking+recipes"],
  ["30-minute meals", "30+minute+meals"],
];

const LIBRARIES = [
  ["Project Gutenberg", "Free public-domain cookbooks, full text.", "https://www.gutenberg.org/ebooks/search/?query=cookery"],
  ["Internet Archive", "Scanned historic cookbooks to borrow or read.", "https://archive.org/search?query=cookbook"],
  ["Google Books", "Preview and full-view cookbooks.", "https://www.google.com/search?tbm=bks&q=cookbook"],
  ["Open Library", "Borrowable cookbook collection.", "https://openlibrary.org/search?q=cookbook"],
];

export default function Kitchen() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setAnswer("");
    try {
      const { answer: a } = await ask(`[Strategy] Give me a recipe for: ${text}. Include ingredients and steps, kept concise.`);
      setAnswer(a || "(no answer)");
    } catch {
      setAnswer("The GENIE backend is offline — recipe maker needs the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card">
        <h2>Cookbook shelf</h2>
        <p className="muted">A shelf to browse. Tap a spine to ask GENIE for a recipe in that style.</p>
        <div className="shelf">
          {BOOKS.map((b) => (
            <button key={b.t} className="book" style={{ background: b.c, textAlign: "left" }}
              onClick={() => { setQ(b.t.toLowerCase() + " recipe"); }}>
              <span className="t">{b.t}</span>
              <span className="a">{b.a}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Ask GENIE for a recipe</h3>
        <div className="chat-input">
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. spicy garlic shrimp pasta" aria-label="Recipe request" />
          <button className="primary" onClick={create} disabled={busy}>Create</button>
        </div>
        {busy && <p className="thinking">GENIE is writing your recipe…</p>}
        {answer && <div className="answer-box">{answer}</div>}
      </section>

      <section className="card">
        <h3>Cooking videos</h3>
        <p className="muted">Each button opens a YouTube search for that topic in a new tab.</p>
        <div className="pills">
          {YT.map(([label, query]) => (
            <a key={label} href={`https://www.youtube.com/results?search_query=${query}`}
              target="_blank" rel="noopener noreferrer">
              <button>{label}</button>
            </a>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Cookbooks to browse</h3>
        <p className="muted">These open free public libraries in a new tab. Books published long ago are often free to read in full.</p>
        {LIBRARIES.map(([name, desc, url]) => (
          <div key={name} className="list-item">
            <span className="txt"><strong>{name}</strong><br /><span className="muted">{desc}</span></span>
            <a href={url} target="_blank" rel="noopener noreferrer"><button className="icon-btn">Open</button></a>
          </div>
        ))}
      </section>
    </>
  );
}
