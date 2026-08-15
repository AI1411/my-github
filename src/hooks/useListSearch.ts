import { useEffect, useRef, useState } from "react";
import { useSettingsShortcut } from "../hooks/useSettingsShortcut";
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

  useSettingsShortcut(
    "listSearch",
    () => {
      setOpen(true);
      queueMicrotask(() => inputRef.current?.focus());
    },
    { allowInInputs: true },
  );

  useSettingsShortcut(
    "closeDetail",
    (event) => {
      if (!open) return;
      event.preventDefault();
      setQuery("");
      setOpen(false);
    },
    { allowInInputs: true, preventDefault: false },
  );

  return { query, setQuery, open, setOpen, inputRef };
}
