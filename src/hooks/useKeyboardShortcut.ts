import { useEffect, useRef } from "react";

export interface ShortcutDescriptor {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
}

export type ShortcutHandler = (event: KeyboardEvent) => void;

function matches(event: KeyboardEvent, desc: ShortcutDescriptor): boolean {
  const key = event.key.toLowerCase();
  if (key !== desc.key.toLowerCase()) return false;
  const isMeta = event.metaKey || event.ctrlKey;
  if ((desc.meta ?? false) !== isMeta) return false;
  if ((desc.shift ?? false) !== event.shiftKey) return false;
  if ((desc.alt ?? false) !== event.altKey) return false;
  return true;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useKeyboardShortcut(
  descriptor: ShortcutDescriptor,
  handler: ShortcutHandler,
  options: { allowInInputs?: boolean } = {},
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!options.allowInInputs && isEditable(event.target)) return;
      if (!matches(event, descriptor)) return;
      if (descriptor.preventDefault) event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    descriptor.key,
    descriptor.meta,
    descriptor.shift,
    descriptor.alt,
    descriptor.preventDefault,
    options.allowInInputs,
  ]);
}
