export interface ReactionInfo {
  content: string;
  count: number;
  viewerHasReacted: boolean;
}

export interface ReactionPillsProps {
  reactions: ReactionInfo[];
  busy?: boolean;
  onToggle: (content: string) => void;
}

const EMOJI: Record<string, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

export function ReactionPills({ reactions, busy, onToggle }: ReactionPillsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
      {reactions.map((r) => {
        const emoji = EMOJI[r.content] ?? r.content;
        const show = r.count > 0 || r.viewerHasReacted;
        if (!show) {
          return (
            <button
              key={r.content}
              type="button"
              disabled={busy}
              title={r.content}
              aria-label={`React with ${r.content}`}
              aria-pressed={false}
              onClick={() => onToggle(r.content)}
              className="rounded px-1.5 py-0.5 text-[12px] opacity-40 hover:opacity-100"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid transparent",
              }}
            >
              {emoji}
            </button>
          );
        }
        return (
          <button
            key={r.content}
            type="button"
            disabled={busy}
            title={r.content}
            aria-label={`${r.content} reaction, ${r.count}`}
            aria-pressed={r.viewerHasReacted}
            onClick={() => onToggle(r.content)}
            className="rounded px-1.5 py-0.5 text-[12px]"
            style={{
              color: r.viewerHasReacted ? "var(--accent-blue, #58a6ff)" : "var(--text-secondary)",
              backgroundColor: r.viewerHasReacted
                ? "color-mix(in srgb, var(--accent-blue, #58a6ff) 15%, transparent)"
                : "var(--bg-tertiary)",
              border: `1px solid ${
                r.viewerHasReacted
                  ? "var(--accent-blue, #58a6ff)"
                  : "var(--border-subtle)"
              }`,
            }}
          >
            {emoji}
            {r.count > 0 ? <span className="ml-1 tabular-nums">{r.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
