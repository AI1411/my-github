import type { RefObject } from "react";

interface ListSearchBarProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder?: string;
}

export function ListSearchBar({
  open,
  query,
  onQueryChange,
  inputRef,
  placeholder = "Filter list…",
}: ListSearchBarProps) {
  if (!open) return null;
  return (
    <div
      className="border-b px-4 py-2"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}
    >
      <input
        ref={inputRef}
        type="search"
        aria-label="List search"
        value={query}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        className="w-full rounded-md px-3 py-1.5 text-sm outline-none"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}
