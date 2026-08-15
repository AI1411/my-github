import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../stores/uiStore";
import { useFileDiffNav } from "./useFileDiffNav";

function Probe({
  files,
  enabled,
  onSelect,
}: {
  files: string[];
  enabled: boolean;
  onSelect: (name: string) => void;
}) {
  const index = useFileDiffNav(files, enabled, onSelect);
  return <div data-testid="index">{index}</div>;
}

describe("useFileDiffNav", () => {
  beforeEach(() => {
    useUiStore.setState({ commandPaletteOpen: false });
  });

  it("moves to the next and previous file with ] and [", () => {
    const onSelect = vi.fn();
    render(<Probe files={["a.ts", "b.ts", "c.ts"]} enabled onSelect={onSelect} />);
    fireEvent.keyDown(window, { key: "]" });
    expect(onSelect).toHaveBeenCalledWith("b.ts");
    expect(screen.getByTestId("index")).toHaveTextContent("1");
    fireEvent.keyDown(window, { key: "]" });
    expect(onSelect).toHaveBeenCalledWith("c.ts");
    fireEvent.keyDown(window, { key: "[" });
    expect(onSelect).toHaveBeenCalledWith("b.ts");
  });

  it("does nothing when the files tab is inactive", () => {
    const onSelect = vi.fn();
    render(<Probe files={["a.ts", "b.ts"]} enabled={false} onSelect={onSelect} />);
    fireEvent.keyDown(window, { key: "]" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does nothing when the command palette is open", () => {
    useUiStore.setState({ commandPaletteOpen: true });
    const onSelect = vi.fn();
    render(<Probe files={["a.ts", "b.ts"]} enabled onSelect={onSelect} />);
    fireEvent.keyDown(window, { key: "]" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
