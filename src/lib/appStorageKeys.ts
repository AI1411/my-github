export const APP_STORAGE_PREFIX = "my-github-";
const LEGACY_PREFIX = "pulse-";

export function appStorageKey(suffix: string): string {
  return `${APP_STORAGE_PREFIX}${suffix}`;
}

export function readAppStorage(storage: Pick<Storage, "getItem">, suffix: string): string | null {
  const v = storage.getItem(appStorageKey(suffix));
  if (v !== null) return v;
  return storage.getItem(`${LEGACY_PREFIX}${suffix}`);
}

export function writeAppStorage(
  storage: Pick<Storage, "setItem">,
  suffix: string,
  value: string,
): void {
  storage.setItem(appStorageKey(suffix), value);
}
