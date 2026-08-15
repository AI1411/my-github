import { SNOOZE_OPTIONS, type SnoozeOption } from "../../lib/snooze";

interface SnoozePickerProps {
  open: boolean;
  onPick: (option: SnoozeOption) => void;
  onClose: () => void;
}

export function SnoozePicker({ open, onPick, onClose }: SnoozePickerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Snooze until"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Snooze until
        </span>
        <button
          type="button"
          aria-label="Close snooze picker"
          onClick={onClose}
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          Esc
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {SNOOZE_OPTIONS.map((option, index) => (
          <button
            key={option.id}
            type="button"
            aria-label={`Snooze until ${option.label}`}
            onClick={() => onPick(option.id)}
            className="rounded px-2.5 py-1.5 text-xs"
            style={{
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-tertiary)",
            }}
          >
            <kbd className="mr-1.5 opacity-60">{index + 1}</kbd>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
