import { useEffect, useRef, useState } from "react";
import { getVaults, addVault, deleteVault } from "../lib/api.js";

const NOTEBOOKS = ["Recipe & Cooking", "Life Journal", "Home & Health"];

const SALMON_SEED = `Pan-Seared Tuscan Salmon (template — replace with your own details)

Serves 2. Prep 10 min. Cook 15 min.

INGREDIENTS
- 2 salmon fillets, skin on
- 2 tbsp olive oil
- 3 cloves garlic, minced
- 1 cup cherry tomatoes, halved
- 2 cups baby spinach
- 1/2 cup heavy cream
- 1/4 cup grated parmesan
- 1 tsp Italian seasoning, salt, pepper

STEPS
1. Pat salmon dry; season with salt and pepper.
2. Sear skin-side down in hot oil, 5-6 min; flip, 2 min. Set aside.
3. Same pan: garlic 30 sec, tomatoes 2 min, spinach until wilted.
4. Stir in cream, parmesan, Italian seasoning; simmer 2 min.
5. Return salmon, spoon sauce over, 2 min. Serve.`;

export default function Vaults() {
  const [active, setActive] = useState(NOTEBOOKS[0]);
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seededRef = useRef(false);

  async function refresh(nb) {
    const list = await getVaults(nb);
    setEntries(list);
    return list;
  }

  useEffect(() => {
    setErr("");
    setBusy(true);
    refresh(active)
      .then((list) => {
        // Seed the recipe notebook once with the template.
        if (active === "Recipe & Cooking" && !seededRef.current && list.length === 0) {
          seededRef.current = true;
          return addVault(active, SALMON_SEED)
            .then(() => refresh(active))
            .catch(() => list);
        }
        // Never double-seed: if a seed already exists, mark it.
        if (active === "Recipe & Cooking" && list.some((e) => e.body.includes("Pan-Seared Tuscan Salmon"))) {
          seededRef.current = true;
        }
        return list;
      })
      .catch(() => setErr("Could not reach the GENIE backend — vaults need the server."))
      .finally(() => setBusy(false));
  }, [active]);

  async function add() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await addVault(active, body);
      setDraft("");
      await refresh(active);
    } catch {
      setErr("Could not save — backend offline.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await deleteVault(id);
      setEntries((es) => es.filter((e) => e.id !== id));
    } catch {
      setErr("Could not delete — backend offline.");
    }
  }

  return (
    <>
      <section className="card">
        <h2>Knowledge vaults</h2>
        <p className="muted">Three notebooks hold what GENIE remembers. Memory answers only from these pages and names the notebook it used.</p>
        <div className="tabs" role="tablist" aria-label="Notebooks">
          {NOTEBOOKS.map((n) => (
            <button key={n} className={`pill${active === n ? " active" : ""}`} onClick={() => setActive(n)} role="tab" aria-selected={active === n}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{active}</h3>
        {err && <p className="muted" style={{ color: "#ff8f8f" }}>{err}</p>}
        {busy && entries.length === 0 && <p className="thinking">Loading…</p>}
        {entries.map((e) => (
          <div key={e.id} className="list-item">
            <span className="txt" style={{ whiteSpace: "pre-wrap" }}>{e.body}</span>
            <button className="icon-btn danger" onClick={() => remove(e.id)} aria-label="Delete entry">Delete</button>
          </div>
        ))}
        {entries.length === 0 && !busy && <p className="muted">This notebook is empty. Add your first page below.</p>}
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a new page…" aria-label="New vault entry" style={{ marginTop: 8 }} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" onClick={add} disabled={busy || !draft.trim()}>Add page</button>
        </div>
      </section>
    </>
  );
}
