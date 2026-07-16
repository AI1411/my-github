import { useCallback, useEffect, useRef, useState } from "react";

export interface UseListNavigationOptions<T> {
  items: T[];
  getId: (item: T) => string;
  onSelect?: (item: T) => void;
  onOpen?: (item: T) => void;
  enabled?: boolean;
}

export interface UseListNavigationResult<T> {
  activeId: string | null;
  activeIndex: number;
  activeItem: T | null;
  setActiveId: (id: string | null) => void;
  registerItemRef: (id: string) => (el: HTMLElement | null) => void;
  moveBy: (delta: number) => void;
}

export function useListNavigation<T>({
  items,
  getId,
  onSelect,
  onOpen,
  enabled = true,
}: UseListNavigationOptions<T>): UseListNavigationResult<T> {
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [activeId, setActiveIdState] = useState<string | null>(
    items.length ? getId(items[0]) : null,
  );

  useEffect(() => {
    if (items.length === 0) {
      setActiveIdState(null);
      return;
    }
    const exists = activeId !== null && items.some((i) => getId(i) === activeId);
    if (!exists) setActiveIdState(getId(items[0]));
  }, [items, getId, activeId]);

  const activeIndex = activeId ? items.findIndex((i) => getId(i) === activeId) : -1;

  const setActiveId = useCallback(
    (id: string | null) => {
      setActiveIdState(id);
      if (id) {
        const node = itemRefs.current.get(id);
        node?.scrollIntoView({ block: "nearest" });
        const item = items.find((i) => getId(i) === id);
        if (item && onSelect) onSelect(item);
      }
    },
    [items, getId, onSelect],
  );

  const moveBy = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const cur = activeIndex < 0 ? 0 : activeIndex;
      const next = Math.min(items.length - 1, Math.max(0, cur + delta));
      setActiveId(getId(items[next]));
    },
    [items, activeIndex, getId, setActiveId],
  );

  const registerItemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        moveBy(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        moveBy(-1);
      } else if (event.key === "Enter") {
        if (activeId && onOpen) {
          const item = items.find((i) => getId(i) === activeId);
          if (item) {
            event.preventDefault();
            onOpen(item);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, moveBy, activeId, items, getId, onOpen]);

  const activeItem = activeId !== null ? (items.find((i) => getId(i) === activeId) ?? null) : null;

  return {
    activeId,
    activeIndex,
    activeItem,
    setActiveId,
    registerItemRef,
    moveBy,
  };
}
