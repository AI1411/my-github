import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "../../stores/uiStore";
import { AppShell } from "./AppShell";

vi.mock("../../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

describe("AppShell offline banner", () => {
  beforeEach(() => {
    useUiStore.setState({ offline: false, sidebarCollapsed: false });
  });

  it("shows an offline banner when uiStore is offline", () => {
    useUiStore.setState({ offline: true });

    render(
      <MemoryRouter>
        <AppShell sidebar={<div />} main={<div>Main</div>} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Offline")).toBeInTheDocument();
  });
});
