import { useEffect, useRef, useState } from "react";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { loadListSearchQuery, saveListSearchQuery } from "../lib/listSearch";

export function useListSearch(accountId: string, routeKey: string) {
  const [query, setQuery] = useState(() => loadListSearchQuery(accountId, routeKey));
  const [open, setOpen] = useState(() => Boolean(loadListSearchQuery(accountId, routeKey)));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const restored = loadListSearchQuery(accountId, routeKey);
    setQuery(restored);
    setOpen(Boolean(restored));
  }, [accountId, routeKey]);

  useEffect(() => {
    saveListSearchQuery(accountId, routeKey, query);
  }, [accountId, routeKey, query]);

  useKeyboardShortcut(
    { key: "f", meta: true, preventDefault: true },
    () => {
      setOpen(true);
      queueMicrotask(() => inputRef.current?.focus());
    },
    { allowInInputs: true },
  );

  useKeyboardShortcut(
    { key: "Escape" },
    (event) => {
      if (!open) return;
      event.preventDefault();
      setQuery("");
      setOpen(false);
    },
    { allowInInputs: true },
  );

  return { query, setQuery, open, setOpen, inputRef };
}
