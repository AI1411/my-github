import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "./ListSkeleton";

describe("ListSkeleton", () => {
  it("exposes a busy status for screen readers", () => {
    render(<ListSkeleton rows={3} />);
    const status = screen.getByRole("status", { name: "Loading" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });
});
