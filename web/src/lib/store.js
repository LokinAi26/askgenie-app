// Tiny localStorage JSON helpers, namespaced under "genie:".

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(`genie:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(`genie:${key}`, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function clearAll() {
  const doomed = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("genie:")) doomed.push(k);
  }
  doomed.forEach((k) => localStorage.removeItem(k));
}
