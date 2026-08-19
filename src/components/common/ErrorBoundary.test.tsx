import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

function ThrowingChild(): never {
  throw new Error("Render failed");
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders fallback UI and logs frontend errors", async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "cmd_log_frontend_error",
        expect.objectContaining({
          componentStack: expect.stringContaining("ThrowingChild"),
          message: "Render failed",
          stack: expect.any(String),
          url: expect.any(String),
        }),
      );
    });
  });

  it("remounts children on retry so persistent render errors can recover", async () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveAttribute("data-remount-key", "0");

    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toHaveAttribute(
        "data-remount-key",
        "1",
      );
    });
  });
});
