export function isAuthExpiredError(error: unknown): boolean {
  const text = String(error);
  if (/HTTP request failed/i.test(text) && !/\b401\b/.test(text)) return false;
  if (
    /network error|offline|failed to fetch|econnrefused|timed out|timeout/i.test(text) &&
    !/\b401\b/.test(text)
  ) {
    return false;
  }
  return (
    /\b401\b/.test(text) || /bad credentials/i.test(text) || /invalid or expired PAT/i.test(text)
  );
}
