const STORAGE_KEY_PREFIX = "pulse.diff.viewed.";

function key(pullKey: string): string {
  return STORAGE_KEY_PREFIX + pullKey;
}

function readSet(pullKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key(pullKey));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(String));
  } catch {
    // ignore corrupt state
  }
  return new Set();
}

function writeSet(pullKey: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(pullKey), JSON.stringify(Array.from(set)));
}

export function getViewedSet(pullKey: string): Set<string> {
  return readSet(pullKey);
}

export function setViewed(
  pullKey: string,
  filename: string,
  viewed: boolean,
): void {
  const set = readSet(pullKey);
  if (viewed) set.add(filename);
  else set.delete(filename);
  writeSet(pullKey, set);
}
