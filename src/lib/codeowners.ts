/**
 * Minimal CODEOWNERS parser + path matcher (GitHub-compatible enough for MVP).
 * Patterns use gitignore-style globs; last matching rule wins.
 */

export interface CodeownersRule {
  pattern: string;
  owners: string[];
}

export interface FileOwnerMatch {
  path: string;
  owners: string[];
  pattern: string | null;
}

export function parseCodeowners(text: string): CodeownersRule[] {
  const rules: CodeownersRule[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const [pattern, ...owners] = parts;
    rules.push({ pattern, owners });
  }
  return rules;
}

/** Convert a CODEOWNERS pattern to a RegExp (subset of gitignore). */
export function patternToRegExp(pattern: string): RegExp {
  let p = pattern;
  let anchoredDir = false;
  if (p.startsWith("/")) {
    p = p.slice(1);
    anchoredDir = true;
  }
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") {
      re += ".*";
      i++;
      if (p[i + 1] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^$()[]{}|\\".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  if (anchoredDir) {
    return new RegExp(`^${re}(?:/.*)?$`);
  }
  // Unanchored: match anywhere as a path segment suffix
  return new RegExp(`(?:^|/)${re}(?:/.*)?$`);
}

export function matchCodeowners(path: string, rules: CodeownersRule[]): FileOwnerMatch {
  const normalized = path.replace(/^\.\//, "");
  let matched: CodeownersRule | null = null;
  for (const rule of rules) {
    try {
      if (patternToRegExp(rule.pattern).test(normalized)) {
        matched = rule;
      }
    } catch {
      // ignore invalid patterns
    }
  }
  return {
    path: normalized,
    owners: matched?.owners ?? [],
    pattern: matched?.pattern ?? null,
  };
}

export function uniqueOwners(matches: FileOwnerMatch[]): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    for (const o of m.owners) set.add(o);
  }
  return [...set].sort();
}

export interface ReviewContextInput {
  requestedReviewers: string[];
  requestedTeams: string[];
  /** CODEOWNERS owners that match changed files (user or @org/team). */
  requiredOwners: string[];
  /** Logins that have APPROVED (latest per user). */
  approvedLogins: string[];
}

export interface ReviewGap {
  kind: "user" | "team" | "codeowner";
  name: string;
  reason: string;
}

/**
 * Unmet review requirements: pending requests + unmatched CODEOWNERS entries
 * that are not covered by an approval from the same login/team slug.
 */
export function computeReviewGaps(input: ReviewContextInput): ReviewGap[] {
  const gaps: ReviewGap[] = [];
  const approved = new Set(input.approvedLogins.map((s) => s.toLowerCase()));

  for (const login of input.requestedReviewers) {
    if (!approved.has(login.toLowerCase())) {
      gaps.push({
        kind: "user",
        name: login,
        reason: "Review requested — not yet approved",
      });
    }
  }

  for (const team of input.requestedTeams) {
    const slug = team.includes("/") ? team.split("/").pop()! : team;
    const covered = approved.has(team.toLowerCase()) || approved.has(slug.toLowerCase());
    if (!covered) {
      gaps.push({
        kind: "team",
        name: team,
        reason: "Team review requested — still pending",
      });
    }
  }

  for (const owner of input.requiredOwners) {
    const bare = owner.replace(/^@/, "");
    const isTeam = bare.includes("/");
    const alreadyRequested =
      input.requestedReviewers.some((r) => r.toLowerCase() === bare.toLowerCase()) ||
      input.requestedTeams.some(
        (t) =>
          t.toLowerCase() === bare.toLowerCase() ||
          t.toLowerCase().endsWith(`/${bare.split("/").pop()}`),
      );
    if (alreadyRequested) continue;
    const loginOrSlug = bare.includes("/") ? bare.split("/").pop()! : bare;
    if (approved.has(bare.toLowerCase()) || approved.has(loginOrSlug.toLowerCase())) {
      continue;
    }
    gaps.push({
      kind: "codeowner",
      name: owner.startsWith("@") ? owner : `@${owner}`,
      reason: isTeam
        ? "CODEOWNERS team — no matching approval yet"
        : "CODEOWNERS owner — no matching approval yet",
    });
  }

  return gaps;
}
