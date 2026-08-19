const KNOWN_BOT_LOGINS = new Set([
  "dependabot",
  "dependabot[bot]",
  "renovate",
  "renovate[bot]",
  "github-actions[bot]",
]);

/** Whether a GitHub login belongs to a bot (Dependabot, Renovate, Actions, etc.). */
export function isBotLogin(login: string): boolean {
  const normalized = login.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.endsWith("[bot]")) return true;
  return KNOWN_BOT_LOGINS.has(normalized);
}
