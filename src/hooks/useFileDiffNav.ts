import { useEffect, useRef, useState } from "react";
import { stepFileIndex } from "../lib/fileNav";
import { useUiStore } from "../stores/uiStore";
import { useKeyboardShortcut } from "./useKeyboardShortcut";

export function useFileDiffNav(
  filenames: string[],
  enabled: boolean,
  onSelect: (filename: string) => void,
): number {
  const [index, setIndex] = useState(0);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const filenamesRef = useRef(filenames);
  filenamesRef.current = filenames;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    setIndex(0);
  }, [filenames.join("\0")]);

  const move = (delta: number) => {
    if (!enabledRef.current || commandPaletteOpen) return;
    const list = filenamesRef.current;
    if (list.length === 0) return;
    setIndex((current) => {
      const next = stepFileIndex(current, list.length, delta);
      const filename = list[next];
      if (filename) onSelectRef.current(filename);
      return next;
    });
  };

  useKeyboardShortcut({ key: "]", preventDefault: true }, () => move(1));
  useKeyboardShortcut({ key: "[", preventDefault: true }, () => move(-1));

  return index;
}
