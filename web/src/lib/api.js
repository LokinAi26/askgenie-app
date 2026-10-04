// Backend API helpers. Relative URLs hit the Vite dev proxy (/api -> :8787)
// in dev, and the same-origin backend in production.

export async function ask(question, notebook, imageBase64) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, notebook, imageBase64 }),
  });
  if (!res.ok) throw new Error(`backend responded ${res.status}`);
  return res.json();
}

export async function getVaults(notebook) {
  const q = notebook ? `?notebook=${encodeURIComponent(notebook)}` : "";
  const res = await fetch(`/api/vaults${q}`);
  if (!res.ok) throw new Error(`backend responded ${res.status}`);
  return res.json();
}

export async function addVault(notebook, body) {
  const res = await fetch("/api/vaults", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notebook, body }),
  });
  if (!res.ok) throw new Error(`backend responded ${res.status}`);
  return res.json();
}

export async function deleteVault(id) {
  const res = await fetch(`/api/vaults/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`backend responded ${res.status}`);
  return res.json();
}
