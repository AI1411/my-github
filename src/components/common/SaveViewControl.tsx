import { useState } from "react";

interface SaveViewControlProps {
  onSave: (name: string) => void;
}

export function SaveViewControl({ onSave }: SaveViewControlProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const finish = (save: boolean) => {
    const trimmed = name.trim();
    if (save && trimmed) onSave(trimmed);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2.5 py-1.5 text-xs font-medium"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        Save view
      </button>
    );
  }

  return (
    <input
      aria-label="View name"
      value={name}
      autoFocus
      placeholder="View name"
      onChange={(event) => setName(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
      className="rounded-md px-2.5 py-1.5 text-xs outline-none"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-default)",
        color: "var(--text-primary)",
        width: 160,
      }}
    />
  );
}
