/** Saved GitHub search query shown in ⌘K when the palette query is empty. */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
}

const ADVANCED_PREFIX = /^(is:|repo:)/i;

/** True when the query looks like a GitHub search qualifier (is:/repo:). */
export function isAdvancedSearchQuery(query: string): boolean {
  return ADVANCED_PREFIX.test(query.trim());
}

/**
 * Whether ⌘K should call `cmd_search_github`.
 * Advanced queries and explicit search mode always search; otherwise keep the
 * existing length ≥ 3 debounce for fuzzy + remote hybrid.
 */
export function shouldRunGithubSearch(query: string, searchMode: boolean): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (searchMode || isAdvancedSearchQuery(trimmed)) return true;
  return trimmed.length >= 3;
}

/** Build a saved-search payload; returns null when name or query is empty. */
export function createSavedSearch(name: string, query: string): Omit<SavedSearch, "id"> | null {
  const trimmedName = name.trim();
  const trimmedQuery = query.trim();
  if (!trimmedName || !trimmedQuery) return null;
  return { name: trimmedName, query: trimmedQuery };
}

/** Default display name for a query (used by “Save search”). */
export function defaultSavedSearchName(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
}
