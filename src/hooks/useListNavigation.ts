import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsShortcut } from "./useSettingsShortcut";

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
        node?.scrollIntoView?.({ block: "nearest" });
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

  const activeItem = activeId !== null ? (items.find((i) => getId(i) === activeId) ?? null) : null;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  useSettingsShortcut("listDown", () => {
    if (!enabled) return;
    moveBy(1);
  });

  useSettingsShortcut("listUp", () => {
    if (!enabled) return;
    moveBy(-1);
  });

  useSettingsShortcut("openDetail", () => {
    if (!enabled) return;
    const id = activeIdRef.current;
    const open = onOpenRef.current;
    if (!id || !open) return;
    const item = itemsRef.current.find((i) => getIdRef.current(i) === id);
    if (item) open(item);
  });

  return {
    activeId,
    activeIndex,
    activeItem,
    setActiveId,
    registerItemRef,
    moveBy,
  };
}
