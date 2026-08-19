import { readAppStorage, writeAppStorage } from "./appStorageKeys";
const STORAGE_SUFFIX = "list-search";

function storageKey(accountId: string, routeKey: string): string {
  return `${accountId || "anon"}:${routeKey}`;
}

function readMap(storage: Pick<Storage, "getItem">): Record<string, string> {
  try {
    const raw = readAppStorage(storage, STORAGE_SUFFIX);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function loadListSearchQuery(
  accountId: string,
  routeKey: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): string {
  return readMap(storage)[storageKey(accountId, routeKey)] ?? "";
}

export function saveListSearchQuery(
  accountId: string,
  routeKey: string,
  query: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): void {
  try {
    const map = readMap(storage);
    const key = storageKey(accountId, routeKey);
    if (query) map[key] = query;
    else delete map[key];
    writeAppStorage(storage, STORAGE_SUFFIX, JSON.stringify(map));
  } catch {
    // ignore persistence failures
  }
}

export function matchesListSearch(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return text.toLowerCase().includes(needle);
}
