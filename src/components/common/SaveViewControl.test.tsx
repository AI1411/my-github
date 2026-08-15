import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveViewControl } from "./SaveViewControl";

describe("SaveViewControl", () => {
  it("saves a non-empty name with Enter", () => {
    const onSave = vi.fn();
    render(<SaveViewControl onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    const input = screen.getByRole("textbox", { name: "View name" });
    fireEvent.change(input, { target: { value: "My reviews" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("My reviews");
    expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();
  });

  it("does not save an empty name", () => {
    const onSave = vi.fn();
    render(<SaveViewControl onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "View name" }), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels with Escape", () => {
    const onSave = vi.fn();
    render(<SaveViewControl onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByRole("textbox", { name: "View name" }), {
      target: { value: "Nope" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "View name" }), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();
  });
});
